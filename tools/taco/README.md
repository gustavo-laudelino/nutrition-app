# Importação da TACO 4ª edição

Gera a migration `nutrition-api/src/main/resources/db/migration/V3__import_taco_4ed_nutrients.sql`, que grava os nutrientes da TACO (NEPA/UNICAMP, 2011) em `food_nutrients` para os alimentos TACO já existentes em `foods`.

```bash
python tools/taco/generate_taco_migration.py "C:/Users/gulau/Downloads/Taco-4a-Edicao.xlsx"
```

- Usa só a biblioteca padrão do Python 3 (`zipfile` + `xml.etree`). A planilha fica fora do repositório.
- Lê as abas `CMVCol taco3` (composição, minerais e vitaminas) e `AGtaco3` (ácidos graxos: saturados, mono, poli e trans 18:1t/18:2t). As colunas são mapeadas pela posição e o cabeçalho é conferido. Se o layout mudar, o script falha com uma mensagem clara.
- Não importa energia, macros (continuam em `foods`), kJ, ácidos graxos individuais nem aminoácidos.
- **Tokens**, conforme a legenda da planilha:

  | Valor na planilha | Status gravado | Valor gravado |
  |---|---|---|
  | `Tr` (traço) | `TRACE` | 0 |
  | `NA` (não aplicável) | `NOT_APPLICABLE` | 0 |
  | vazio ou `*` (em reavaliação) | `NOT_ANALYZED` | nulo |

  Alimento ausente da aba de ácidos graxos não recebe registro dessas linhas.
- **Valores negativos ou ilegíveis** são gravados como `NOT_ANALYZED`, sem inventar valor, e listados no cabeçalho do SQL. Na edição atual há um: alimento 373, piridoxina, `",0,02"`.
- O casamento com o catálogo é `foods.source = 'TACO'` e `foods.source_code` igual ao número do alimento. Alimentos que não estão no catálogo são ignorados pelo `JOIN`.
- **Migrations aplicadas são imutáveis.** Depois que a V3 rodar no banco, uma correção de dados deve entrar numa nova migration (V4+), sem regerar a V3. Regerar a V3 muda o checksum e a data no cabeçalho.

**Última geração (17/09/2026):**
- Planilha: 597 alimentos (423 na aba de ácidos graxos) e 14.652 linhas.
- Status: VALUE 10.212, TRACE 1.939, NOT_APPLICABLE 881, NOT_ANALYZED 1.620.
- Nos 548 alimentos "prontos" do CSV de carga original: 13.558 linhas. O banco real tem 544 alimentos, então o total final deve ficar um pouco abaixo disso.

A contagem por nutriente é impressa pelo script.
