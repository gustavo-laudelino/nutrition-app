# HANDOFF — Nutrition App

Atualizado em **18/09/2026**, após implementar a **Oficina de modelos de prontuário** (épico Prontuário, feature 1; [especificação](docs/features/prontuario-oficina.md)). Antes, no mesmo dia: **opções de refeição** e o **modelo genérico de nutrientes com a TACO completa e o relatório de micronutrientes** (ver seção 14). Antes disso (17/09): login de nutricionista e cadastro de pacientes. Testes e builds concluídos; migrações V1–V3 aplicadas no PostgreSQL real e API rodando com o código novo (conferido em 18/09). Falta a conferência no navegador (item 0). A V4 da Oficina **ainda não rodou no banco real**: roda quando o usuário reiniciar a API (item 0a). Planejamento preservado.

Este documento registra o estado entregue, as decisões de desenvolvimento e os cuidados para continuar em outra sessão. Os contratos detalhados estão em [nutrition-api/README.md](nutrition-api/README.md) e [nutrition-web/README.md](nutrition-web/README.md).

## Próxima sessão: pendências (registrado em 17/09/2026)

Em ordem de prioridade. Ler antes de qualquer trabalho novo.

0. **(18/09) Opções de refeição e nutrientes/relatório: implementados** ([opções](docs/features/opcoes-de-refeicao.md), [nutrientes](docs/features/nutrientes-e-relatorio.md)); testes e builds passando; V2/V3 e contrato conferidos num PostgreSQL descartável.

   **(18/09) API atualizada no banco real:** o esquema já está na versão 3 (V1–V3 aplicadas, `JWT_SECRET` configurado na execução do IntelliJ). A API roda pelo IntelliJ (`target/classes`, porta **8081**) com JDK 25; o `JAVA_HOME` do sistema é JDK 21 e não há `mvn` no PATH (usar o Maven 3.9.11 de `~/.m2/wrapper` com `JAVA_HOME` do JDK 25). Chamada real de `/api/diet-calculations` com `options` e `referenceProfile` conferida: 26 nutrientes e referência IOM/FNB.

   **Falta conferir no navegador:**
   - abas de opções;
   - "+" criando opção vazia (alterado em 18/09; antes copiava a aberta);
   - "Definir como principal" e fechar opção;
   - renomear aba (clique duplo, F2 ou menu do botão direito) e o menu do botão direito;
   - barra de fibra;
   - relatório de micronutrientes, com e sem sexo/idade.

   **Validar com o nutricionista:**
   - os valores de referência IOM/FNB;
   - a interpretação dos tokens da TACO (vazio/`*` = não analisado);
   - o valor ilegível `",0,02"` (piridoxina do alimento 373), gravado como não analisado.

0a. **(18/09) Oficina de modelos de prontuário: implementada por Claude** (a pedido do usuário, sem o Codex). [Especificação](docs/features/prontuario-oficina.md); 266 testes backend e 110 frontend passando, builds passando; V4 e o fluxo completo conferidos num PostgreSQL descartável e no navegador.
   - **O usuário precisa reiniciar a API no IntelliJ**, para aplicar a V4 (`record_templates` e as tabelas-filhas) e carregar o catálogo. Durante esta sessão, `mvn test` recompilou `target/classes` com a API rodando: reiniciar resolve.
   - Depois, conferir no navegador: Prontuário → "Começar pelo modelo inicial" → Oficina (arrastar, seções, propriedades, pré-visualizar, salvar).
   - **O catálogo é genérico, a pedido do usuário.** O levantamento aprofundado das perguntas e opções reais será feito depois com o nutricionista. Os códigos de campo são permanentes; retirar um campo é marcá-lo como `deprecated`.
   - Aviso de tamanho: o pacote inicial do web tem 609 kB, acima do aviso de 600 kB. O crescimento vem do planejamento (abas de opção); o prontuário já é carregado sob demanda.

1. **Revisar a entrega do Codex de login e pacientes** contra os critérios de aceite de [docs/features/autenticacao-e-pacientes.md](docs/features/autenticacao-e-pacientes.md), sem alterar código primeiro, e trazer a lista de achados. O usuário já testou no navegador: login, cadastro e pacientes funcionam. Para rodar a API é preciso `JWT_SECRET` (≥ 32 bytes) nas variáveis de ambiente, além de `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`. Se o IntelliJ não encontrar pacotes do Spring Security, recarregar o projeto Maven: o Codex compilou com o repositório temporário `%TEMP%/nutrition-maven-repository`.
2. **Corrigir dois defeitos no formulário de paciente** (`nutrition-web/src/app/patients/patient-form.*`):
   - mensagens de erro por campo só são limpas ao salvar de novo; devem sumir ao editar o campo;
   - campos de data (`type="date"`) aceitam anos absurdos ao digitar (causa do falso "data futura" visto pelo usuário); limitar com `min`/`max` (nascimento ≥ 1900-01-01, datas ≤ hoje).
3. **Documentar o teste `acceptsPastAndCurrentDates`** (em `AuthPatientApiTest`), que cobre datas passadas e de hoje sendo aceitas; o Codex só testava data futura rejeitada. Atualizar a contagem de testes do backend.
4. **Validar no navegador** "Definir composição como meta" e a animação de comemoração (implementados em 16/09, só testados automaticamente).
5. **Commits pendentes do usuário:** entrega do Codex (login e pacientes), o teste do item 3 e esta atualização do HANDOFF.
6. **Decisões antes do próximo épico:**
   - validar estimativa, metas e refeições com o nutricionista parceiro (nenhuma feature está "fechada");
   - ~~modelo genérico de nutrientes~~ **implementado em 18/09** (catálogo `nutrients`, `food_nutrients` com status Tr/NA/não analisado e fonte). Continuam futuras: metas de micronutrientes com mínimo/máximo, UL, outras fontes (USDA/TBCA);
   - depois: plano alimentar persistido vinculado ao paciente (plano como raiz; metas, refeições e porções com cópia dos nutrientes da época).

Forma de trabalho combinada: especificações detalhadas em `docs/features/*.md` para o Codex executar entregas grandes; Claude revisa, corrige e documenta. Decisões que conflitam com regras deste documento são **perguntadas ao usuário** antes.

## 1. Instruções de trabalho que devem ser preservadas

- **Não executar nenhum comando Git**, incluindo consultas. Não criar branch, commit, push, merge, checkout nem alterar configuração Git. O usuário controla o versionamento manualmente.
- Desenvolver passo a passo, validando funcionalidades reais com o nutricionista parceiro.
- Regras nutricionais, fórmulas, validações de negócio, arredondamento e saldos pertencem ao backend.
- Não inventar regras ausentes, fatores automáticos, déficits/superávits ou equivalências entre metodologias.
- Não preservar modelos incorretos apenas por compatibilidade. Refatorar quando houver benefício concreto, sem abstrações especulativas.
- Não usar Lombok nem adicionar dependências sem necessidade técnica real. Se o usuário pedir algo que conflite com esta ou outra regra deste documento, apresentar as opções e **perguntar** antes de decidir. Exceções já decididas pelo usuário: (16/09) `@angular/cdk` 22.1.6 no `nutrition-web`, para arrastar e soltar refeições; (17/09) para login e pacientes, somente `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server`, `flyway-core`, `flyway-database-postgresql`, `spring-security-test` (test) e `@angular/router` 22.1.6 — ver [docs/features/autenticacao-e-pacientes.md](docs/features/autenticacao-e-pacientes.md).
- Executar build e testes após mudanças de código. Atualizar este documento quando contratos ou decisões de domínio mudarem.
- Nunca copiar credenciais de ambiente/IDE para código, documentação, exemplos ou logs.
- Não gerar o JAR (`mvn package`/`verify`) com a API rodando a partir de `target/`: o build sobrescreve o JAR em uso e quebra o processo em execução. Parar a API antes ou usar apenas `mvn test`.

## 2. Método de trabalho: épico e features

O desenvolvimento é organizado por **épico → features**. Tela não é feature: uma tela reúne várias features. Trabalha-se **uma feature por vez**, até fechá-la, antes de avançar.

### Épico atual: Planejamento alimentar

| Ordem | Feature | Pacote / endpoints | Status |
|---|---|---|---|
| 1 | Estimativa energética | `energy` · `POST /api/energy-estimates` | **Em foco** |
| 2 | Metas nutricionais (prescrição + macros) | `targets` · `POST /api/energy-prescriptions/per-kg`, `POST /api/target-calculations` | **Em foco** (após estimativa) |
| — | Catálogo de alimentos | `food` · `GET /api/foods`, `GET /api/foods/{id}` | Fechamento leve (ver abaixo) |
| — | Composição da dieta | `calculation` · `POST /api/diet-calculations` | Refeições implementadas; redesenho amplo adiado |
| 5 | Opções de refeição (abas "Opção 1", "+", só a Opção 1 conta) | `calculation` · `meals[].options[]` | **Implementada (18/09)**, testes/build passando — [especificação](docs/features/opcoes-de-refeicao.md) |
| 4 | Porção pelo nutriente (dimensionar o peso do alimento por C, P, G ou kcal desejados) | `calculation` · `POST /api/portion-quantities` | **Implementada (17/09)**, testes/build passando; validação no navegador pendente de reiniciar a API com o JAR novo — [especificação](docs/features/porcao-por-nutriente.md) |
| 3 | Refeições (parte da composição) | `calculation` · `POST /api/diet-calculations` com `meals` | **Implementada e validada tecnicamente**, com ampliações pedidas pelo usuário em 16/09 (horário, arrastar e soltar, composição como meta) — aguardando validação do nutricionista e merge; [especificação](docs/features/refeicoes.md) |

**Catálogo de alimentos:** (exceção decidida em 17/09 e **executada em 18/09**: esquema de nutrientes no Flyway (V2) e importação reproduzível da TACO (V3, gerada por `tools/taco/generate_taco_migration.py`); `foods` intacta; o resto desta regra continua) o PostgreSQL atual é **temporário**, usado só para fornecer dados reais aos testes da calculadora; outro banco será adotado no futuro. Não investir nele (limpeza de colunas legadas, migrations, pipeline de importação, ajuste de busca). O que deve permanecer estável é o contrato: interface `FoodCatalog` e `FoodResponse` (id, nome, fonte, nutrientes por 100 g). Trocar de banco = nova implementação de `FoodCatalog`. Ponto a decidir quando o novo banco for escolhido: tipo do ID do alimento (hoje `Long`), que afeta `foodId` na composição.

**Composição da dieta:** será uma feature grande, provavelmente um workspace/kanban com liberdade criativa para o profissional. A tela atual existe apenas para testar a calculadora; **o frontend inteiro será reformulado**. Não investir em organização do `nutrition-web` atual além do necessário para testar o backend.

**Paciente:** não é feature deste épico. `PatientContext` é apenas entrada de cálculo e sairá desta tela no futuro. Quando virar entidade, será épico próprio; a estimativa mudará apenas a origem dos dados.

### Épico em foco (17/09): Nutricionista e pacientes

| Ordem | Feature | Status |
|---|---|---|
| 1 | Login de nutricionista (JWT) + cadastro de pacientes (básico + medidas atuais) | **Implementada, testes/build passando; validação integrada pendente por ausência de `JWT_SECRET`** — [especificação](docs/features/autenticacao-e-pacientes.md); ver seção 14 |
| 2 | Paciente cadastrado no planejamento (escolher e editar o cadastro pela calculadora) | **Implementada (17/09), testes/build passando**; validação no navegador com sessão pendente (exige conta do usuário) — [especificação](docs/features/paciente-no-planejamento.md) |
| — | Plano alimentar persistido vinculado ao paciente | Futura; depende de 1 e da decisão do modelo de nutrientes |
| 3 | Modelo genérico de nutrientes + TACO completa + relatório de micronutrientes | **Implementada (18/09)**, testes/build passando, V2/V3 conferidas em PostgreSQL descartável e aplicadas no banco real (18/09) — [especificação](docs/features/nutrientes-e-relatorio.md). Metas de micronutrientes com mínimo/máximo continuam futuras; aplicar ao cálculo **antes** de persistir planos |

Decisões do usuário (17/09): JWT; cadastro aberto; paciente com dados básicos + medidas atuais; PostgreSQL oficial para nutricionistas/pacientes com Flyway; **sem vínculo com a tela de planejamento nesta entrega** (endpoints da calculadora continuam públicos). Dados de saúde são sensíveis (LGPD): apenas pacientes fictícios até haver revisão de segurança e uso real autorizado.

### Épico novo (18/09): Prontuário

| Ordem | Feature | Status |
|---|---|---|
| 1 | Oficina de modelos de prontuário (catálogo de campos do sistema, modelos do nutricionista montados por arrastar e soltar, seções como abas, pré-visualização) | **Implementada (18/09) por Claude**, testes/build passando; V4 pendente no banco real (reiniciar a API) — [especificação](docs/features/prontuario-oficina.md); catálogo genérico e modelo inicial **a validar com o nutricionista** |
| 2 | Prontuário por consulta (histórico datado por paciente, cópia da estrutura do modelo, peso/altura sincronizam com o cadastro) | **Próxima (decisões de 18/09 registradas** na [especificação](docs/features/prontuario-oficina.md), seção "Decisões do usuário para a Feature 2"): rascunho/concluída; reabrir com registro; exclusão lógica da concluída, a confirmar com o CRN; entregas 2a (preencher/concluir/listar), 2b (evolução e consulta anterior) e 2c (abrir o planejamento a partir da consulta). Começar pela especificação detalhada da 2a, **em sessão nova** |

Decisões do usuário (18/09): um prontuário por consulta; vários modelos por nutricionista, com modelo inicial e um padrão; campos só do catálogo do sistema (sem criar campos do zero); o nutricionista ajusta seção, posição e tamanho do campo; peso/altura sincronizam com o cadastro; Oficina como área de trabalho delimitada, com ferramentas ao lado (referência n8n, sem canvas infinito).

### Definição de "feature fechada"

- Regras validadas com o nutricionista, com exemplos reais.
- Contrato da API documentado (endpoints, campos, erros).
- Testes cobrindo as regras e casos de borda.
- Código organizado: nomes coerentes, sem validação duplicada, formatação padrão.
- Mensagens de erro em português.
- Testada no navegador com dados reais.
- Este HANDOFF atualizado, com status "Fechada".
- Merge em `main`.

"Fechada" significa estável e documentada, não congelada: mudanças futuras entram como melhorias conscientes.

### Ciclo por feature

1. **Revisão focada** da feature (regras, contrato, código, testes), gerando lista de pendências, sem alterar código.
2. **Dúvidas de regra** levadas ao nutricionista; nenhuma regra é inventada.
3. **Ajustes** em branch da feature (ex.: `feature/energy-estimate`), em commits pequenos, sem misturar refatoração e mudança de comportamento.
4. **Verificação**: testes automatizados e navegador.
5. **Fechamento**: documentação, merge, status atualizado nesta seção.

Itens transversais (formatação, mensagens em português, formato de erro) são resolvidos uma vez, na primeira feature trabalhada, e não repetidos por feature. Decisões de arquitetura mais profundas (separar domínio/DTO, migrations, OpenAPI, versionamento) ficam para quando a feature que as exige chegar (ex.: persistência de paciente).

## 3. Contexto e direção do produto

Aplicação para nutricionistas e, futuramente, seus pacientes. Há um nutricionista parceiro com a necessidade real e usuários disponíveis para validação; o desenvolvimento também compõe o portfólio do autor.

A direção atual é validar um núcleo coeso em um backend único, organizado por funcionalidades. Não foram criados microsserviços, mensageria ou infraestrutura distribuída apenas para demonstração de portfólio.

**Escopo atual:** ferramenta temporária de planejamento, estimativa energética, prescrição opcional, macros opcionais e composição dos alimentos.

**Existem em código (17/09):** nutricionista, cadastro/login JWT e pacientes persistidos com isolamento por proprietário. Migração e validação integrada aguardam `JWT_SECRET`. **Ainda não existem:** persistência de planejamento/dieta, receitas ou refeições persistidas. A tela de planejamento continua com **planejamento temporário** (refeições e metas não são salvas), mas já **lê o paciente cadastrado**: escolher um paciente preenche `PatientContext` e permite editar o cadastro pela própria tela (17/09). Decisão registrada: a calculadora continua pública por enquanto, mas **no futuro fará parte do acesso do nutricionista**.

## 4. Evolução do entendimento do domínio

1. A primeira calculadora exigia uma meta calórica e distribuição percentual de macros.
2. O domínio foi corrigido para permitir montagem de dieta sem metas, metas parciais e métodos de cálculo opcionais.
3. Na correção anterior, foi explicitado que **estimativa energética e meta prescrita são conceitos diferentes**. A implementação anterior que tratava os métodos de energia como métodos de meta foi substituída.

4. No ajuste de 16/09, DRI passou a ser a estimativa automática padrão; alternativas ficam recolhidas, atividade DRI pertence ao perfil e condição fisiológica foi removida. O MVP será validado com adultos 19+ não gestantes/lactantes. A prescrição continua uma escolha explícita.

A estrutura atual representa quatro responsabilidades:

```text
Dados temporários do paciente + parâmetros próprios do método
                         ↓
                Estimativa DRI automática quando há dados
                         ↓
              Decisão explícita do nutricionista
                         ↓
                  Meta energética prescrita
                         ↓
                   Macros opcionais

Alimentos + quantidades → composição real, mesmo sem qualquer meta
                         ↓
           comparação somente onde existe meta prescrita
```

A razão dessa separação é permitir que os cálculos sejam ferramentas de apoio, sem transformar estimativas em decisões clínicas automáticas ou impedir a composição da dieta.

## 5. Regras centrais vigentes

- DRI/FAO não viram prescrição automaticamente. Fórmula de bolso é prescrição direta: escolher esse método e informar peso/fator preenche a meta com o resultado do backend.
- O nutricionista pode copiar explicitamente a estimativa, digitar outro valor, aumentar/reduzir sua prescrição ou deixá-la vazia.
- Recalcular DRI/FAO **não sobrescreve** a prescrição. No modo bolso, mudar peso/fator recalcula diretamente a meta; mudar objetivo não recalcula nem substitui uma edição manual.
- Objetivo (`WEIGHT_LOSS`, `MAINTENANCE`, `WEIGHT_GAIN`) é contexto; não participa da matemática.
- O perfil contém `patient.driActivity`, específico da DRI. FAO exige `faoPal` próprio: não reutiliza nem converte a categoria DRI.
- Diferença energética = prescrição − estimativa de referência, sem interpretar automaticamente o motivo.
- Percentuais exigem a **meta prescrita**, não apenas uma estimativa; soma exatamente 100%, com 4/4/9 kcal/g.
- Ausência de meta é `null`; macro com meta zero é diferente de ausência. Sem meta não há restante. Restante negativo é válido.
- Composição usa os nutrientes da base por 100 g, proporcionalmente à quantidade. Kcal da fonte não são reconstruídas a partir dos macros.
- **Composição como meta (16/09, decisão do usuário):** ação explícita "Definir composição como meta" no resumo do dia. A meta energética recebe o total de kcal consumidas do dia; as metas de macros passam a `PERCENTAGE`, com percentuais proporcionais à energia de cada macro pela conversão 4/4/9 kcal/g (C×4, P×4, G×9 sobre a soma), 4 casas decimais e o resíduo do arredondamento somado à maior fatia para totalizar exatamente 100. A barra de energia fica em 100%; as de macros ficam próximas de 100% (não exatas), porque as kcal da tabela de alimentos diferem da soma 4/4/9 — limitação aceita pelo usuário. Se já houver meta, a substituição exige confirmação. Sem kcal ou sem macros consumidos, o backend rejeita com 400.
- **Distribuição dos macros (17/09):** a mesma regra 4/4/9 (`targets/MacroEnergyShares`, compartilhada com a composição como meta) gera `macroEnergyShares` na resposta de `/api/diet-calculations`, exibida no donut do resumo. Calculada no backend; o Angular não aplica 4/4/9.

## 6. Métodos energéticos implementados

### DRI 2023

Equações padrão para adultos **19+**, com peso em kg, altura em **cm**, idade e sexo. A categoria seleciona diretamente uma equação de EER; não há TMB intermediária nem multiplicador posterior de atividade. Conforme a regra fornecida, em adultos com peso estável o EER equivale ao TEE estimado.

Categorias: `INACTIVE` (PAL 1,00 a <1,53), `LOW_ACTIVE` (1,53 a <1,68), `ACTIVE` (1,68 a <1,85), `VERY_ACTIVE` (1,85 a <2,50).

Equação: **constante − coeficiente da idade × idade + coeficiente da altura × altura + coeficiente do peso × peso**.

| Sexo | Categoria | Constante | Idade | Altura | Peso |
|---|---|---:|---:|---:|---:|
| Masculino | INACTIVE | 753.07 | 10.83 | 6.50 | 14.10 |
| Masculino | LOW_ACTIVE | 581.47 | 10.83 | 8.30 | 14.94 |
| Masculino | ACTIVE | 1004.82 | 10.83 | 6.52 | 15.91 |
| Masculino | VERY_ACTIVE | -517.88 | 10.83 | 15.61 | 19.11 |
| Feminino | INACTIVE | 584.90 | 7.01 | 5.72 | 11.71 |
| Feminino | LOW_ACTIVE | 575.77 | 7.01 | 6.60 | 12.14 |
| Feminino | ACTIVE | 710.25 | 7.01 | 6.54 | 12.34 |
| Feminino | VERY_ACTIVE | 511.83 | 7.01 | 9.07 | 12.56 |

### FAO/WHO/UNU

Neste MVP, para adultos **19+**, calcula TMB e depois **TMB × PAL informado**. Não arredondar TMB antes da multiplicação.

| Faixa implementada | Masculino | Feminino |
|---|---|---|
| 19 ≤ idade < 30 | 15.057 × peso + 692.2 | 14.818 × peso + 486.6 |
| 30 ≤ idade < 60 | 11.472 × peso + 873.1 | 8.126 × peso + 845.6 |
| idade ≥ 60 | 11.711 × peso + 587.7 | 9.082 × peso + 658.5 |

**60 anos pertence a 60+**, conforme a última correção. Isso substitui a convenção do sprint anterior que incluía 60 em 30–60.

PAL é numérico, escolhido pelo profissional, entre 1,40 e 2,40, com até duas casas decimais. Classificação do valor informado: 1,40–1,69 sedentário/leve; 1,70–1,99 ativo/moderado; 2,00–2,40 vigoroso. As duas casas preservam os intervalos fornecidos sem atribuir silenciosamente uma categoria a valores como 1,695. O sistema não escolhe um PAL a partir da categoria ou do objetivo.

A equação 10–18 foi fornecida, mas **não é usada com PAL adulto**: não extrapolar o fluxo adulto a menores sem regras específicas.

### Bolso e prescrição manual

Bolso = peso × `kcalPerKg` explicitamente informado. As faixas exibidas são orientativas e não limitam ou escolhem o fator automaticamente. Resultado define diretamente a meta prescrita no backend; não é uma estimativa. A escolha do método/fator é a decisão profissional. O bloco de estimativa mostra apenas fator e troca de fórmula, sem cartão de resultado, comparação ou botão de aplicar. O campo de meta permanece editável; uma edição manual cancela cálculo pendente. Alterar peso/fator limpa o resultado anterior e recalcula. Erros ficam no bloco de meta prescrita. Ao voltar a DRI/FAO a última meta é preservada.

Prescrição manual é um valor positivo em kcal/dia, independente de qualquer estimativa.

### Condições não cobertas

Condição fisiológica foi removida do formulário, DTO e validações deste MVP. O público de validação é restrito a adultos 19+ não gestantes/lactantes; não há suporte ou triagem dessas condições no sistema. Sexo não informado também é rejeitado quando necessário à equação. Idade máxima 130 é limite técnico da API, não declaração de cobertura clínica.

As equações vieram do documento de correção fornecido pelo usuário. A entrega implementa essas regras; não representa auditoria clínica independente das referências.

## 7. Macronutrientes

- `NONE`: sem metas.
- `PERCENTAGE`: carboidrato/proteína/gordura não negativos, total exato 100%, sobre prescrição positiva. Conversão 4/4/9.
- ~~`MANUAL`~~ (gramas digitados) e ~~`PER_KG`~~ (g/kg, fórmula de bolso de macros): **removidos em 16/09** por decisão do usuário; metas de macros são apenas ausentes ou percentuais. `/api/target-calculations` não aceita mais `patient`. Não restaurar sem nova definição.

**Interface (16/09):** o painel de macros oferece apenas "Sem metas" e "Percentual". Campos exibem como sugestão as faixas DRI/AMDR para adultos — carboidratos 45–65%, proteínas 10–35%, gorduras 20–35% — **apenas como referência**, sem validação nem bloqueio.

Não há carboidrato por diferença, fatores automáticos ou ajuste da prescrição. Os campos numéricos são limpos ao trocar o método na interface. A composição da dieta continua aceitando metas parciais em `targets`.

## 8. Stack e organização

Backend em `nutrition-api`: Java 25, Spring Boot 4.1.1, Maven, JAR; package `com.nutritionapp` e group Maven `com.gustavo`. Dependências: Web MVC, Data JPA, Validation, PostgreSQL e starter de testes com escopo test. Adicionadas somente as autorizadas: Security, OAuth2 Resource Server, `flyway-core`, `flyway-database-postgresql` e `spring-security-test` (test).

| Package | Responsabilidade |
|---|---|
| `patient` | Cadastro persistido (`Patient`, DTOs, repository, serviço, controller); `PatientContext` temporário preservado |
| `nutritionist` | Entidade e repository do nutricionista |
| `auth` | Cadastro/login, JWT HS256 e segurança stateless |
| raiz `com.nutritionapp` | `DatabaseMigrationConfiguration` (Flyway explícito; ver seção 11) |
| `energy` | `EnergyEstimator`, equações separadas DRI/FAO, request/response e controller |
| `targets` | `TargetCalculator`, `MacroTargetCalculator`, `PerKgPrescriptionCalculator`, prescrição e macros opcionais |
| `calculation` | `DietCalculator`, porções, totais e saldos; opções de refeição (só a Opção 1 conta); `DayNutrientCalculator` (fibra e micronutrientes do dia com referência); refeições temporárias com `MealRequest`/`CalculatedMeal`; alimentos do dia carregados em uma única chamada (`FoodCatalog.findAllById`) |
| `food` | Entidade/repository e catálogo somente leitura; `FoodCatalog.nutrientDefinitions()` e `nutrientsOf(ids)` (18/09, uma consulta por dia) |
| `nutrient` | Modelo genérico de nutrientes (18/09): entidades `Nutrient`/`FoodNutrient`, `NutrientStatus`, `NutrientCode` (códigos e unidades iguais à semente do V2), `NutrientReferences` (RDA/AI IOM/FNB do CSV versionado, validado ao iniciar) |
| `shared` | `DecimalPrecision`, erro de cálculo com campo e `TextSearch` (busca por palavras sem acento/caixa, usada por alimentos e pacientes) |
| `api` | Tradução de erros para ProblemDetail; `ApiFailure` (erro esperado com status e campo opcional, usado por auth, pacientes e prontuário) |
| `record` | Prontuário (18/09): `RecordFieldCatalog` (catálogo e modelo inicial em `resources/records/*.json`, validados ao iniciar), `TemplateStructureRules`, entidade `RecordTemplate` (seções e campos como `@ElementCollection`), serviço e controller |

Frontend em `nutrition-web`: Angular 22.1.6, TypeScript 6, RxJS; CLI 22.1.8 utiliza Vite no desenvolvimento. Não há Vite separado nem biblioteca visual. Router 22.1.6 adicionado; `Shell`, `routes.ts`, `auth/` e `patients/` isolam as telas novas, cada componente com template `.html` próprio; `api-errors.ts` e `account.css` (estilo das telas de conta/pacientes) ficam na raiz de `app/`. Planejamento (`app.ts`, `app.html`, `styles.css`, `app.spec.ts`) não foi alterado nesta entrega. `api.ts` contém contratos tipados; `app.ts`, `app.html` e `styles.css` implementam o fluxo com formulários reativos e signals.

Foi removido `EnergyTargetCalculator` e o antigo objeto `energy` de definição de metas. Não restaurar esses conceitos. Parâmetros desconhecidos são rejeitados, em vez de ignorados silenciosamente.

## 9. Contratos HTTP finais

### Auth e pacientes (17/09)

- `POST /api/auth/register`: nome/e-mail/senha → 201 com token e perfil; e-mail normalizado e duplicado → 409 com campo `email`.
- `POST /api/auth/login`: e-mail/senha → token Bearer, expiresAt e nutritionist{id,name,email}; credenciais incorretas → 401 genérico.
- `GET /api/auth/me`: perfil autenticado. JWT HS256, sub UUID/name/iat/exp, 8 horas; segredo no ambiente. Sem refresh/revogação. Logout apenas descarta o token.
- `GET /api/patients?name=&archived=false&page=0&size=20`: `{content,page,size,totalElements,totalPages}`, busca AND sem acento/caixa, ordenação nome/id, tamanho 1–100. Filtra proprietário e situação em todas as consultas.
- `POST /api/patients` → 201; `GET/PUT /api/patients/{id}`; `POST /api/patients/{id}/archive` e `/unarchive` retornam o paciente. Sem DELETE.
- Campos, limites e respostas documentados no README da API e na especificação. Idade calculada no backend, sem restrição 19+ no cadastro. PUT exige versão; conflito → 409. Paciente alheio ou inexistente → 404, inclusive nas ações.
- Senhas de cadastro: 8–72 caracteres, respeitando também limite técnico BCrypt de 72 bytes UTF-8 (400 explícito, sem truncamento). Login com senha errada curta também retorna 401 genérico.
- `401/403` usam ProblemDetail com `errors`. Nenhum logging novo de senha/token/dados de paciente.

### Prontuário: modelos (18/09, autenticados)

`GET /api/record-fields` (catálogo sem depreciados); `GET/POST /api/record-templates` (lista; criar com `{name, source: BLANK|STARTER}`); `GET/PUT /api/record-templates/{id}` (PUT substitui nome e estrutura, exige `version`, 409 em conflito); `POST /{id}/duplicate`; `POST /{id}/default`; `DELETE /{id}`. Os detalhes e as regras de validação estão no [README da API](nutrition-api/README.md) e na [especificação](docs/features/prontuario-oficina.md).

### Calculadora (continua pública)

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/foods?name=&page=0&size=20` | Catálogo paginado |
| GET | `/api/foods/{id}` | Nutrientes por 100 g |
| POST | `/api/energy-estimates` | Estimativa independente |
| POST | `/api/energy-prescriptions/per-kg` | Meta direta por peso × kcal/kg |
| POST | `/api/target-calculations` | Prescrição explícita, diferença e macros |
| POST | `/api/target-calculations/from-composition` | Converte os totais consumidos do dia em meta energética e percentuais de macros |
| POST | `/api/diet-calculations` | Composição e comparação opcional |
| POST | `/api/portion-quantities` | Peso da porção que entrega a quantidade desejada de um nutriente (17/09) |

Exemplo de estimativa:

```json
{
  "patient": {"weightKg":80,"heightCm":175,"age":30,"sex":"MALE","goal":"WEIGHT_LOSS","driActivity":"ACTIVE"},
  "method":"DRI_2023"
}
```

Retorna `estimatedKcal: 3093.72`, método e atividade, sem campo de prescrição. Para FAO use `method: FAO` e `faoPal`; para bolso, use `POST /api/energy-prescriptions/per-kg` com `weightKg` e `kcalPerKg`, retornando `prescribedEnergyKcal`. `PER_KG` foi removido do contrato de estimativas. Parâmetros de outra metodologia são rejeitados.

Exemplo de decisão profissional:

```json
{
  "prescribedEnergyKcal":2000,
  "referenceEstimateKcal":3093.72,
  "macros":{"method":"PERCENTAGE","carbohydrate":50,"protein":20,"fat":30}
}
```

Retorna `prescription` com diferença -1093.72, `macros` resolvidos e `targets` com 2000 kcal, 250 g de carboidratos, 100 g de proteína e 66.67 g de gordura.

`referenceEstimateKcal` é um valor resolvido transportado pelo cliente apenas para comparação. Não é uma estimativa persistida/auditada e não reexecuta sua fórmula. Referência sozinha nunca gera prescrição. Se houver futura persistência/auditoria, definir como vincular método, parâmetros, versão da equação e decisão profissional.

Composição aceita `meals` obrigatório e `targets` diário opcional. `foods` antigo na raiz é rejeitado com 400. Cada refeição contém `name` (trim, obrigatório, não branco, até 60 caracteres) e **`options` (17/09) de 1 a 5, cada uma com `foods`** obrigatório com IDs/quantidades; `foods` direto na refeição é rejeitado (propriedade desconhecida). Até 20 refeições e 500 porções somadas no dia, **contando todas as opções**; nomes e alimentos repetidos são permitidos. Dia vazio, refeição com opção vazia e opção vazia são válidos.

Resposta `meals` mantém a ordem do pedido, com `name`, `totals` simples (`NutritionValues`) **da Opção 1** e `options[]` (cada uma com porções calculadas e `totals`), sem metas por refeição. **Só a Opção 1 de cada refeição conta para o dia** (regra no backend, `DietCalculator`): `totals` na raiz compara o dia com as metas em `Balance`: `target`, `consumed`, `remaining`; target/remaining são null sem meta. Total diário usa as porções exatas das opções 1, nunca totais arredondados de refeições. Soma de totais exibidos pode diferir em centésimos do total do dia. Erros usam `meals[1].name`, `meals[0].options`, `meals[0].options[1].foods[2].quantityG`; limite total de porções usa `meals`. Exemplos em `nutrition-api/examples` usam fixtures sintéticas dos testes: não interpretar os IDs/valores como dados TACO.

**Nutrientes do dia (18/09):**
- **Pedido:** `referenceProfile` opcional `{sex: FEMALE|MALE, age}`.
  - Sem perfil completo, com `UNSPECIFIED` ou idade < 19, não há referência e não há erro.
  - Idade > 130 → 400 em `referenceProfile.age`.
- **Resposta:** ganha `nutrients[]` (`code, name, unit, category, inReport, consumed, status COMPLETE|PARTIAL|NO_DATA, foodsWithoutData, reference{amount, type RDA|AI, percent}`) e `referenceSource{name, profile}`, que é `null` sem perfil coberto.
- **Soma:** só as Opções 1; exata e arredondada a 2 casas no fim.
  - Tr e NA contam 0; não analisado ou sem registro → `PARTIAL`; nenhum dado → `NO_DATA` com `consumed` nulo.
  - `percent` com 1 casa. Fibra vem com `inReport: false`. Refeições não têm micros.
- Detalhes em [nutrition-api/README.md](nutrition-api/README.md).

Correção posterior em 16/09: bolso passou de estimativa para prescrição direta. Esta regra substitui expressamente a interpretação anterior de exigir o botão de aplicar também para bolso.

## 10. Estados da interface

**Prontuário (18/09):** "Prontuário" na barra lateral; `/prontuario/modelos` (lista) e `/prontuario/modelos/:id` (Oficina), protegidas e carregadas sob demanda. A Oficina é uma área delimitada em três colunas: ferramentas, folha com seções em abas e propriedades. Salvar é explícito, e sair com alterações pede confirmação. Abaixo de 1024 px aparece só um aviso. Detalhes no [README do web](nutrition-web/README.md).

**Telas novas (17/09):** `/login`, `/cadastro`; `/perfil`, `/pacientes`, `/pacientes/novo`, `/pacientes/:id` protegidas. **Barra lateral esquerda** (17/09, decisão do usuário) em todas as telas do nutricionista, com Perfil (dados da conta, somente leitura), Pacientes e Planejamento alimentar, nome do nutricionista e Sair; aparece só com sessão (sem sessão o planejamento abre sem barra) e vira barra superior abaixo de 860 px. `/` redireciona para `/planejamento`. O planejamento **é mantido em memória ao navegar pela barra** (`PlanningReuseStrategy`), mas não é salvo: recarregar descarta, e sair ou trocar de conta descarta o planejamento guardado. Busca busca com debounce 250 ms, ativos/arquivados, paginação, formulário Dados pessoais/Medidas atuais, salvar explícito e confirmação de arquivamento/reativação. 409 exige recarregar. Token em memória/sessionStorage; interceptor restrito à própria origem e às rotas protegidas da API. Guard e 401 redirecionam a login. `/planejamento` continua público por enquanto (direção: fará parte do acesso do nutricionista).

**Planejamento preservado:**

- Paciente e configurações de estimativa/prescrição/macros ficam nos painéis laterais da interface atual. O resumo diário usa a análise com barras e donut (17/09). Essas decisões do trabalho com outro modelo foram preservadas.
- Refeições começam vazias, com seis atalhos e nome livre. Cada refeição é uma linha retrátil em grid de colunas compartilhado: `[alça] horário | nome | itens/peso/ação | C | P | G | kcal | remover`. Recolhida mostra só o resumo; o botão "N itens" abre/fecha. Campos editáveis (horário, nome, peso) têm fundo branco e borda; valores só de leitura não têm borda. Renomear clicando no nome. Reordenar arrastando pela alça (`@angular/cdk`, decisão do usuário) ou com ↑/↓ na alça. Exclusão com alimentos pede confirmação; refeição vazia é excluída diretamente.
- **Horário da refeição (16/09, decisão do usuário):** campo opcional HH:mm em 24 h (máscara própria, sem AM/PM), apenas na tela: **não é enviado à API** nem ordena as refeições.
- **Resumo do dia (17/09, pedido do usuário a partir de uma referência visual; substitui os anéis concêntricos de 16/09):** barra de valor energético no topo ("consumido / meta kcal", restante e % da meta); abaixo, donut com a distribuição da energia dos macros (`macroEnergyShares` do backend) cercado por um anel dividido em um trecho por macro (tamanho = proporção das `energyKcal` de cada meta vinda do backend), com trilho claro que enche em cor forte conforme consumido / meta ("total carregado"; tom mais forte quando excede; neutro sem metas), legenda C/P/G em % (título com a % da meta); ao lado, uma barra por macro com ícone, "consumido / meta g" e restante. Barras param na meta; excedente pinta a barra em tom forte e mostra "Acima da meta em X". **Destaque (17/09, pedido do usuário):** passar o mouse ou dar foco (teclado, `tabindex`) em uma barra de macro — ou passar o mouse na fatia/arco correspondente — destaca aquele macro (fatia maior, demais clareadas) e abre uma descrição com consumido, % da energia dos macros, meta, % da meta e restante. A descrição **segue o cursor** (posição fixa, presa dentro da janela, sem capturar o mouse); com o teclado, sem cursor, fica ancorada sob o donut. Só macros; a linha de energia não entra no donut. Paleta em variáveis CSS; em 17/09 o usuário **voltou às cores de referência anteriores**: `--energy` verde, `--carb` azul, `--protein` vermelho, `--fat` amarelo, aplicada também às bolinhas das refeições e ao cartão de metas de macros. Coluna do resumo passou de 340 para 360 px. Fibra alimentar entrou em 18/09 como barra própria, comparada com a referência (ver "Fibra e relatório de micronutrientes"). Botão "Definir composição como meta": ação explícita "Definir composição como meta" no resumo do dia. A meta energética recebe o total de kcal consumidas do dia; as metas de macros passam a `PERCENTAGE`, com percentuais proporcionais à energia de cada macro pela conversão 4/4/9 kcal/g (C×4, P×4, G×9 sobre a soma), 4 casas decimais e o resíduo do arredondamento somado à maior fatia para totalizar exatamente 100. A barra de energia fica em 100%; as de macros ficam próximas de 100% (não exatas), porque as kcal da tabela de alimentos diferem da soma 4/4/9 — limitação aceita pelo usuário. Se já houver meta, a substituição exige confirmação. Sem kcal ou sem macros consumidos, o backend rejeita com 400. Ao aplicar, quando essa meta volta do backend com restante zero, há uma animação comemorativa (barras e donut de 0 ao valor, kcal contando, donut tremendo e confetes), desativada com "reduzir movimento".
- A busca de alimentos fica **dentro de cada refeição** (não há catálogo global): o botão "+ Adicionar alimento" do cartão abre a busca naquela refeição, com uma busca aberta por vez; criar uma refeição já abre sua busca. Nome de refeição nunca é enviado vazio: "Nova refeição" fica desabilitado sem nome, e ao apagar o nome de uma refeição o último nome válido continua sendo enviado e é restaurado ao sair do campo (correção de 16/09).
- Quantidade recalcula ao confirmar (sair do campo/Enter); nome não recalcula; demais ações recalculam imediatamente.
- **Porção pelo nutriente (17/09, pedido do usuário; diferencial do produto):** na linha do alimento, os chips de **C, P, G e kcal** são clicáveis quando o alimento tem aquele nutriente (valor por 100 g > 0); o chip vira campo com o valor atual, **Enter/sair** confirma e **Esc** cancela (vazio, ilegível ou igual ao atual cancelam sem requisição). O backend (`POST /api/portion-quantities`, público) calcula **peso = quantidade × 100 ÷ valor por 100 g, arredondado a 0,1 g HALF_UP** (decisão do usuário) e o peso é aplicado como uma edição de quantidade comum — a porção continua guardada em gramas. Alimento sem o nutriente → 400 em `nutrient`; peso < 0,1 g ou acima do limite de porção → 400 em `amount`; mensagens em português, exibidas no próprio chip (vermelho + título + leitor de tela) sem alterar a porção. O Angular não calcula o peso.
- **Quantidade inválida (17/09, decisão do usuário):** 0 g continua inválido no backend (mensagem "Informe uma quantidade maior que zero."). Quando a API rejeita só quantidades de porções, a tela marca a porção (campo vermelho, linha translúcida, mensagem no título/leitor de tela), recalcula o restante do dia sem ela e mantém os totais; a marcação sai ao editar a quantidade ou remover o alimento. Outros erros continuam bloqueando o cálculo inteiro. Campo de quantidade apagado (ou ilegível) restaura o último valor ao sair, sem requisição. Corrige o defeito em que zerar um alimento apagava todos os valores da dieta. Cada nova requisição cancela a anterior. Totais por refeição e do dia vêm exclusivamente da API.
- DRI é o método inicial automático, calculado após preencher sexo, idade, peso, altura e atividade DRI. Enquanto faltam dados, não são disparados erros automáticos. A prescrição manual continua disponível.
- O botão discreto **Calcular estimativa energética com outra fórmula** revela a seleção FAO/bolso e permite voltar à DRI. O seletor começa recolhido; nenhum PAL ou fator é inferido.
- A categoria DRI fica no perfil e seleciona uma equação; não é um multiplicador. As oito equações foram conferidas com o pedido de 16/09 e já coincidiam com ele.
- Botão **Usar estimativa como meta** é a ação explícita de transferência. Editar a estimativa não atualiza esse campo automaticamente.
- Diferença entre prescrição e estimativa vem do backend, assim como macros e saldos.
- Estimativa, metas e composição têm requisições e erros independentes. Falha na estimativa permite continuar com prescrição manual e alimentos.
- **Regra de atualização (16/09, decisão do usuário):** só a busca de alimentos consulta a cada letra (debounce 200 ms). Os demais campos digitados (paciente, PAL, kcal/kg, meta, percentuais, quantidades) só enviam requisição ao **confirmar**: sair do campo, Enter ou "Concluir"/fechar o painel; seletores confirmam na escolha. Renomear refeição não recalcula (o nome não altera nutrientes). Enquanto recalcula, os **últimos valores permanecem na tela** e são substituídos pela resposta; só são retirados em erro ou quando as entradas ficam incompletas. Substitui a regra anterior de retirar comparações a cada alteração, que causava piscar a cada tecla.
- Busca: resultados recolhidos quando vazia, debounce 200 ms e cancelamento de consultas anteriores. Pesquisa por palavras AND, sem acento/ordem/caixa; `file frango` encontra `Frango, filé, à milanesa`. Não há fuzzy search ou sinônimos.
- Quantidades: porção inicial de 100 g; edição recalcula ao confirmar. Estimativa/metas aguardam 300 ms após a confirmação (agrupa mudanças simultâneas). Nenhuma fórmula nutricional no Angular.
- **Paciente cadastrado no planejamento (17/09, decisões do usuário):** o botão **Paciente** do topo abre um **menu suspenso compacto logo abaixo dele, só com busca e nomes** dos pacientes ativos do nutricionista (20 primeiros, debounce 250 ms, escolhido marcado, lista vazia oferece cadastrar); escolher, clicar fora ou Esc fecham. Sem sessão, o menu só oferece Entrar. Os **dados do paciente e o Objetivo** ficam no painel lateral **"Dados do paciente"** (o botão próprio no topo foi **removido a pedido do usuário em 17/09**; hoje o painel só abre pelo aviso "Abrir paciente" da estimativa, quando faltam dados — ponto de acesso a redefinir): com paciente escolhido os campos vêm do cadastro em **somente leitura**, com **Editar** (grava com `PUT /api/patients/{id}` o paciente inteiro, preservando telefone, e-mail, observações, nascimento e data das medidas, com `version`; 409 oferece recarregar) e **Desvincular** (volta aos dados livres mantendo os valores); sem paciente escolhido, o painel é o preenchimento temporário de antes. Escolher preenche nome, sexo, peso, altura, atividade DRI e **idade calculada pelo backend** (`ageYears`); objetivo é só da tela. **Idade < 19:** estimativa automática não é disparada e a tela explica; prescrição manual, macros e composição seguem normais. Nenhum plano é persistido.
- **Fibra e relatório de micronutrientes (18/09, decisões do usuário; [spec](docs/features/nutrientes-e-relatorio.md)):**
  - **Fibra:** barra no card de análise, depois de C/P/G, na cor `--fiber` (verde-água). Mostra consumido / referência, "% da referência (AI)" ou "Sem referência", e fica fora do donut.
  - **Relatório "Micronutrientes":** abaixo do card, na mesma coluna, com recolher/expandir.
    - Grupos Minerais, Vitaminas e Lipídios.
    - Cada linha: consumido / referência, barra de 0 a 200% com linha tracejada na referência e "›" acima de 200%.
    - `*` com "Sem dado em N alimentos" nos totais parciais; "—" sem dado.
    - Rodapé com a fonte, o perfil e "a validar com o nutricionista".
    - Sem perfil: "Informe sexo e idade do paciente para comparar com a referência."
  - `referenceProfile` sai do sexo/idade do perfil do planejamento (digitado ou do paciente cadastrado); mudar sexo/idade recalcula.
  - A coluna lateral (card + relatório) é `sticky` com rolagem própria a partir de 861 px.
  - Nenhum cálculo no Angular além de posições de desenho. Com API antiga (sem `nutrients`), o relatório fica vazio sem erro.
- **Opções de refeição (17/09, decisões do usuário; [spec](docs/features/opcoes-de-refeicao.md)):** no corpo da refeição aberta, canto superior esquerdo, abas **"Opção 1"**, **"Opção 2"**… e **"+"**, que cria uma **opção vazia** e a abre (18/09, decisão do usuário; antes criava uma cópia da opção aberta); até 5 (o "+" desabilita). **Só a Opção 1 conta** para meta, macros, saldos, donut, "Definir composição como meta" (e fibra/micronutrientes), regra aplicada pelo backend; a aba 1 tem o selo "conta na meta" quando há mais de uma. Ao abrir outra opção aparece a linha "Totais da Opção N" (C/P/G/kcal do backend) com "não conta na meta". **Tornar opção 1** move a opção aberta para o início (as outras seguem na ordem); **Remover opção** existe quando há mais de uma, pede confirmação se tiver alimentos (removendo a 1, avisa que a Opção 2 passa a contar) e as abas renumeram. A linha resumida (recolhida ou não) mostra sempre a Opção 1 — valores e "N itens" — com o selo "+N opções" junto ao nome. Buscar/adicionar, remover alimento, quantidade, porção pelo nutriente e marcação de porção inválida atuam na opção aberta. Excluir refeição pede confirmação se **qualquer** opção tiver alimentos. Nome e horário são da refeição. Acessível: `tablist`/`tab`/`tabpanel`, `aria-selected`, ←/→ trocam de aba. Opções não são salvas (como todo o planejamento). **Visual de abas de navegador (18/09, pedido do usuário):**
- As abas ficam no topo da refeição aberta. A aba ativa se funde com a "folha" dos alimentos, com cantos côncavos, e há separadores entre as abas inativas.
- Cada aba tem **×** para fechar, e o **+** fica logo depois da última.
- Botão do meio do mouse ou Delete (com a aba em foco) também fecham.
- Aba vazia fecha na hora. Aba com alimentos é aberta e pede confirmação ("Fechar a Opção N e seus alimentos?"). A única opção não tem ×.
- **Arrastar uma aba reordena as opções** (Angular CDK). A que ficar em primeiro passa a contar na meta. "Definir como principal" (antes "Tornar opção 1") continua como atalho à direita.
- **Renomear e menu da aba (18/09, pedido do usuário):** clique duplo ou F2 renomeiam a aba no lugar (Enter/sair salva, Esc cancela, até 30 caracteres; em branco volta a "Opção N", que segue a posição). O botão direito abre o menu Renomear / Definir como principal / Fechar opção. O nome é só da tela, não vai para a API, e passa a ser usado em "Totais de …" e na confirmação de fechar.
- A Opção 1 tem um ponto verde ("conta na meta").
- O botão "Remover opção" foi substituído pelo ×.
- Recarregar a página descarta tudo; não há localStorage ou persistência do planejamento.

## 11. Banco e dados

**Catálogo temporário** (ver seção 2): PostgreSQL 16 local, banco `nutrition_app`, tabela `public.foods`, 544 alimentos TACO conforme validação anterior. `foods` não é alterada.

**Nutrientes (18/09):**
- **V2** (`V2__create_nutrient_model.sql`) cria:
  - `nutrients`: semente de 26 nutrientes, com ordem e `in_report`;
  - `food_nutrients`: PK `(food_id, nutrient_code)`, FK para `foods` e `nutrients`, checks de status e de `amount` quando `VALUE`.
- **V3** (`V3__import_taco_4ed_nutrients.sql`, ~538 KB) é **gerada** por `tools/taco/generate_taco_migration.py` (só biblioteca padrão; ver [tools/taco/README.md](tools/taco/README.md)).
  - Casa por `source = 'TACO'` e `source_code::text` igual ao número do alimento.
  - Estatísticas da planilha: 597 alimentos (423 com ácidos graxos) e 14.652 linhas. Status: VALUE 10.212, TRACE 1.939, NOT_APPLICABLE 881, NOT_ANALYZED 1.620.
  - Nos 548 alimentos prontos do CSV de carga: 13.558 linhas. O banco real tem 544, então fica um pouco abaixo.
  - Um valor ilegível na planilha (alimento 373, piridoxina `",0,02"`) foi gravado como NOT_ANALYZED, sem inventar valor.
  - A legenda da planilha confirma Tr = traço e NA = não aplicável; `*` = "as análises estão sendo reavaliadas". Vazio foi tratado como não analisado (a legenda não o define): **a validar com o nutricionista**.
- **Conferido em 18/09** num cluster PostgreSQL 16 **descartável** (initdb na pasta temporária, porta 55432, `foods` recriada do CSV de carga):
  - Flyway V1–V3 aplicadas;
  - Hibernate `validate` ok;
  - cálculo real com nutrientes e referência;
  - servidor removido depois.
- **No banco real, V1–V3 já foram aplicadas** (conferido em 18/09: esquema na versão 3). Migrations aplicadas são imutáveis: correções de dados entram como V4+.

**Modelos de prontuário (18/09):** a V4 (`V4__create_record_templates.sql`) cria `record_templates` (índice único parcial: um padrão por nutricionista), `record_template_sections` e `record_template_fields`. A chave primária `(template_id, field_code)` garante que o campo aparece uma vez só por modelo; `field_code` aponta para o catálogo em arquivo, sem FK. Conferida num PostgreSQL descartável em 18/09 (V1–V4 e Hibernate `validate`). **No banco real, roda ao reiniciar a API.**

**Nutricionistas/pacientes (17/09):** PostgreSQL oficial, V1 em `nutrition-api/src/main/resources/db/migration/V1__create_nutritionists_and_patients.sql`, criando somente as tabelas novas/índice. Flyway baseline-on-migrate=true, baseline-version=0; JPA validate preservado. Boot 4 tem módulo de autoconfiguração Flyway separado, não autorizado; por isso a configuração explícita usa `flyway-core`/plugin PostgreSQL e garante migrate antes de entityManagerFactory, preservando as demais dependências de inicialização. Chave JWT validada antes de migrar. Perfil test exclui DataSource/Flyway e configuração manual, com mocks de repository apenas em testes.

**V1 ainda não executada no banco local**, pois falta `JWT_SECRET`. Não afirmar que criação das tabelas/validação JPA foi testada com PostgreSQL nesta entrega.

Composição por 100 g usa colunas explícitas `energy_kcal`, `protein_g`, `carbohydrate_g`, `fat_g` (numeric 19,6), além de id, name, source e source_code. `description` foi removido em entrega anterior por solicitação do usuário.

Existem colunas legadas não mapeadas `carbohydrateg`, `fatg` e `proteing`, originadas de um mapeamento anterior. Não foram apagadas neste sprint. Qualquer limpeza futura deve ser uma alteração deliberada, com inspeção dos dados.

A importação anterior veio do arquivo local `C:/Users/gulau/Downloads/taco_foods.csv`. Registros incompletos ou com nutrientes negativos foram excluídos da carga, sem inventar valores. Não há pipeline de importação nem migration do catálogo; a V1 nova trata exclusivamente de nutricionistas/pacientes.

`ddl-auto: validate`; nenhum update automático de esquema. Credenciais via `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`. Não há fallback sintético se o banco falhar. `DevelopmentFoodCatalog` está somente em `src/test/java` e não integra o JAR.

Verificação de integridade no sprint anterior: 544 registros TACO e mesmo fingerprint `f48829987965229c866c3448b7a64213` (MD5 da concatenação de row_to_json ordenada por id, usado apenas para conferir ausência de alterações nesta base).

## 12. Precisão e validação

- `BigDecimal` no backend; duas casas na saída, HALF_UP.
- TMB FAO multiplicada pelo PAL antes do arredondamento.
- Porções somadas sem arredondamento intermediário; somas de valores já exibidos podem diferir em centésimos.
- Saldo é meta exibida menos consumo exibido; negativos não são truncados.
- HTTP 400 para erros de campo, combinações inválidas, condições não cobertas, JSON malformado e propriedades desconhecidas; 404 para alimento inexistente.
- Bean Validation restringe dígitos e campos; erros de domínio também incluem identificação de campo em `errors`. Todo 400 traz `errors` (parâmetros de URL, tipos e propriedades desconhecidas identificam o campo, ex. `meals[0].foods[0].foodId`); lista vazia só para JSON malformado sem campo identificável.
- Até 20 refeições e 500 porções no dia, IDs inteiros positivos, quantidades positivas com até 3 casas. Limites técnicos não são recomendações nutricionais.

## 13. Executar e validar

Requisitos usuais: JDK 25, Maven e Node.js compatível com `nutrition-web/package.json`. API exige `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` e `JWT_SECRET` no ambiente; o segredo fixo dos testes está exclusivamente em `src/test/resources/application-test.yml`, fora do JAR.

```powershell
# Em nutrition-api, com DB_URL/DB_USERNAME/DB_PASSWORD configurados:
mvn clean verify
java -jar target/nutrition-api-0.0.1-SNAPSHOT.jar

# Em nutrition-web:
npm ci
npm run build
npm test
npm start
```

API padrão `http://127.0.0.1:8081`; frontend `http://127.0.0.1:4200`. Proxy local usa `API_TARGET` quando definido. Publicação do build Angular exige encaminhamento de `/api/**` pelo servidor.

No ambiente utilizado nesta entrega, o Java padrão do terminal pode não ser 25. O JDK 25 está em `C:/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot`. Foi utilizado Maven 3.9.12 em `%TEMP%/nutrition-build-tools/apache-maven-3.9.12` e repositório Maven temporário `%TEMP%/nutrition-maven-repository`. Esses caminhos são conveniências locais, não requisitos do projeto; podem deixar de existir. Não registrar credenciais encontradas na configuração da IDE.

## 14. Validação concluída e pendências

### Opções de refeição e nutrientes — 18/09/2026 (execução autônoma de Claude, sem perguntas)

**Testes e builds:**
- **225 testes backend** (`mvn test`, sem PostgreSQL).
- **94 frontend** (`npm test`), incluindo as abas no estilo de navegador.
- `npm run build` passou.

**Conferência real:**
- PostgreSQL descartável com `foods` do CSV de carga: V1–V3 aplicadas, JPA `validate` ok.
- A API nova respondeu com nutrientes TACO reais. Só a Opção 1 entrou no total do dia, e os status `PARTIAL`/`NO_DATA` apareceram corretos.
- No navegador (dev server extra na porta 4201 apontando para essa API): abas de opções, "+" copiando, totais da Opção 2 "não conta na meta", selo "+1 opção", barra de fibra e relatório com linha tracejada e marcador de parcial.
- A API do usuário (8081), o dev server (4200) e o banco real **não foram tocados**. Nenhum JAR gerado; nenhum comando Git.

**Pendente:**
- Parar a API, gerar o JAR e subir para aplicar V2/V3. Até isso, o planejamento em 4200 mostra erro de cálculo, porque o Angular já envia `options`.
- Validar referências e tokens com o nutricionista.

### Entrega auth/pacientes — 17/09/2026

- Ordem seguida: backend/testes; frontend/testes/build; navegador e empacotamento/startup; documentação.
- **170 testes backend** em `mvn test` e `mvn package`, sem PostgreSQL. JWT assinado/validado de verdade, repositórios Mockito; fluxos auth/pacientes, isolamento, palavras/acentos, idade, validação e concorrência. Endpoints antigos continuam públicos.
- **61 testes frontend**: 44 existentes de planejamento intactos + 17 de autenticação/pacientes. `npm run build` passou.
- Navegador conferido: login/cadastro e navegação, guard `/pacientes` → `/login`, rota pública `/planejamento`. Telas protegidas completas e integração real **não validadas**; cobertura automatizada não substitui isso.
- **Bloqueio: JWT_SECRET ausente** nos ambientes Process/User/Machine e na configuração NutritionApiApplication da IDE. Nenhum segredo foi inventado fora do perfil test. API anterior parada antes de gerar o JAR; tentativa do JAR novo confirmou falha por placeholder JWT_SECRET ausente, **sem executar migração**. A API ficou parada; o Angular continua disponível em 4200, mas cálculos mostram indisponibilidade até a API voltar.
- Próximo passo: usuário fornecer JWT_SECRET (mínimo 32 bytes) pelo ambiente; iniciar JAR com DB_URL/DB_USERNAME/DB_PASSWORD; conferir baseline/V1/JPA e preservação de foods; criar dois nutricionistas e pacientes **fictícios**, validar no navegador login/me, isolamento 404/listagem, busca/paginação, edição/versionamento, arquivar/reativar e planejamento público. Não copiar segredo para código/docs ou usar segredo de teste na execução normal.
- Nenhuma conta/paciente criada no PostgreSQL nesta entrega. Nenhum comando Git executado. Feature não marcada Fechada: validação integrada, nutricionista e merge continuam pendentes.
- Revisão sem logs novos de senha/token/paciente; exemplos/testes fictícios. Dependências adicionadas somente da lista autorizada.
- **Organização (17/09, Claude, sem mudança de comportamento):** código da entrega reformatado no padrão do projeto (uma instrução por linha, imports explícitos, templates em `.html`); `ApiFailure` movido de `auth` para `api` (eliminando dependência circular), configuração Flyway movida de `auth` para a raiz, busca duplicada extraída para `shared.TextSearch`, `PatientResponse.from(patient, hoje)` no padrão de `FoodResponse.from`. A migration V1 **não** foi reformatada: alterar uma migration já aplicada muda o checksum e impede a API de subir. Após a organização: **171 testes backend** (inclui `acceptsPastAndCurrentDates`) e **61 frontend** passando; `npm run build` passou.
- **Porção pelo nutriente (17/09, Claude):** **182 testes backend** (+9: cálculo e arredondamento nos quatro nutrientes, nutriente ausente, limites, 404, endpoint público e validação) e **80 frontend** (+4) passando; `npm run build` concluído. No navegador a interface foi conferida (chips clicáveis, campo focado com o valor atual, erro marcado no chip); a API em execução ainda não tinha o endpoint e respondeu 401 — **reiniciar a API com o JAR novo** para validar o cálculo real.
- **Paciente no planejamento (17/09, Claude):** escolher paciente cadastrado, campos somente leitura, edição gravando no cadastro (PUT com corpo completo e `version`), desvincular e regra dos 19 anos. Backend **sem mudanças**. **76 testes frontend** passando (55 do planejamento, 21 de conta/pacientes/barra lateral; inclui menu compacto só com nomes, painel "Dados do paciente", barra lateral, Perfil e manutenção do planejamento ao navegar) e `npm run build` concluído. No navegador foi conferido o caminho **sem sessão** (painel oferece entrar e não consulta `/api/patients`); o caminho autenticado (buscar, escolher, editar, salvar, 409) **depende da conta do usuário e ficou pendente de validação no navegador**. Especificação: [docs/features/paciente-no-planejamento.md](docs/features/paciente-no-planejamento.md).
- **Correção e resumo (17/09, Claude):** quantidade inválida marcada na porção sem apagar a dieta; resumo do dia refeito em barras + donut com `macroEnergyShares` calculado no backend. Estado atual: **173 testes backend** e **65 frontend** passando (inclui destaque por macro no donut); `npm run build` passou. Conferido no navegador com a API antiga (donut neutro, barras corretas) e com resposta simulada no componente (donut, anel de meta, excedente, comemoração, larguras 1366/1150/1000/375 sem estouro). **A API em execução ainda é o JAR anterior:** o donut só aparece com dados reais depois de parar a API, gerar o JAR e subir de novo.
- `npm audit`: dependências de desenvolvimento preexistentes `vitest` 4.0.18 (crítico) e `@vitest/mocker` (moderado); ferramenta indica Vitest 4.1.11. Não atualizados automaticamente; tratar em manutenção separada autorizada.

### Histórico de validações anteriores (não implica API rodando hoje)

- Validação atual de bolso no navegador: peso 120 kg e fator 20 preencheram diretamente 2400 kcal na meta e no resumo. O bloco de estimativa mostrou somente fator/troca de fórmula, sem cartão azul nem botão de aplicar.
- Estado atual (16/09, após revisão de código): **141 testes backend** e **44 testes frontend**, todos passando; `npm run build` concluído. Endpoint `from-composition` testado por unidade e API; ainda **não validado no navegador**, pois exige reiniciar a API com o JAR novo.
- Refeições: **137 testes backend** passando em `mvn clean verify` e **30 testes frontend** em `npm test` (35 após: busca dentro das refeições, correção de nome vazio, refeições retráteis em linhas de pílulas com grid único de colunas, renomear clicando no nome, busca que fecha ao adicionar e reordenação por arrastar e soltar com Angular CDK — alça ⠿, pré-visualização e vizinhos deslizando; setas ↑↓ do teclado na alça); `npm run build` concluído. A primeira execução apontou codificação incorreta no exemplo JSON atualizado; o arquivo foi corrigido e o build completo passou.
- A API foi parada antes de gerar o JAR, conforme seção 1, e reiniciada com PostgreSQL na porta 8081. Não houve alteração do catálogo ou banco.
- Validação real no navegador: criação por atalho (Almoço) e nome livre (Jantar de teste), seleção de destino, mesmo alimento TACO `Frango, filé, à milanesa` (código 401) em duas refeições. Porções de 100 g exibiram 220,87 kcal por refeição; total diário 441,75 kcal, comprovando a soma antes do arredondamento.
- Editar Almoço para 150 g produziu 331,31 kcal; somado ao Jantar de 100 g, total diário 552,18 kcal. Meta diária de 2000 produziu saldo 1447,82; nenhuma meta por refeição.
- Renomear Jantar, mover para cima, cancelar exclusão, remover a porção do Almoço e confirmar exclusão do Jantar funcionaram. Restou Almoço vazio, total diário zero e saldo diário 2000. Captura visual conferida com os painéis e anéis existentes.
- Cobertura adicionada: refeições vazias, repetições, precisão entre refeições, carga única, limites de refeições/porções, erros aninhados, rejeição de `foods` raiz, destino correto, cancelamento, reordenação e confirmação de exclusão.
- Idioma pt-BR também configurado nos testes de interface.
- Validação atual no navegador com API PostgreSQL: preencher homem, 30 anos, 80 kg, 175 cm, ACTIVE produziu DRI 3093.72 automaticamente, sem prescrição. Meta manual 2000 foi preservada ao abrir alternativas e escolher FAO; PAL começou vazio. Informar PAL 1.60 produziu 2865.38 e diferença -865.38. Retorno à DRI preservou o perfil.
- API reiniciada com o JAR atualizado na porta 8081 após liberar a execução anterior que bloqueava o arquivo. Nenhuma alteração de banco foi necessária.
- Cobertura: oito equações DRI, todas as faixas FAO implementadas/sexos, limites PAL, atividade independente por método, método incompatível, objetivo sem efeito, prescrição independente, macros, precisão, composição sem metas, saldos negativos, erros HTTP e busca.
- Integração HTTP real do sprint anterior: DRI 3093.72 → prescrição 2000 → diferença -1093.72; alimento TACO em porção de 150 g consumiu 331.31 kcal, saldo 1668.69.
- Navegador no sprint anterior: estimativa visível sem meta aplicada, alimento adicionado sem metas, aplicação explícita/edição da prescrição e troca DRI→FAO preservando 2000 kcal.
- Banco conferido sem mudança de registros.
- Nenhum comando Git executado.

Os testes de backend usam fixtures e não exigem PostgreSQL. A conferência real descrita foi executada separadamente; não substituir essa distinção por alegação de que toda a suíte testa o banco real.

## 15. Limites e continuidade

Auth, cadastro de pacientes e Flyway foram autorizados e implementados na entrega de 17/09, com validação integrada pendente conforme seção 14. Não avançar automaticamente para outras formas de persistência, infraestrutura ou microsserviços. Múltiplas refeições temporárias foram implementadas conforme [docs/features/refeicoes.md](docs/features/refeicoes.md), ampliadas pelo usuário com horário (só na tela), arrastar e soltar e composição como meta. Não ampliar para persistência, metas por refeição, ordenação automática por horário, receitas, duplicação ou mover alimentos entre refeições. São futuras features a definir com o usuário.

Pendências de domínio: métodos pediátricos, gestação/lactação, eventual avaliação de atividade que derive PAL. Não há regras para essas ampliações e elas não devem ser inferidas.

Ao iniciar uma nova sessão: conferir na seção 2 qual feature está em foco e trabalhar somente nela; ler este HANDOFF e os READMEs, inspecionar o código/estado atual, confirmar o novo escopo e manter a distinção entre estimativa, decisão profissional e consumo real. Validar mudanças com exemplos fornecidos pelo nutricionista e atualizar os testes, contratos e este documento em conjunto.

A feature Refeições está implementada e validada tecnicamente. Não foi marcada como “Fechada” porque a definição da seção 2 inclui validação do nutricionista e merge em main; essas etapas cabem ao usuário. Nenhum comando Git foi executado.
