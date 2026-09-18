# Épico: Prontuário · Feature 1: Oficina de modelos de prontuário

Épico: **Prontuário** · Definida em 18/09/2026 · **Implementada por Claude em 18/09** (a pedido do usuário, sem o Codex): testes e builds passando, V4 e o fluxo completo conferidos num PostgreSQL descartável e no navegador. Falta aplicar a V4 no banco real (reiniciar a API) e validar o catálogo com o nutricionista.

Leia antes o [HANDOFF.md](../../HANDOFF.md) (seções 1, 2, 8, 9, 10, 11, 12) e a especificação [autenticacao-e-pacientes.md](autenticacao-e-pacientes.md), cujo padrão (proprietário, 404 para recurso alheio, `version` com 409, ProblemDetail com `errors`, telas com barra lateral) esta feature segue.

Continuam valendo: **não executar comandos Git**; mensagens em português; **não adicionar dependências** (o arrastar e soltar usa o `@angular/cdk` já instalado); executar `mvn test`, `npm test` e `npm run build`; **não gerar o JAR nem reiniciar a API do usuário**; atualizar READMEs e HANDOFF ao final. Dados de saúde: **apenas pacientes fictícios** até haver revisão de segurança (LGPD).

## Visão do épico

O prontuário coleta as informações do paciente em cada consulta. Cada nutricionista tem sua metodologia, então, em vez de um formulário fixo, ele **monta os próprios modelos de prontuário** numa **Oficina**: uma área de trabalho delimitada (não é tela infinita), com a caixa de ferramentas ao lado, onde arrasta perguntas prontas, cria seções e ordena tudo.

| Ordem | Feature | Status |
|---|---|---|
| 1 | **Oficina de modelos** (catálogo de campos, modelos do nutricionista, montagem por arrastar e soltar, pré-visualização) | **Implementada (18/09)**: esta especificação |
| 2 | **Prontuário por consulta** (preencher um modelo para um paciente, histórico datado, sincronização de peso/altura com o cadastro) | Decisões registradas abaixo; especificação detalhada depois da Feature 1 |
| — | Campos criados pelo próprio nutricionista | Futura (fora do escopo por decisão do usuário) |

## Decisões do usuário (18/09, não reabrir)

1. **Um prontuário por consulta.** Cada atendimento gera um prontuário preenchido; o paciente acumula um histórico datado. (Feature 2.)
2. **Vários modelos por nutricionista**, com um **modelo inicial** oferecido pelo sistema para ele começar e ajustar. Um dos modelos é o **padrão** (pré-selecionado ao abrir uma consulta na Feature 2).
3. **Campos só do catálogo do sistema.** O nutricionista não cria campos do zero nesta etapa. Ele pode **criar seções** (as "abas" do prontuário) com nome livre.
4. **O que o nutricionista ajusta em um campo:** **seção**, **posição** e **tamanho**. Não altera rótulo, tipo, opções nem obrigatoriedade.
5. **Peso e altura sincronizam com o cadastro do paciente** (Feature 2): o que for medido na consulta atualiza as medidas atuais. Sexo e nascimento vêm do cadastro.
6. **Oficina no estilo "área de trabalho com ferramentas ao lado"** (referência: painel do n8n, sem os fluxos), **com limites**: sem canvas infinito, sem zoom.

### Decisões de desenho (Claude, 18/09; mudar só com o usuário)

- **Cada campo do catálogo aparece no máximo uma vez por modelo.** Na caixa de ferramentas, um campo já usado fica marcado "no modelo" e não pode ser arrastado de novo. Isso permite guardar respostas por código de campo na Feature 2.
- **Tamanho = largura na folha**, em uma grade de 12 colunas: **1/3, 1/2, 2/3 ou inteira**. Vale para todos os tipos, exceto **tabela** (sempre inteira). **Texto longo** tem também **altura**: 3, 5 ou 8 linhas.
- **Modelo sem versões na Feature 1.** Na Feature 2, cada consulta guarda uma **cópia da estrutura do modelo** no momento em que foi criada. Assim, editar ou excluir um modelo nunca altera consultas já feitas, e não é preciso versionar modelos.
- **Salvar é explícito** (botão "Salvar", indicador de alterações não salvas, confirmação ao sair com alterações), como no cadastro de paciente. Nada de salvamento automático.
- **Catálogo em arquivo versionado no backend** (não em tabela), validado ao iniciar, como `NutrientReferences`. **Códigos de campo nunca são removidos nem reutilizados**: um campo que sair de uso ganha `deprecated: true` (continua válido em modelos existentes, some da caixa de ferramentas).

## Catálogo de campos

### Tipos

| Tipo | Uso | Configuração no catálogo |
|---|---|---|
| `SHORT_TEXT` | resposta curta | `maxLength` (padrão 200) |
| `LONG_TEXT` | resposta descritiva | `maxLength` (padrão 4000) |
| `NUMBER` | medida ou quantidade | `unit`, `min`, `max`, `decimals` |
| `DATE` | data | — |
| `YES_NO_DETAIL` | sim/não com detalhe opcional em texto | `detailLabel` (ex.: "Quais?") |
| `SINGLE_CHOICE` | uma opção | `options[] {code, label}`, `allowOther` |
| `MULTI_CHOICE` | várias opções | `options[] {code, label}`, `allowOther` |
| `SCALE` | escala numérica inteira | `min`, `max`, `minLabel`, `maxLabel` |
| `TABLE` | linhas preenchidas pelo profissional | `columns[] {code, label}` (texto) |

Cada campo: `code` (snake_case, único), `category`, `label`, `help` (opcional), `type`, configuração do tipo, `sync` (opcional: `PATIENT_WEIGHT` ou `PATIENT_HEIGHT`, usado na Feature 2), `deprecated` (padrão `false`). Opções têm `code` estável além do rótulo.

### Conteúdo (proposta, **a validar com o nutricionista parceiro**)

Nenhuma fórmula ou campo calculado (IMC, % de gordura por dobras etc.): cálculos pertencem ao backend e serão definidos à parte. Listas de opções abaixo são proposta; registrar no HANDOFF que o conteúdo precisa de validação.

**Consulta e rotina (`CONSULTATION`)**
- `consultation_reason` Motivo da consulta · LONG_TEXT
- `patient_goals` Objetivos do paciente · LONG_TEXT
- `occupation` Profissão / ocupação · SHORT_TEXT
- `daily_routine` Rotina de trabalho e estudo · LONG_TEXT
- `lives_with` Com quem mora · SHORT_TEXT
- `meal_preparer` Quem prepara as refeições · SINGLE_CHOICE: o próprio paciente; familiar; funcionário(a); compra pronta; allowOther

**Histórico clínico (`CLINICAL_HISTORY`)**
- `diagnosed_conditions` Doenças diagnosticadas · MULTI_CHOICE: diabetes; hipertensão; dislipidemia; hipotireoidismo; hipertireoidismo; SOP; doença renal; doença hepática; DRGE; síndrome do intestino irritável; doença celíaca; doença inflamatória intestinal; anemia; ansiedade ou depressão; allowOther
- `family_history` Histórico familiar · MULTI_CHOICE: diabetes; hipertensão; dislipidemia; obesidade; doença cardiovascular; câncer; doença da tireoide; doença renal; allowOther
- `medications` Medicamentos em uso · LONG_TEXT
- `supplements` Suplementos em uso · LONG_TEXT
- `surgeries` Cirurgias · YES_NO_DETAIL ("Quais e quando?")
- `food_allergies` Alergias alimentares · YES_NO_DETAIL ("Quais?")
- `food_intolerances` Intolerâncias alimentares · MULTI_CHOICE: lactose; glúten; frutose; allowOther
- `previous_nutrition_care` Acompanhamento nutricional ou dietas anteriores · LONG_TEXT
- `weight_history` Histórico de peso · LONG_TEXT
- `blood_pressure` Pressão arterial · SHORT_TEXT (help: "Ex.: 120/80 mmHg")

**Sinais, sintomas e sono (`SYMPTOMS`)**
- `appetite` Apetite · SINGLE_CHOICE: aumentado; normal; diminuído
- `chewing` Mastigação · SINGLE_CHOICE: adequada; rápida; com dificuldade
- `bowel_frequency` Frequência de evacuação · SINGLE_CHOICE: mais de 1 vez ao dia; 1 vez ao dia; a cada 2 ou 3 dias; menos de 2 vezes por semana
- `stool_bristol` Consistência das fezes (escala de Bristol) · SINGLE_CHOICE: tipo 1 … tipo 7 (rótulos com a descrição curta de cada tipo)
- `gi_symptoms` Sintomas gastrointestinais · MULTI_CHOICE: azia; refluxo; náusea; distensão ou gases; dor abdominal; constipação; diarreia; allowOther
- `water_intake` Consumo de água · NUMBER (L/dia, 0–10, 1 casa)
- `sleep_hours` Horas de sono por noite · NUMBER (h, 0–24, 1 casa)
- `sleep_quality` Qualidade do sono · SCALE 0–10 ("Muito ruim" / "Excelente")
- `stress_level` Nível de estresse · SCALE 0–10 ("Nenhum" / "Extremo")
- `menstrual_cycle` Ciclo menstrual · SINGLE_CHOICE: regular; irregular; ausente; menopausa; não se aplica

**Estilo de vida (`LIFESTYLE`)**
- `physical_activity` Pratica atividade física · YES_NO_DETAIL ("Modalidade, frequência e duração")
- `smoking` Tabagismo · SINGLE_CHOICE: nunca fumou; ex-fumante; fumante
- `alcohol` Consumo de álcool · SINGLE_CHOICE: não consome; ocasionalmente; semanalmente; diariamente

**Hábitos alimentares (`EATING_HABITS`)**
- `dietary_pattern` Padrão alimentar · SINGLE_CHOICE: onívoro; vegetariano; vegano; allowOther
- `meals_per_day` Refeições por dia · NUMBER (0–12, inteiro)
- `eats_out` Refeições fora de casa · SINGLE_CHOICE: nunca; raramente; algumas vezes por semana; diariamente
- `hungriest_time` Horário de maior fome · SHORT_TEXT
- `food_preferences` Preferências alimentares · LONG_TEXT
- `food_aversions` Aversões alimentares · LONG_TEXT
- `binge_episodes` Episódios de compulsão alimentar · YES_NO_DETAIL ("Com que frequência e em que situações?")
- `recall_24h` Recordatório de 24 horas · TABLE: horário; refeição; alimentos e quantidades; local
- `usual_day` Dia alimentar habitual · TABLE: horário; refeição; alimentos e quantidades; local

**Antropometria (`ANTHROPOMETRY`)**
- `weight_kg` Peso · NUMBER (kg, 1–500, 3 casas) · `sync: PATIENT_WEIGHT`
- `height_cm` Altura · NUMBER (cm, 30–300, 2 casas) · `sync: PATIENT_HEIGHT`
- `waist_circumference` Circunferência da cintura · NUMBER (cm, 1 casa)
- `hip_circumference` Circunferência do quadril · NUMBER (cm, 1 casa)
- `arm_circumference` Circunferência do braço · NUMBER (cm, 1 casa)
- `calf_circumference` Circunferência da panturrilha · NUMBER (cm, 1 casa)
- `neck_circumference` Circunferência do pescoço · NUMBER (cm, 1 casa)
- `skinfold_triceps`, `skinfold_biceps`, `skinfold_subscapular`, `skinfold_suprailiac`, `skinfold_abdominal`, `skinfold_thigh`, `skinfold_chest`, `skinfold_midaxillary` Dobra cutânea tricipital / bicipital / subescapular / suprailíaca / abdominal / da coxa / peitoral / axilar média · NUMBER (mm, 1 casa)
- `body_composition_method` Método de avaliação da composição corporal · SINGLE_CHOICE: bioimpedância; dobras cutâneas; DEXA; allowOther
- `body_fat_percent` Percentual de gordura (informado) · NUMBER (%, 1 casa; help: "Valor obtido pelo método informado")

**Exames (`EXAMS`)**
- `lab_results` Exames bioquímicos · TABLE: exame; resultado; unidade; data

**Conduta (`CONDUCT`)**
- `professional_notes` Observações do profissional · LONG_TEXT
- `conduct` Conduta · LONG_TEXT

Limites de NUMBER sem faixa indicada: 0–1000. Os limites são técnicos (evitar digitação absurda), não recomendações clínicas.

### Modelo inicial (proposta, a validar)

Nome: **"Primeira consulta"**. Seções e campos, em ordem (largura entre parênteses; sem indicação = inteira):

1. **Anamnese:** `consultation_reason`, `patient_goals`, `occupation` (1/2), `lives_with` (1/2), `daily_routine`, `meal_preparer` (1/2)
2. **Histórico clínico:** `diagnosed_conditions`, `family_history`, `medications` (1/2), `supplements` (1/2), `surgeries` (1/2), `food_allergies` (1/2), `food_intolerances`, `weight_history`
3. **Sintomas e sono:** `appetite` (1/3), `chewing` (1/3), `bowel_frequency` (1/3), `stool_bristol`, `gi_symptoms`, `water_intake` (1/3), `sleep_hours` (1/3), `sleep_quality` (1/3), `stress_level` (1/2), `menstrual_cycle` (1/2)
4. **Estilo de vida e hábitos:** `physical_activity`, `smoking` (1/2), `alcohol` (1/2), `dietary_pattern` (1/3), `meals_per_day` (1/3), `eats_out` (1/3), `food_preferences` (1/2), `food_aversions` (1/2), `recall_24h`
5. **Antropometria:** `weight_kg` (1/3), `height_cm` (1/3), `waist_circumference` (1/3), `hip_circumference` (1/3), `arm_circumference` (1/3), `calf_circumference` (1/3)
6. **Conduta:** `professional_notes`, `conduct`

## Backend (`nutrition-api`)

Novo pacote **`record`** (prontuário). Endpoints **autenticados** (Bearer), sempre filtrados pelo nutricionista do token.

### Catálogo

- Arquivos versionados em `src/main/resources/records/`: `field-catalog.json` (categorias com ordem e nome; campos) e `starter-template.json` (modelo inicial, só com códigos e larguras).
- `RecordFieldCatalog` lê os dois ao iniciar (Jackson já presente) e **falha a inicialização** se: código repetido ou fora de `^[a-z][a-z0-9_]*$`; tipo desconhecido; configuração incompatível com o tipo (ex.: `options` vazio em escolha, `min > max`, `columns` vazio em tabela); código de opção repetido; `sync` em campo não NUMBER; modelo inicial com código inexistente, repetido, depreciado ou largura inválida.
- Enums Java para tipo, largura, altura e sync. Records imutáveis para o catálogo.

### Esquema (Flyway)

**`V4__create_record_templates.sql`**

```text
record_templates
  id               uuid primary key
  nutritionist_id  uuid not null references nutritionists(id)
  name             varchar(60) not null
  is_default       boolean not null
  created_at       timestamptz not null
  updated_at       timestamptz not null
  version          bigint not null
  -- no máximo um padrão por nutricionista:
  unique index record_templates_default_idx on (nutritionist_id) where is_default

record_template_sections
  template_id    uuid not null references record_templates(id) on delete cascade
  display_order  integer not null
  name           varchar(60) not null
  primary key (template_id, display_order)

record_template_fields
  template_id    uuid not null references record_templates(id) on delete cascade
  field_code     varchar(60) not null      -- código do catálogo (sem FK: o catálogo é arquivo)
  section_order  integer not null          -- display_order da seção
  display_order  integer not null
  width          varchar(12) not null      -- THIRD | HALF | TWO_THIRDS | FULL
  text_rows      integer                   -- só LONG_TEXT: 3 | 5 | 8
  primary key (template_id, field_code)    -- campo no máximo uma vez por modelo
  unique (template_id, section_order, display_order)
```

**Como foi implementado (18/09):** seções e campos são linhas do modelo, sem identidade própria (`@ElementCollection` na entidade `RecordTemplate`), e salvar substitui a estrutura inteira. A chave primária `(template_id, field_code)` garante no banco a unicidade do campo por modelo, que o serviço também valida para devolver o erro com o campo. JPA com `ddl-auto: validate`, como hoje.

### Contrato

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/record-fields` | Catálogo: `categories[] {code, name, fields[]}`; cada campo com `code, label, help, type`, configuração do tipo e `sync`. Campos depreciados **não** aparecem. |
| GET | `/api/record-templates` | Lista do nutricionista: `[{id, name, isDefault, sectionCount, fieldCount, updatedAt}]`, ordenada por padrão primeiro, depois nome. Sem paginação (limite de 30 modelos). |
| POST | `/api/record-templates` | Cria. Corpo `{name, source}` com `source`: `BLANK` (uma seção vazia "Seção 1") ou `STARTER` (cópia do modelo inicial). 201 com o modelo completo. O primeiro modelo do nutricionista vira padrão. |
| POST | `/api/record-templates/{id}/duplicate` | Duplica um modelo próprio com o nome "Cópia de …" (cortado em 60). 201 com o modelo completo. |
| GET | `/api/record-templates/{id}` | Modelo completo: `{id, name, isDefault, version, updatedAt, sections: [{name, fields: [{code, width, textRows}]}]}` (seções e campos na ordem). |
| PUT | `/api/record-templates/{id}` | Substitui nome e estrutura inteira. Corpo `{name, version, sections: [...]}` no mesmo formato. Versão diferente → 409 "O modelo foi alterado em outra sessão. Recarregue." |
| POST | `/api/record-templates/{id}/default` | Torna padrão (o anterior deixa de ser). Retorna o modelo. |
| DELETE | `/api/record-templates/{id}` | Exclui (204). Se era o padrão, o modelo mais recentemente alterado vira padrão. Pode excluir o último. |

Modelo alheio ou inexistente → 404 "Modelo não encontrado.", inclusive em duplicar.

### Validação (400 com `errors` e campo)

- `name`: trim, obrigatório, até 60 caracteres. Nomes repetidos são permitidos.
- `sections`: 1 a 20; `sections[i].name` trim, obrigatório, até 60; seção pode ficar vazia.
- `sections[i].fields[j].code`: existe no catálogo (depreciado é aceito só se já estava no modelo salvo); **não repetido no modelo** → "O campo já está no modelo." em `sections[i].fields[j].code`.
- `width`: um dos quatro; campo `TABLE` exige `FULL`.
- `textRows`: obrigatório e 3, 5 ou 8 em `LONG_TEXT`; ausente (null) nos demais tipos.
- Máximo de 30 modelos por nutricionista → 400 em `name` "Limite de 30 modelos atingido."
- Propriedades desconhecidas → 400, como o resto da API.

### Testes

Catálogo (arquivo real carrega; cada regra de validação com um catálogo inválido de teste), modelo inicial válido, CRUD com isolamento entre nutricionistas (404), padrão único (primeiro vira padrão; trocar; excluir o padrão promove outro), duplicar, PUT com versão errada (409), cada validação acima com o campo em `errors`, campo repetido em seções diferentes, tabela com largura diferente de FULL, `textRows` fora de LONG_TEXT.

## Frontend (`nutrition-web`)

### Rotas e navegação

- Barra lateral ganha **"Prontuário"**, abaixo de Pacientes. Rotas protegidas: `/prontuario/modelos` (lista) e `/prontuario/modelos/:id` (Oficina).
- Novo diretório `app/records/` com componentes próprios, cada um com `.html`; API tipada em `records-api.ts`. Não mexer no planejamento (`app.ts`/`app.html`).

### Lista de modelos

- Cartões com nome, selo "Padrão", número de seções e campos, data da última alteração.
- **Novo modelo** abre um pequeno diálogo: nome + "Começar com" **Modelo inicial** (recomendado, pré-selecionado quando o nutricionista não tem modelos) ou **Em branco**. Criar abre a Oficina.
- Ações do cartão: Abrir, Duplicar (nome "Cópia de …", cortado em 60), Tornar padrão, Excluir (confirmação: "Excluir o modelo X? Consultas já feitas não são afetadas." — a frase vale a partir da Feature 2; até lá, "Excluir o modelo X?").
- Lista vazia: explica o que é a Oficina e oferece criar a partir do modelo inicial.

### Oficina

Área de trabalho **delimitada**: ocupa a altura da janela abaixo do topo, largura máxima de 1440 px, sem rolagem da página (cada coluna rola por dentro). Três colunas:

```text
┌──────────────┬──────────────────────────────────────────────┬──────────────┐
│ Ferramentas  │  [Nome do modelo ✎]   Não salvo · [Pré-visualizar] [Salvar] │
│ [buscar…]    │  ┌ Anamnese ┐ Histórico │ Antropometria │ +             │
│ ▸ Consulta   │  ┌─────────────────────── folha ─────────────────┐ │ Propriedades│
│ ▾ Antropom.  │  │ [Peso  ] [Altura ] [Cintura]                  │ │ Peso        │
│   ⠿ Peso ✓   │  │ [Motivo da consulta ....................... ] │ │ Número · kg │
│   ⠿ Cintura  │  │  solte aqui                                   │ │ Largura     │
│   …          │  └───────────────────────────────────────────────┘ │ ○⅓ ●½ ○⅔ ○1 │
└──────────────┴──────────────────────────────────────────────┴──────────────┘
```

**Caixa de ferramentas (esquerda, ~280 px)**
- Busca por palavras sem acento/caixa (mesma regra do `TextSearch`, aplicada no cliente sobre o catálogo carregado).
- Categorias recolhíveis, na ordem do catálogo; cada campo é um cartão com ícone do tipo, rótulo e alça de arrastar.
- Campo já no modelo: esmaecido com "no modelo" e sem arrastar; clicar nele seleciona e rola até o campo na folha.
- **Enter** ou botão "+" do cartão adiciona o campo **ao fim da seção aberta** (alternativa acessível ao arrastar).

**Folha (centro)**
- Topo: nome do modelo editável no lugar (clique duplo ou ícone de lápis; Enter/sair confirma; Esc cancela; em branco restaura), indicador "Alterações não salvas", **Pré-visualizar** e **Salvar** (desabilitado sem alterações; 409 oferece recarregar).
- **Seções como abas**, com o mesmo comportamento das abas de opção de refeição: clique abre; **clique duplo ou F2 renomeia**; **botão direito** abre o menu Renomear / Mover para a esquerda / Mover para a direita / Excluir seção; arrastar reordena; **"+"** cria "Seção N" já em modo de renomear. Excluir seção com campos pede confirmação e **devolve os campos à caixa de ferramentas**. A única seção não pode ser excluída. Máximo de 20.
- Corpo: grade de 12 colunas; cada campo é desenhado como ficará no preenchimento (rótulo, ajuda, controle desabilitado) na largura escolhida, com alça de arrastar e realce quando selecionado. Seção vazia mostra a área "Arraste campos da caixa de ferramentas para cá".
- **Arrastar e soltar** (`@angular/cdk`): da caixa de ferramentas para a folha (entra na posição solta) e dentro da folha para reordenar. Mover para outra seção: pelo painel de propriedades (campo "Seção") ou pelo menu do botão direito do campo (**Mover para › seção**, **Remover do modelo**). Soltar sobre uma aba de seção **não** é exigido.
- Teclado: campo selecionado aceita **Alt+↑/↓** para reordenar e **Delete** para remover do modelo.

**Propriedades (direita, ~280 px)**
- Com um campo selecionado: rótulo, tipo e categoria (somente leitura), ajuda do catálogo, resumo da configuração (unidade/faixa, opções, colunas), aviso "Sincroniza com o cadastro do paciente" nos campos com `sync`; **Largura** (1/3, 1/2, 2/3, inteira; bloqueada em tabela), **Altura** (3, 5, 8 linhas; só texto longo), **Seção** (seleção) e **Remover do modelo**.
- Sem seleção: dados do modelo (nome, "Padrão" com ação Tornar padrão) e contagem de campos.

**Pré-visualizar**
- Troca a folha pela versão preenchível de todas as seções (abas), com controles habilitados para experimentar; nada é salvo nem enviado. "Voltar à edição" retorna.

**Estado e regras gerais**
- A Oficina trabalha sobre uma cópia local do modelo; **Salvar** envia o PUT completo. Sair (rota ou fechar aba do navegador) com alterações pede confirmação (guard de rota + `beforeunload`).
- Toda validação de negócio vem do backend; o cliente apenas impede o óbvio (campo já usado não arrasta, tabela sem opção de largura). Erros do PUT com campo em `sections[i]…` destacam a seção/campo correspondente.
- **Largura mínima de 1024 px.** Abaixo disso, a Oficina mostra "A Oficina precisa de uma tela maior." com o link para a lista. A lista funciona em qualquer largura.
- Acessibilidade: abas com `tablist`/`tab`; caixa de ferramentas navegável por teclado; anúncio em região `aria-live` ao adicionar, mover e remover campos.

### Testes

Lista (vazia, criar a partir do modelo inicial e em branco, duplicar, padrão, excluir com confirmação), Oficina (adicionar por Enter e por arrastar, campo usado bloqueado, reordenar, mover de seção, largura/altura, tabela sem largura, seções: criar/renomear/reordenar/excluir devolvendo campos, pré-visualizar sem requisição, salvar envia a estrutura esperada, 409, confirmação ao sair com alterações, aviso abaixo de 1024 px).

## Critérios de aceite

- [x] Catálogo carregado e validado ao iniciar; `GET /api/record-fields` sem depreciados.
- [x] V4 aplicada; CRUD de modelos com isolamento, padrão único, duplicar, 409 e validações com campo.
- [x] Modelo inicial criado a partir do arquivo, igual ao descrito nesta especificação.
- [x] Oficina: arrastar da caixa e reordenar, seções como abas (renomear, menu, reordenar, excluir), propriedades de largura/altura/seção, pré-visualização, salvar explícito com aviso ao sair.
- [x] Testes do backend e do frontend cobrindo as regras acima; `mvn test`, `npm test`, `npm run build` passando.
- [x] READMEs e HANDOFF atualizados (épico, contrato, V4, conteúdo do catálogo "a validar com o nutricionista").

## Feature 2 (prévia): prontuário por consulta

Registrado para orientar a Feature 1; será especificado em detalhe depois.

- Consulta pertence a um paciente do nutricionista: data, modelo de origem (referência informativa) e **cópia da estrutura do modelo** (seções, campos, larguras, e a definição de cada campo no catálogo daquele momento).
- Respostas guardadas por `field_code`, com o valor validado pelo tipo do campo no backend.
- Ao abrir uma consulta, o modelo padrão vem pré-selecionado; pode-se escolher outro.
- **Sincronização:** `weight_kg`/`height_cm` preenchidos atualizam `weight_kg`/`height_cm` e `measured_at` do paciente quando a data da consulta for igual ou posterior a `measured_at`. Sexo e idade aparecem no cabeçalho da consulta, lidos do cadastro.
### Decisões do usuário para a Feature 2 (18/09)

1. **Estados:** rascunho → concluída. Durante o atendimento, salva-se parcial. Peso e altura **só sincronizam com o cadastro ao concluir**.
2. **Edição após concluir:** permitida (reabre), **com registro** de quando foi alterada depois de concluída. Sem histórico de versões por enquanto.
3. **Exclusão:** o usuário quer excluir com confirmação, **desde que não haja norma contra**. Há normas: a Lei 13.787/2018 exige guardar o prontuário por no mínimo 20 anos, e o CFN tem resolução sobre registro clínico pelo nutricionista (Resolução CFN nº 594/2017, número a confirmar). **Proposta provisória:** rascunho é excluído de fato; consulta concluída "excluída" sai das telas, mas fica guardada (exclusão lógica). **Confirmar com o nutricionista/CRN** antes de permitir apagar de verdade.
4. **Escopo**, em entregas separadas:
   - **2a:** preencher, salvar rascunho, concluir, reabrir, listar e excluir consultas do paciente, com a sincronização de peso e altura;
   - **2b:** evolução das medidas entre consultas (tabela/gráfico) e consulta anterior lado a lado ao preencher;
   - **2c:** abrir o planejamento alimentar a partir da consulta, já com o paciente escolhido. O plano ainda não é salvo; persistir planos é outro épico.
