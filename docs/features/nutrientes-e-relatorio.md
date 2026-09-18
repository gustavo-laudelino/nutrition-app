# Feature: modelo genérico de nutrientes, TACO completa e relatório de micronutrientes

Épico: **Planejamento alimentar** · Definida em 17/09/2026 · **Especificação para execução autônoma** (sem perguntas durante a execução: tudo que falta está decidido aqui).

Leia antes o [HANDOFF.md](../../HANDOFF.md) (seções 1, 2, 5, 8, 9, 10, 11, 12) e as especificações [porcao-por-nutriente.md](porcao-por-nutriente.md) e [paciente-no-planejamento.md](paciente-no-planejamento.md).

Continuam valendo: **não executar comandos Git**; **nenhuma fórmula nutricional no Angular**; mensagens em português; não adicionar dependências; executar `mvn test`, `npm test` e `npm run build`; **não gerar o JAR nem reiniciar a API do usuário** (ela depende de variáveis de ambiente que não estão disponíveis); atualizar READMEs e HANDOFF ao final.

## Objetivo

1. Criar o **modelo genérico de nutrientes** (decisão pendente no HANDOFF): catálogo de nutrientes + valor de cada nutriente por alimento, com fonte e com **valores ausentes representados** (traço, não aplicável, não analisado).
2. Importar **todos os nutrientes disponíveis da TACO 4ª edição** para os alimentos já existentes no catálogo.
3. Mostrar no planejamento um **relatório de micronutrientes do dia** (como o print de referência do usuário: nome, consumido / referência, barra com linha tracejada da referência), **abaixo do gráfico lateral** (card de análise). Os micros **não aparecem nas refeições**.
4. **Fibra alimentar** ganha uma barra no card de análise; os demais (colesterol, frações de gordura, minerais, vitaminas) ficam no relatório.

## Decisões do usuário (17/09, não reabrir)

1. **Fonte:** TACO 4ª edição completa agora. O modelo aceita várias fontes; USDA/TBCA ficam para depois.
2. **Referência ("DDR"):** DRIs do **Food and Nutrition Board / IOM (NASEM)**, **RDA ou AI**, escolhida pelo **sexo e idade** do paciente (adultos 19+). **Sem UL** (limite superior) nesta entrega. Sem sexo ou sem idade, ou idade < 19: o relatório mostra só o consumido, sem referência.
3. **Catálogo liberado:** a regra do HANDOFF "não investir no banco de alimentos temporário" tem **exceção para esta feature**: novo esquema versionado no Flyway e importação reproduzível da TACO. Contrato `FoodCatalog`/`FoodResponse` mantido; a tabela `foods` **não** é alterada nem apagada.
4. **Fibra** no card de análise; **o resto** no relatório.

## Dados de origem

- Arquivo: `C:\Users\gulau\Downloads\Taco-4a-Edicao.xlsx` (fica **fora** do repositório).
- Aba **`CMVCol taco3`** (composição centesimal, minerais e vitaminas, por 100 g). Linhas de alimento: coluna A numérica = **número do alimento TACO** (= `foods.source_code` quando `foods.source = 'TACO'`). Há 597 alimentos numerados; o catálogo atual tem 544 (os demais foram excluídos na carga original e **continuam fora**). As colunas de cabeçalho se repetem ("Número do Alimento" aparece duas vezes): mapear **pela posição do cabeçalho**, não pelo texto, e conferir na execução.
  - Colunas desta aba, em ordem: número, descrição, umidade (%), energia (kcal), energia (kJ), proteína (g), lipídeos (g), colesterol (mg), carboidrato (g), fibra alimentar (g), cinzas (g), cálcio (mg), magnésio (mg), [número repetido], manganês (mg), fósforo (mg), ferro (mg), sódio (mg), potássio (mg), cobre (mg), zinco (mg), retinol (mcg), RE (mcg), RAE (mcg), tiamina (mg), riboflavina (mg), piridoxina (mg), niacina (mg), vitamina C (mg).
- Aba **`AGtaco3`** (ácidos graxos, g por 100 g): saturados, monoinsaturados, poli-insaturados, …, **18:1t** e **18:2t** (trans).
- **Não importar:** energia em kJ, macros (continuam nas colunas atuais de `foods`, que são a fonte de verdade de energia/C/P/G), ácidos graxos individuais (12:0, 14:0…), aminoácidos (aba com só 39 alimentos).
- Leitura do `.xlsx` **só com a biblioteca padrão do Python** (`zipfile` + `xml.etree`), sem openpyxl/pandas (não instalados, e não adicionar dependências). Ler `xl/sharedStrings.xml` e `xl/workbook.xml` + `xl/_rels/workbook.xml.rels` para achar o arquivo de cada aba; valores de texto vêm de `sharedStrings` (atributo `t="s"`); a coluna vem da referência da célula (`r="C12"`), não da posição na linha (células vazias são omitidas).

### Valores ausentes (tokens encontrados na TACO)

| Célula | Significado adotado | Status gravado | Entra na soma |
|---|---|---|---|
| número | valor analisado | `VALUE` | sim, com o valor |
| `Tr` (1.865 células) | traço (abaixo do limite de quantificação / arredonda a 0) | `TRACE` | sim, como **0** |
| `NA` (907) | não aplicável (ex.: colesterol e retinol em vegetais) | `NOT_APPLICABLE` | sim, como **0** |
| vazio (93) ou `*` (76) | não analisado / em reavaliação | `NOT_ANALYZED` | **não**: o total fica **parcial** |

Esta interpretação segue a legenda da TACO; se o arquivo tiver uma aba ou nota de legenda que contradiga, **seguir o arquivo** e registrar a diferença no HANDOFF. Registrar também "a validar com o nutricionista".

## Backend (`nutrition-api`)

### Esquema (Flyway)

**`V2__create_nutrient_model.sql`**

```text
nutrients
  code           varchar(40) primary key       -- ex.: FIBER, CALCIUM, VITAMIN_A_RAE
  name           varchar(80) not null          -- nome em português para exibição
  unit           varchar(10) not null          -- g | mg | mcg | %
  category       varchar(20) not null          -- FIBER | LIPID | MINERAL | VITAMIN | OTHER
  display_order  integer not null
  in_report      boolean not null              -- aparece no relatório do dia

food_nutrients
  food_id        bigint not null references foods(id)
  nutrient_code  varchar(40) not null references nutrients(code)
  amount         numeric(19,6)                 -- por 100 g; null quando não analisado
  status         varchar(20) not null          -- VALUE | TRACE | NOT_APPLICABLE | NOT_ANALYZED
  source         varchar(30) not null          -- TACO_4ED
  primary key (food_id, nutrient_code)
  check (status <> 'VALUE' or amount is not null)
```

Semente de `nutrients` no próprio V2 (códigos, nomes, unidades, categorias, ordem; `in_report`):

| code | name | unit | category | in_report |
|---|---|---|---|---|
| FIBER | Fibra alimentar | g | FIBER | não (vai no card de análise) |
| CHOLESTEROL | Colesterol | mg | LIPID | sim |
| SATURATED_FAT | Gordura saturada | g | LIPID | sim |
| MONOUNSATURATED_FAT | Gordura monoinsaturada | g | LIPID | sim |
| POLYUNSATURATED_FAT | Gordura poli-insaturada | g | LIPID | sim |
| TRANS_FAT_18_1 | Gordura trans (18:1t) | g | LIPID | sim |
| TRANS_FAT_18_2 | Gordura trans (18:2t) | g | LIPID | sim |
| CALCIUM | Cálcio | mg | MINERAL | sim |
| COPPER | Cobre | mg | MINERAL | sim |
| IRON | Ferro | mg | MINERAL | sim |
| PHOSPHORUS | Fósforo | mg | MINERAL | sim |
| MAGNESIUM | Magnésio | mg | MINERAL | sim |
| MANGANESE | Manganês | mg | MINERAL | sim |
| POTASSIUM | Potássio | mg | MINERAL | sim |
| SODIUM | Sódio | mg | MINERAL | sim |
| ZINC | Zinco | mg | MINERAL | sim |
| VITAMIN_A_RAE | Vitamina A (RAE) | mcg | VITAMIN | sim |
| RETINOL | Retinol | mcg | VITAMIN | não |
| VITAMIN_A_RE | Vitamina A (RE) | mcg | VITAMIN | não |
| THIAMIN | Tiamina (B1) | mg | VITAMIN | sim |
| RIBOFLAVIN | Riboflavina (B2) | mg | VITAMIN | sim |
| NIACIN | Niacina (B3) | mg | VITAMIN | sim |
| VITAMIN_B6 | Vitamina B6 (piridoxina) | mg | VITAMIN | sim |
| VITAMIN_C | Vitamina C | mg | VITAMIN | sim |
| MOISTURE | Umidade | % | OTHER | não |
| ASH | Cinzas | g | OTHER | não |

Ordem de exibição: minerais e vitaminas em ordem alfabética do nome (como no print), depois lipídios.

**`V3__import_taco_4ed_nutrients.sql`**: gerado pelo script (abaixo). Insere em `food_nutrients` **somente** para alimentos existentes, casando por `foods.source = 'TACO' AND foods.source_code = <número>`:

```sql
INSERT INTO food_nutrients (food_id, nutrient_code, amount, status, source)
SELECT f.id, v.code, v.amount, v.status, 'TACO_4ED'
FROM (VALUES ('1','CALCIUM',5.204,'VALUE'), ('1','CHOLESTEROL',NULL,'NOT_APPLICABLE'), ...) AS v(source_code, code, amount, status)
JOIN foods f ON f.source = 'TACO' AND f.source_code = v.source_code;
```

Conferir o tipo real de `foods.source_code` (texto) e ajustar o casamento se necessário. Migrations aplicadas são imutáveis: correções futuras de dados entram como V4+.

### Script de importação (reproduzível, versionado)

- `tools/taco/generate_taco_migration.py` (Python 3, **só biblioteca padrão**): lê o `.xlsx` (caminho por argumento), valida o cabeçalho esperado (falha com mensagem clara se mudar), aplica a tabela de tokens, e escreve `nutrition-api/src/main/resources/db/migration/V3__import_taco_4ed_nutrients.sql`, com cabeçalho de comentário: fonte (TACO 4ª ed., NEPA/UNICAMP, 2011), data de geração, contagens por status.
- Imprime estatísticas: alimentos lidos, linhas geradas, contagem por status e por nutriente. Registrar essas contagens no HANDOFF.
- `tools/taco/README.md` com o comando de geração.
- **Valores negativos** na planilha: não gravar; tratar como `NOT_ANALYZED` e listar no relatório do script.

### Código

Pacote novo **`nutrient`** (modelo genérico) e ajustes em `food` e `calculation`:

- `nutrient/Nutrient` (entidade JPA de `nutrients`), `nutrient/FoodNutrient` (entidade de `food_nutrients`, chave composta), repositórios. `ddl-auto: validate` precisa bater exatamente com o V2.
- `nutrient/NutrientStatus` (`VALUE`, `TRACE`, `NOT_APPLICABLE`, `NOT_ANALYZED`).
- `food/FoodCatalog` ganha `Map<Long, List<FoodNutrientValue>> nutrientsOf(Collection<Long> foodIds)` — uma consulta para todos os alimentos do dia (sem N+1). `FoodNutrientValue` carrega a definição (code, name, unit, category, displayOrder, inReport), `amount` por 100 g e `status`. Implementar em `JpaFoodCatalog` e em `DevelopmentFoodCatalog` (teste), com dados **sintéticos** cobrindo os quatro status.
- **Referências IOM/FNB**: arquivo versionado `nutrition-api/src/main/resources/nutrient-references/iom-fnb-dri-adults.csv` carregado na inicialização por `nutrient/NutrientReferences` (funciona também no perfil `test`, sem banco). Colunas: `nutrient_code,sex,age_min,age_max,amount,unit,type`. Na carga, **validar** que o código existe na lista de nutrientes conhecidos (constante/enum de códigos no código Java, igual à semente do V2) e que a unidade é a mesma do nutriente; falhar a inicialização se não bater.
- `calculation/DietCalculator`: além do que já faz, soma cada nutriente por porção **das Opções 1** (ver [opcoes-de-refeicao.md](opcoes-de-refeicao.md)) (`valor por 100 g × quantidade ÷ 100`, **sem arredondar antes da soma**, arredondar a 2 casas só no total), por dia (não por refeição). Para cada nutriente: `consumed`, `status` do total e `foodsWithoutData`.
  - Status do total: `COMPLETE` se todas as porções tinham dado (VALUE/TRACE/NOT_APPLICABLE); `PARTIAL` se algumas não tinham (`NOT_ANALYZED` ou nenhum registro para o alimento); `NO_DATA` se nenhuma tinha (consumed = null). Dia sem porções: lista vazia.
  - Referência: pela faixa de `sex`/`age` do perfil (abaixo); `percentOfReference = consumed ÷ referência × 100`, 1 casa; só quando há referência e consumed não é null.
- **Contrato** `POST /api/diet-calculations`:
  - Pedido ganha `referenceProfile` **opcional**: `{ "sex": "FEMALE" | "MALE", "age": 19..130 }` (inteiro). Ausente, incompleto, sexo `UNSPECIFIED` ou idade < 19 → sem referência (sem erro). Idade > 130 ou tipo inválido → 400 por campo, em português.
  - Resposta ganha, na raiz:
    ```json
    "nutrients": [
      { "code": "CALCIUM", "name": "Cálcio", "unit": "mg", "category": "MINERAL", "inReport": true,
        "consumed": 271.9, "status": "PARTIAL", "foodsWithoutData": 1,
        "reference": { "amount": 1000, "type": "RDA", "percent": 27.2 } }
    ],
    "referenceSource": { "name": "Food and Nutrition Board / IOM (DRI)", "profile": "Mulher, 19–30 anos" }
    ```
    `reference` e `referenceSource` são `null` sem perfil válido. `nutrients` inclui **fibra** (`inReport: false`), usada pelo card de análise. Meals **não** ganham micronutrientes.
  - Atualizar `examples/diet-calculation-request.json` e `examples/diet-calculation-response.json` (teste STRICT).
- Endpoints públicos continuam públicos; nenhum novo endpoint é necessário.

### Tabela de referência (RDA/AI, adultos, NASEM/IOM)

Transcrita das DRIs do Food and Nutrition Board (National Academies), incluindo a atualização de 2019 para sódio e potássio. **Marcar no CSV e no HANDOFF: "a validar com o nutricionista".** Unidades já na unidade do nutriente acima. Faixas: 19–30, 31–50, 51–70, 71–130.

| Nutriente | Tipo | Homem | Mulher |
|---|---|---|---|
| Fibra (g) | AI | 19–50: 38 · 51+: 30 | 19–50: 25 · 51+: 21 |
| Cálcio (mg) | RDA | 19–70: 1000 · 71+: 1200 | 19–50: 1000 · 51+: 1200 |
| Cobre (mg) | RDA | 0,9 | 0,9 |
| Ferro (mg) | RDA | 8 | 19–50: 18 · 51+: 8 |
| Fósforo (mg) | RDA | 700 | 700 |
| Magnésio (mg) | RDA | 19–30: 400 · 31+: 420 | 19–30: 310 · 31+: 320 |
| Manganês (mg) | AI | 2,3 | 1,8 |
| Potássio (mg) | AI (2019) | 3400 | 2600 |
| Sódio (mg) | AI (2019) | 1500 | 1500 |
| Zinco (mg) | RDA | 11 | 8 |
| Vitamina A (mcg RAE) | RDA | 900 | 700 |
| Tiamina (mg) | RDA | 1,2 | 1,1 |
| Riboflavina (mg) | RDA | 1,3 | 1,1 |
| Niacina (mg) | RDA | 16 | 14 |
| Vitamina B6 (mg) | RDA | 19–50: 1,3 · 51+: 1,7 | 19–50: 1,3 · 51+: 1,5 |
| Vitamina C (mg) | RDA | 90 | 75 |

Sem referência nesta entrega: colesterol, frações de gordura (saturada, mono, poli, trans), retinol, RE, umidade, cinzas.

Observações a registrar (sem inventar ajustes): niacina da TACO é em mg e a RDA é em mg de equivalentes de niacina (NE) — comparação aproximada; o print do usuário usa potássio 4700 mg (valor de 2005), aqui adotamos 2019; gestação/lactação não são cobertas (como no restante do MVP).

### Testes (backend, sem PostgreSQL)

- Carregamento e validação do CSV de referências (código desconhecido e unidade divergente falham).
- Seleção da referência por sexo e faixa etária, incluindo limites (30/31, 50/51, 70/71) e ausência de perfil/idade < 19.
- Soma de nutrientes: precisão (arredonda só no total), `TRACE` e `NOT_APPLICABLE` contam 0, `NOT_ANALYZED` e alimento sem registro geram `PARTIAL` com `foodsWithoutData`, todos sem dado → `NO_DATA`.
- Contrato: `referenceProfile` válido/ausente/inválido, `nutrients` e `referenceSource` na resposta, exemplo STRICT atualizado, endpoint continua público.
- Os testes existentes continuam passando.

## Frontend (`nutrition-web`)

- `api.ts`: tipos de `referenceProfile`, `nutrients` e `referenceSource`.
- O pedido de composição envia `referenceProfile` a partir do perfil do planejamento (`sex` diferente de `UNSPECIFIED` e `age` preenchida); senão não envia. O paciente escolhido do cadastro alimenta os mesmos campos.
- **Card de análise:** nova barra **Fibra alimentar** depois de C/P/G, mesmo componente das barras de macro, cor nova `--fiber` (verde-água, ex.: `#2a9d8f`, com `-soft`, `-strong`, `-text`), valor "consumido / referência g" e restante; sem referência mostra "Sem referência". A barra usa `reference.percent` do backend (limitada a 100% no desenho). Sem destaque no donut (fibra não entra no donut).
- **Relatório de micronutrientes** abaixo do card de análise, na mesma coluna lateral:
  - Título "Micronutrientes" com botão para recolher/expandir (começa expandido; estado só na tela).
  - Grupos na ordem: **Minerais**, **Vitaminas**, **Lipídios**; dentro, a ordem do backend. Só nutrientes com `inReport: true`.
  - Cada linha como no print: nome · **consumido** / referência + unidade · barra horizontal com **linha tracejada vertical na referência ("DDR")**. Escala da barra: 0 a 200% da referência (excesso além de 200% encosta no fim com um marcador "›"). Sem referência: só o valor, sem barra (ou barra neutra).
  - `PARTIAL`: marcador discreto com título "Sem dado em N alimento(s)"; `NO_DATA`: "—".
  - Rodapé: "Referência: Food and Nutrition Board / IOM (DRI) · <perfil>" e "Valores de referência a validar com o nutricionista". Sem perfil: "Informe sexo e idade do paciente para comparar com a referência."
  - Formatação pt-BR: 1 casa para g/mg/mcg (0,0 como no print), `number` pipe.
- **Layout:** a coluna lateral passa a conter card + relatório. Em telas ≥ 860 px, a coluna fica `sticky` com `max-height: calc(100vh - 40px)` e rolagem interna; abaixo disso, fluxo normal. O card continua com o comportamento atual (destaque, comemoração).
- **Nenhum cálculo no Angular** (percentuais, somas e referências vêm do backend).
- Refeições **não** mostram micronutrientes.

### Testes (frontend)

- Pedido envia `referenceProfile` só com sexo e idade válidos.
- Barra de fibra com e sem referência.
- Relatório: grupos, ordem, linha tracejada na posição da referência, escala 200%, marcador de parcial, "—" sem dado, rodapé com perfil e sem perfil, recolher/expandir.
- Os testes existentes continuam passando (ajustar fixtures com `nutrients: []` e `referenceSource: null`).

## Ordem de execução

**Antes desta feature**, executar [opcoes-de-refeicao.md](opcoes-de-refeicao.md): as refeições passam a ter opções e **todas as somas do dia desta feature (fibra e micronutrientes) consideram só a Opção 1 de cada refeição**.

1. Script `tools/taco/generate_taco_migration.py` + geração do V3; registrar estatísticas.
2. V2 (esquema + semente), entidades, repositórios, `FoodCatalog.nutrientsOf`, CSV de referências + carregador.
3. `DietCalculator` e contrato; exemplos; testes. `mvn test`.
4. Frontend: tipos, pedido com perfil, barra de fibra, relatório, layout; testes. `npm test` e `npm run build`.
5. Navegador (dev server já ativo em 4200): **a API em execução não terá V2/V3 nem o contrato novo** — conferir a tela com resposta simulada no componente (como feito nas features anteriores) e confirmar que a tela não quebra com a API antiga (`nutrients` ausente → relatório oculto ou vazio, sem erro).
6. Documentação: README da API (contrato, esquema, script, referências), README web (relatório e fibra), HANDOFF (seção 2: modelo de nutrientes decidido e exceção do catálogo; seção 8: pacote `nutrient`; seção 9: contrato; seção 10: relatório; seção 11: V2/V3 e estatísticas da importação; seção 14: validação e **pendência: parar a API, gerar o JAR e subir para aplicar V2/V3 no PostgreSQL**).

## Fora de escopo

- USDA/TBCA e outros nutrientes (vitamina D, E, K, B12, folato, colina, selênio, flúor, ácido pantotênico): o modelo aceita, mas os dados vêm depois.
- Limite superior (UL), gestação/lactação, crianças.
- Micronutrientes por refeição ou por porção na tela; metas de micronutrientes definidas pelo nutricionista.
- Persistir planos.

## Critérios de aceite

- [x] V2 cria o modelo genérico; V3 importa a TACO 4ª ed. com os quatro status; `foods` intacta.
- [x] Script de geração versionado, só biblioteca padrão, reproduzível e documentado.
- [x] Referências IOM/FNB por sexo e idade, carregadas de arquivo versionado e validadas; marcadas "a validar com o nutricionista".
- [x] `/api/diet-calculations` devolve `nutrients` e `referenceSource`; totais parciais sinalizados; sem perfil, sem referência.
- [x] Barra de fibra no card de análise; relatório de micronutrientes abaixo dele, no estilo do print; nada de micros nas refeições.
- [x] Nenhuma fórmula no Angular; `mvn test`, `npm test` e `npm run build` passando; READMEs e HANDOFF atualizados.
