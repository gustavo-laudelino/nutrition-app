"""Generates the Flyway migration that imports TACO 4th edition nutrients into food_nutrients.

Usage:
    python tools/taco/generate_taco_migration.py <path to Taco-4a-Edicao.xlsx> [output .sql]

Standard library only (zipfile + xml.etree). The spreadsheet stays outside the repository.
Macros and energy are not imported: they remain in the foods table, the source of truth for them.
"""
import collections
import datetime
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / 'nutrition-api/src/main/resources/db/migration/V3__import_taco_4ed_nutrients.sql'

# Column letter -> (expected header text in rows 2 and 3, nutrient code). Mapped by position, then checked.
COMPOSITION_SHEET = 'CMVCol taco3'
COMPOSITION_COLUMNS = {
    'C': ('umidade (%)', 'MOISTURE'),
    'H': ('colesterol (mg)', 'CHOLESTEROL'),
    'J': ('alimentar (g)', 'FIBER'),
    'K': ('cinzas (g)', 'ASH'),
    'L': ('calcio (mg)', 'CALCIUM'),
    'M': ('magnesio (mg)', 'MAGNESIUM'),
    'O': ('manganes (mg)', 'MANGANESE'),
    'P': ('fosforo (mg)', 'PHOSPHORUS'),
    'Q': ('ferro (mg)', 'IRON'),
    'R': ('sodio (mg)', 'SODIUM'),
    'S': ('potassio (mg)', 'POTASSIUM'),
    'T': ('cobre (mg)', 'COPPER'),
    'U': ('zinco (mg)', 'ZINC'),
    'V': ('retinol (mcg)', 'RETINOL'),
    'W': ('re (mcg)', 'VITAMIN_A_RE'),
    'X': ('rae (mcg)', 'VITAMIN_A_RAE'),
    'Y': ('tiamina (mg)', 'THIAMIN'),
    'Z': ('riboflavina (mg)', 'RIBOFLAVIN'),
    'AA': ('piridoxina (mg)', 'VITAMIN_B6'),
    'AB': ('niacina (mg)', 'NIACIN'),
    'AC': ('c (mg)', 'VITAMIN_C'),
}
# Columns checked only to make sure the layout did not move (not imported).
COMPOSITION_LAYOUT = {'A': 'numero do alimento', 'B': 'descricao dos alimentos', 'D': 'energia (kcal)', 'E': '(kj)',
                      'F': 'proteina (g)', 'G': 'lipideos (g)', 'I': 'idrato (g)', 'N': 'numero do alimento'}
FATTY_ACID_SHEET = 'AGtaco3'
FATTY_ACID_COLUMNS = {
    'C': ('turados (g)', 'SATURATED_FAT'),
    'D': ('insaturados (g)', 'MONOUNSATURATED_FAT'),
    'E': ('insaturados (g)', 'POLYUNSATURATED_FAT'),
    'X': ('18:1t (g)', 'TRANS_FAT_18_1'),
    'Y': ('18:2t (g)', 'TRANS_FAT_18_2'),
}
FATTY_ACID_LAYOUT = {'A': 'numero do alimento', 'B': 'descricao dos alimentos', 'M': 'numero do alimento'}
# Legend of the spreadsheet: "NA: não aplicável; Tr: traço"; "*": analyses being re-evaluated.
TOKENS = {'tr': ('TRACE', '0'), 'na': ('NOT_APPLICABLE', '0'), '*': ('NOT_ANALYZED', None), '': ('NOT_ANALYZED', None)}
SCALE = Decimal('0.000001')  # numeric(19,6)


def fail(message):
    sys.exit(f'Erro: {message}')


def normalize(text):
    text = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', text).strip().lower()


def read_sheets(path):
    ns = {'m': MAIN, 'r': RELS}
    with zipfile.ZipFile(path) as book:
        shared = []
        if 'xl/sharedStrings.xml' in book.namelist():
            for item in ET.fromstring(book.read('xl/sharedStrings.xml')).findall('m:si', ns):
                shared.append(''.join(node.text or '' for node in item.iter(f'{{{MAIN}}}t')))
        targets = {rel.get('Id'): rel.get('Target') for rel in ET.fromstring(book.read('xl/_rels/workbook.xml.rels'))}
        sheets = {}
        for sheet in ET.fromstring(book.read('xl/workbook.xml')).find('m:sheets', ns):
            target = targets[sheet.get(f'{{{RELS}}}id')].lstrip('/')
            file = target if target.startswith('xl/') else 'xl/' + target
            rows = {}
            for row in ET.fromstring(book.read(file)).find('m:sheetData', ns).findall('m:row', ns):
                cells = {}
                for cell in row.findall('m:c', ns):
                    column = re.match(r'[A-Z]+', cell.get('r')).group()
                    value = cell.find('m:v', ns)
                    if cell.get('t') == 's' and value is not None:
                        cells[column] = shared[int(value.text)]
                    elif cell.get('t') == 'inlineStr':
                        cells[column] = ''.join(node.text or '' for node in cell.iter(f'{{{MAIN}}}t'))
                    elif value is not None:
                        cells[column] = value.text
                rows[int(row.get('r'))] = cells
            sheets[sheet.get('name')] = rows
    return sheets


def check_header(sheet_name, rows, columns, layout):
    expected = {column: text for column, (text, _) in columns.items()} | layout
    for column, text in expected.items():
        found = normalize(f"{rows.get(2, {}).get(column, '')} {rows.get(3, {}).get(column, '')}")
        # Headers split over rows 1-3 ("Carbo-/idrato", "Sa-/turados"): rows 2 and 3 must end with the expected text.
        if not found.endswith(text):
            fail(f'cabeçalho inesperado na aba "{sheet_name}", coluna {column}: "{found}" (esperado "{text}"). '
                 'O layout da planilha mudou; revise o mapeamento antes de gerar.')


def parse_value(raw):
    """Returns (status, amount as text or None, problem). Negative or unreadable values are never guessed."""
    text = (raw or '').strip()
    token = TOKENS.get(text.lower())
    if token:
        return token[0], token[1], None
    try:
        number = Decimal(text)
    except InvalidOperation:
        return 'NOT_ANALYZED', None, 'ilegível'
    if number < 0:
        return 'NOT_ANALYZED', None, 'negativo'
    return 'VALUE', format(number.quantize(SCALE, rounding=ROUND_HALF_UP).normalize(), 'f'), None


def food_rows(rows):
    """Numbered food rows only (category titles, headers and legend are skipped)."""
    foods = {}
    for number, cells in rows.items():
        code = (cells.get('A') or '').strip()
        if number > 3 and re.fullmatch(r'\d+(\.0+)?', code):
            foods[str(int(Decimal(code)))] = cells
    return foods


def main():
    if len(sys.argv) < 2:
        fail('informe o caminho do arquivo Taco-4a-Edicao.xlsx.')
    source = Path(sys.argv[1])
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT
    sheets = read_sheets(source)
    for name in (COMPOSITION_SHEET, FATTY_ACID_SHEET):
        if name not in sheets:
            fail(f'aba "{name}" não encontrada.')
    check_header(COMPOSITION_SHEET, sheets[COMPOSITION_SHEET], COMPOSITION_COLUMNS, COMPOSITION_LAYOUT)
    check_header(FATTY_ACID_SHEET, sheets[FATTY_ACID_SHEET], FATTY_ACID_COLUMNS, FATTY_ACID_LAYOUT)
    composition = food_rows(sheets[COMPOSITION_SHEET])
    fatty_acids = food_rows(sheets[FATTY_ACID_SHEET])

    lines, discarded = [], []
    by_status = collections.Counter()
    by_nutrient = collections.defaultdict(collections.Counter)
    for code in sorted(composition, key=int):
        for sheet_cells, columns in ((composition[code], COMPOSITION_COLUMNS), (fatty_acids.get(code), FATTY_ACID_COLUMNS)):
            if sheet_cells is None:
                continue  # food absent from the fatty acid table: no record (the day total becomes partial)
            for column, (_, nutrient) in columns.items():
                status, amount, problem = parse_value(sheet_cells.get(column))
                if problem:
                    discarded.append(f'alimento {code}, {nutrient}: "{sheet_cells.get(column)}" ({problem})')
                by_status[status] += 1
                by_nutrient[nutrient][status] += 1
                lines.append(f"('{code}','{nutrient}',{amount if amount is not None else 'NULL'},'{status}')")

    generated = datetime.date.today().isoformat()
    statuses = ', '.join(f'{status} {count}' for status, count in sorted(by_status.items()))
    header = [
        '-- Nutrientes da TACO 4ª edição (NEPA/UNICAMP, 2011) por 100 g, para os alimentos TACO já existentes em foods.',
        f'-- Gerado por tools/taco/generate_taco_migration.py em {generated} a partir de {source.name}. Não editar à mão:',
        '-- correções de dados entram como novas migrations (V4+).',
        f'-- Alimentos na planilha: {len(composition)} (ácidos graxos: {len(fatty_acids)}). Linhas: {len(lines)}. Status: {statuses}.',
        '-- Tokens: Tr = TRACE (soma 0), NA = NOT_APPLICABLE (soma 0), vazio ou * = NOT_ANALYZED (sem valor; total parcial).',
        f'-- Valores negativos ou ilegíveis gravados como NOT_ANALYZED (sem inventar valor): {len(discarded)}.',
        *[f'--   {item}' for item in discarded],
        '-- Casamento por foods.source = \'TACO\' e foods.source_code = número do alimento; alimentos fora do catálogo são ignorados.',
        '',
    ]
    statements = []
    for start in range(0, len(lines), 1000):
        chunk = ',\n'.join(lines[start:start + 1000])
        statements.append(
            'INSERT INTO food_nutrients (food_id, nutrient_code, amount, status, source)\n'
            "SELECT f.id, v.code, v.amount, v.status, 'TACO_4ED'\n"
            f'FROM (VALUES\n{chunk}\n) AS v(source_code, code, amount, status)\n'
            "JOIN foods f ON f.source = 'TACO' AND f.source_code::text = v.source_code;\n")
    output.write_text('\n'.join(header) + '\n'.join(statements), encoding='utf-8', newline='\n')

    print(f'Arquivo gerado: {output}')
    print(f'Alimentos lidos: {len(composition)} (composição), {len(fatty_acids)} (ácidos graxos)')
    print(f'Linhas geradas: {len(lines)}')
    print('Por status: ' + statuses)
    print('Por nutriente:')
    for nutrient in sorted(by_nutrient):
        print(f'  {nutrient}: ' + ', '.join(f'{status} {count}' for status, count in sorted(by_nutrient[nutrient].items())))
    print(f'Valores negativos ou ilegíveis (gravados como NOT_ANALYZED): {len(discarded)}')
    for item in discarded:
        print('  ' + item)


if __name__ == '__main__':
    main()
