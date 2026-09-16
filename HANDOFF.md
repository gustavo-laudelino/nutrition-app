# HANDOFF — Nutrition App

Atualizado em **16/09/2026**, com DRI automática como padrão, atividade DRI no perfil, remoção de condição fisiológica do MVP e adoção do método de trabalho por épico/features (seção 2).

Este documento registra o estado entregue, as decisões de desenvolvimento e os cuidados para continuar em outra sessão. Os contratos detalhados estão em [nutrition-api/README.md](nutrition-api/README.md) e [nutrition-web/README.md](nutrition-web/README.md).

## 1. Instruções de trabalho que devem ser preservadas

- **Não executar nenhum comando Git**, incluindo consultas. Não criar branch, commit, push, merge, checkout nem alterar configuração Git. O usuário controla o versionamento manualmente.
- Desenvolver passo a passo, validando funcionalidades reais com o nutricionista parceiro.
- Regras nutricionais, fórmulas, validações de negócio, arredondamento e saldos pertencem ao backend.
- Não inventar regras ausentes, fatores automáticos, déficits/superávits ou equivalências entre metodologias.
- Não preservar modelos incorretos apenas por compatibilidade. Refatorar quando houver benefício concreto, sem abstrações especulativas.
- Não usar Lombok nem adicionar dependências sem necessidade técnica real.
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
| — | Composição da dieta | `calculation` · `POST /api/diet-calculations` | Adiada: será redesenhada |

**Catálogo de alimentos:** o PostgreSQL atual é **temporário**, usado só para fornecer dados reais aos testes da calculadora; outro banco será adotado no futuro. Não investir nele (limpeza de colunas legadas, migrations, pipeline de importação, ajuste de busca). O que deve permanecer estável é o contrato: interface `FoodCatalog` e `FoodResponse` (id, nome, fonte, nutrientes por 100 g). Trocar de banco = nova implementação de `FoodCatalog`. Ponto a decidir quando o novo banco for escolhido: tipo do ID do alimento (hoje `Long`), que afeta `foodId` na composição.

**Composição da dieta:** será uma feature grande, provavelmente um workspace/kanban com liberdade criativa para o profissional. A tela atual existe apenas para testar a calculadora; **o frontend inteiro será reformulado**. Não investir em organização do `nutrition-web` atual além do necessário para testar o backend.

**Paciente:** não é feature deste épico. `PatientContext` é apenas entrada de cálculo e sairá desta tela no futuro. Quando virar entidade, será épico próprio; a estimativa mudará apenas a origem dos dados.

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

**Ainda não existem:** entidade Paciente/Usuário, cadastro, autenticação, autorização, persistência de planejamento/dieta, receitas ou organização persistida de várias refeições. A tela contém dados temporários de paciente para validar os cálculos. No futuro, esses valores poderão vir de um paciente salvo; não antecipar esse cadastro agora.

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

Backend em `nutrition-api`: Java 25, Spring Boot 4.1.1, Maven, JAR; package `com.nutritionapp` e group Maven `com.gustavo`. Dependências: Web MVC, Data JPA, Validation, PostgreSQL e starter de testes com escopo test.

| Package | Responsabilidade |
|---|---|
| `patient` | Contexto temporário, sem JPA e sem atividade universal |
| `energy` | `EnergyEstimator`, equações separadas DRI/FAO, request/response e controller |
| `targets` | `TargetCalculator`, `MacroTargetCalculator`, `PerKgPrescriptionCalculator`, prescrição e macros opcionais |
| `calculation` | `DietCalculator`, porções, totais e saldos; alimentos carregados em uma única consulta (`FoodCatalog.findAllById`) |
| `food` | Entidade/repository e catálogo somente leitura |
| `shared` | `DecimalPrecision` e erro de cálculo com campo |
| `api` | Tradução de erros para ProblemDetail |

Frontend em `nutrition-web`: Angular 22.1.6, TypeScript 6, RxJS; CLI 22.1.8 utiliza Vite no desenvolvimento. Não há Vite separado nem biblioteca visual. `api.ts` contém contratos tipados; `app.ts`, `app.html` e `styles.css` implementam o fluxo com formulários reativos e signals.

Foi removido `EnergyTargetCalculator` e o antigo objeto `energy` de definição de metas. Não restaurar esses conceitos. Parâmetros desconhecidos são rejeitados, em vez de ignorados silenciosamente.

## 9. Contratos HTTP finais

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/foods?name=&page=0&size=20` | Catálogo paginado |
| GET | `/api/foods/{id}` | Nutrientes por 100 g |
| POST | `/api/energy-estimates` | Estimativa independente |
| POST | `/api/energy-prescriptions/per-kg` | Meta direta por peso × kcal/kg |
| POST | `/api/target-calculations` | Prescrição explícita, diferença e macros |
| POST | `/api/diet-calculations` | Composição e comparação opcional |

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

Composição aceita `foods` obrigatório e `targets` opcional. Recebe apenas IDs e quantidades dos alimentos. Cada saldo tem `target`, `consumed`, `remaining`; target/remaining são null sem meta. Lista vazia é válida. Exemplos em `nutrition-api/examples` usam fixtures sintéticas dos testes: não interpretar os IDs/valores como dados TACO.

Correção posterior em 16/09: bolso passou de estimativa para prescrição direta. Esta regra substitui expressamente a interpretação anterior de exigir o botão de aplicar também para bolso.

## 10. Estados da interface

- Paciente, estimativa, prescrição e macros são quatro blocos visuais separados. Legendas auxiliares ficam em ícones “i”, acessíveis por hover/foco e dispensáveis com Esc.
- Dados do paciente visíveis, seguidos de estimativa, prescrição, macros e composição.
- DRI é o método inicial automático, calculado após preencher sexo, idade, peso, altura e atividade DRI. Enquanto faltam dados, não são disparados erros automáticos. A prescrição manual continua disponível.
- O botão discreto **Calcular estimativa energética com outra fórmula** revela a seleção FAO/bolso e permite voltar à DRI. O seletor começa recolhido; nenhum PAL ou fator é inferido.
- A categoria DRI fica no perfil e seleciona uma equação; não é um multiplicador. As oito equações foram conferidas com o pedido de 16/09 e já coincidiam com ele.
- Botão **Usar estimativa como meta** é a ação explícita de transferência. Editar a estimativa não atualiza esse campo automaticamente.
- Diferença entre prescrição e estimativa vem do backend, assim como macros e saldos.
- Estimativa, metas e composição têm requisições e erros independentes. Falha na estimativa permite continuar com prescrição manual e alimentos.
- Comparações antigas são retiradas quando suas entradas mudam ou o recálculo falha; a composição é consultada sem metas enquanto elas são resolvidas novamente.
- Busca: resultados recolhidos quando vazia, debounce 200 ms e cancelamento de consultas anteriores. Pesquisa por palavras AND, sem acento/ordem/caixa; `file frango` encontra `Frango, filé, à milanesa`. Não há fuzzy search ou sinônimos.
- Quantidades: porção inicial de 100 g; edição recalcula após 200 ms. Estimativa/metas usam 300 ms. Nenhuma fórmula nutricional no Angular.
- Recarregar a página descarta tudo; não há localStorage ou persistência do planejamento.

## 11. Banco e dados

**Banco temporário** (ver seção 2): serve apenas para testar a calculadora com dados reais e será substituído. PostgreSQL 16 local, banco `nutrition_app`, tabela `public.foods`. Existem **544 alimentos**, todos fonte TACO, preservados durante as alterações. Única tabela de domínio encontrada: `foods`.

Composição por 100 g usa colunas explícitas `energy_kcal`, `protein_g`, `carbohydrate_g`, `fat_g` (numeric 19,6), além de id, name, source e source_code. `description` foi removido em entrega anterior por solicitação do usuário.

Existem colunas legadas não mapeadas `carbohydrateg`, `fatg` e `proteing`, originadas de um mapeamento anterior. Não foram apagadas neste sprint. Qualquer limpeza futura deve ser uma alteração deliberada, com inspeção dos dados.

A importação anterior veio do arquivo local `C:/Users/gulau/Downloads/taco_foods.csv`. Registros incompletos ou com nutrientes negativos foram excluídos da carga, sem inventar valores. Não há pipeline de importação/migrations versionado nesta entrega.

`ddl-auto: validate`; nenhum update automático de esquema. Credenciais via `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`. Não há fallback sintético se o banco falhar. `DevelopmentFoodCatalog` está somente em `src/test/java` e não integra o JAR.

Verificação de integridade antes/depois: 544 registros TACO e mesmo fingerprint `f48829987965229c866c3448b7a64213` (MD5 da concatenação de row_to_json ordenada por id, usado apenas para conferir ausência de alterações nesta base).

## 12. Precisão e validação

- `BigDecimal` no backend; duas casas na saída, HALF_UP.
- TMB FAO multiplicada pelo PAL antes do arredondamento.
- Porções somadas sem arredondamento intermediário; somas de valores já exibidos podem diferir em centésimos.
- Saldo é meta exibida menos consumo exibido; negativos não são truncados.
- HTTP 400 para erros de campo, combinações inválidas, condições não cobertas, JSON malformado e propriedades desconhecidas; 404 para alimento inexistente.
- Bean Validation restringe dígitos e campos; erros de domínio também incluem identificação de campo em `errors`. Todo 400 traz `errors` (parâmetros de URL, tipos e propriedades desconhecidas identificam o campo, ex. `foods[0].foodId`); lista vazia só para JSON malformado sem campo identificável.
- Lista de até 500 porções, IDs inteiros positivos, quantidades positivas com até 3 casas. Limites técnicos não são recomendações nutricionais.

## 13. Executar e validar

Requisitos usuais: JDK 25, Maven e Node.js compatível com `nutrition-web/package.json`.

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

## 14. Validação concluída

- Validação atual de bolso no navegador: peso 120 kg e fator 20 preencheram diretamente 2400 kcal na meta e no resumo. O bloco de estimativa mostrou somente fator/troca de fórmula, sem cartão azul nem botão de aplicar.
- Backend: **124 testes**, zero falhas/erros (`mvn test`, 16/09, após remoção dos macros `MANUAL`/`PER_KG`). O JAR em `target/` pode estar desatualizado: gerar com a API parada e reiniciá-la.
- Frontend: **26 testes**, zero falhas, `npm run build` e `npm test` concluídos (layout com paciente/configurações em painéis laterais e resumo em anéis).
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

Não avançar automaticamente para cadastro, autenticação, persistência, múltiplas refeições, migrations, infraestrutura ou microsserviços. São futuras features a definir com o usuário.

Pendências de domínio: métodos pediátricos, gestação/lactação, eventual avaliação de atividade que derive PAL. Não há regras para essas ampliações e elas não devem ser inferidas.

Ao iniciar uma nova sessão: conferir na seção 2 qual feature está em foco e trabalhar somente nela; ler este HANDOFF e os READMEs, inspecionar o código/estado atual, confirmar o novo escopo e manter a distinção entre estimativa, decisão profissional e consumo real. Validar mudanças com exemplos fornecidos pelo nutricionista e atualizar os testes, contratos e este documento em conjunto.
