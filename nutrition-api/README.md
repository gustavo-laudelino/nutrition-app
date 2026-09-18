# nutrition-api

Backend da calculadora nutricional: **estimativa energética ≠ prescrição ≠ composição real**.
Java 25, Spring Boot 4.1.1, Maven, JPA, Validation e PostgreSQL. Autenticação e pacientes usam somente as novas dependências autorizadas: `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server`, `flyway-core`, `flyway-database-postgresql` e `spring-security-test` (test).

## Executar

Configure JDK 25 em `JAVA_HOME`, Maven no PATH e `DB_URL` (JDBC), `DB_USERNAME`, `DB_PASSWORD` e `JWT_SECRET` no ambiente do processo. `JWT_SECRET` deve ter no mínimo 32 bytes UTF-8; não há valor padrão fora de testes. Nunca grave o segredo em arquivos versionados. Pare a API antes de gerar o JAR se estiver executando a partir de `target/`:

```powershell
mvn clean verify
java -jar target/nutrition-api-0.0.1-SNAPSHOT.jar
```

Porta padrão 8081, configurável por `SERVER_PORT`. `mvn spring-boot:run` também funciona. A execução normal usa PostgreSQL; o perfil `postgres` é aceito, mas não necessário. `ddl-auto: validate` não modifica a tabela `foods`. Fixtures sintéticas vivem apenas em `src/test/java`, sob perfil `test`, e não integram o JAR nem são fallback de produção.

## Organização

- `patient`: entidade `Patient`, DTOs, repository, serviço e controller do cadastro; `PatientContext` continua intacto como entrada temporária da calculadora.
- `nutritionist`: entidade/repository do nutricionista.
- `auth`: registro, login, JWT e segurança. A configuração explícita do Flyway (`DatabaseMigrationConfiguration`) fica no pacote raiz.
- `energy`: estimativas; DRI escolhe uma equação EER, FAO calcula TMB e aplica PAL.
- `targets`: prescrição explícita, diferença para estimativa de referência e metas opcionais de macros.
- `calculation`: composição proporcional dos alimentos, saldos das metas efetivamente prescritas e peso da porção a partir de um nutriente.
- `food`: catálogo PostgreSQL somente leitura, busca por palavras e paginação.
- `shared`: precisão decimal, erro de cálculo com identificação de campo e `TextSearch` (busca por palavras sem acento/caixa).
- `api`: tratamento HTTP de erros e `ApiFailure` (erro esperado com status e campo opcional).

Cadastro de pacientes não se integra ao planejamento. Não há persistência de dietas nem atividade universal no perfil da calculadora.

## Endpoints

| Método | Caminho | Finalidade |
|---|---|---|
| GET | `/api/foods?name=file%20frango&page=0&size=20` | Busca por palavras/trechos, ignorando ordem, caixa e acentos portugueses |
| GET | `/api/foods/{id}` | Composição por 100 g e origem |
| POST | `/api/energy-estimates` | Estimativa energética, nunca prescrição |
| POST | `/api/energy-prescriptions/per-kg` | Meta direta por peso × kcal/kg |
| POST | `/api/target-calculations` | Prescrição explícita, comparação e macros |
| POST | `/api/target-calculations/from-composition` | Composição atual convertida em meta energética e percentuais de macros |
| POST | `/api/diet-calculations` | Composição e saldos opcionais |
| POST | `/api/portion-quantities` | Peso da porção a partir da quantidade desejada de um nutriente |

Todos os endpoints de cálculo são sem persistência. Busca usa AND entre termos; não faz correção ortográfica ou sinônimos. `page` inicia em 0; `size` entre 1 e 100.

## Estimativa energética

Exemplo DRI:

```json
{
  "patient": {"weightKg":80,"heightCm":175,"age":30,"sex":"MALE","goal":"WEIGHT_LOSS","driActivity":"ACTIVE"},
  "method":"DRI_2023"
}
```

Retorno: `estimatedKcal: 3093.72`, método `DRI_2023`, atividade `ACTIVE`, `basalKcal: null`. Não há campo de meta.

- `patient` e `method` obrigatórios. `goal` é opcional: `WEIGHT_LOSS`, `MAINTENANCE`, `WEIGHT_GAIN`; não participa de nenhuma fórmula.
- `DRI_2023`: adultos 19+, peso, altura **em cm**, idade, sexo `MALE`/`FEMALE`, `patient.driActivity` obrigatório. Categorias `INACTIVE`, `LOW_ACTIVE`, `ACTIVE`, `VERY_ACTIVE` correspondem aos intervalos PAL fornecidos: [1,00;1,53), [1,53;1,68), [1,68;1,85), [1,85;2,50). A categoria seleciona uma das oito equações fornecidas. Não se calcula TMB nem se multiplica EER por PAL. Para adultos com peso estável, EER equivale ao TEE estimado, conforme a regra fornecida.
- `FAO`: adultos 19+, peso, idade e sexo. `faoPal` deve ser informado entre 1,40 e 2,40, com até duas casas. Calcula TMB sem arredondar, multiplica pelo PAL e retorna TMB e estimativa separadas. Classifica o PAL informado como `SEDENTARY_LIGHT` (1,40–1,69), `ACTIVE_MODERATE` (1,70–1,99) ou `VIGOROUS` (2,00–2,40). Nenhuma categoria escolhe fator automaticamente.
- Fórmula de bolso: `POST /api/energy-prescriptions/per-kg` recebe `{"weightKg":120,"kcalPerKg":20}` e retorna `{"prescribedEnergyKcal":2400.00}`. Ambos são positivos e obrigatórios. O frontend aplica o resultado diretamente à meta. O método `PER_KG` não pertence mais ao endpoint de estimativas. Não há fator derivado do objetivo.

Parâmetros exclusivos de outro método são rejeitados (por exemplo, `faoPal` em DRI). `patient.driActivity` pode permanecer no perfil ao usar FAO, mas é ignorado por esse método. Não há conversão de classificações. O antigo `driActivity` na raiz do pedido foi removido.

FAO usa faixas **[19,30), [30,60), [60,130]**. A nova regra **60+ inclui 60**, substituindo a convenção anterior. A equação 10–18 não é aplicada junto ao PAL adulto: faltam regras para o planejamento de menores. Toda idade informada no contexto deve ser 19 ou maior; DRI e FAO exigem idade. Idade máxima 130 é um limite técnico, não uma afirmação de validação clínica.

Condição fisiológica não integra o contrato nem as validações do MVP. Testes de uso são restritos a adultos 19+ não gestantes/lactantes. Prescrição manual e composição permanecem independentes.

As fórmulas implementadas são as fornecidas pelo responsável pelo domínio no pedido de correção (DRI 2023 e FAO/WHO/UNU). Não foram acrescentadas equações externas. Os coeficientes estão em `DriEquation` e `FaoEquation`; todos são cobertos por testes.

## Prescrição e macronutrientes

```json
{
  "prescribedEnergyKcal":2000,
  "referenceEstimateKcal":2437,
  "macros":{"method":"PERCENTAGE","carbohydrate":50,"protein":20,"fat":30}
}
```

Retorna:

- `prescription`: energia prescrita 2000, referência 2437 e diferença **-437** (prescrição − estimativa), sem interpretar o motivo da diferença.
- `targets`: energyKcal 2000, carbohydrateG 250, proteinG 100, fatG 66.67.
- `macros`: método, gramas e kcal de cada macro definido.

`prescribedEnergyKcal` e `referenceEstimateKcal` são independentes e opcionais. A referência é o valor resolvido carregado da etapa anterior, usado somente para comparação; não reexecuta a fórmula nem é um registro auditado/persistido. Enviar só referência nunca cria meta. A prescrição pode existir sem estimativa. Uma falha na estimativa não invalida automaticamente a prescrição profissional.

Métodos de macros:

- `NONE` ou escolha ausente: nenhuma meta.
- `PERCENTAGE`: exige **prescrição**, não apenas estimativa. Todos os percentuais não negativos e soma exatamente 100. Conversão 4/4/9 kcal/g.
- `MANUAL` (gramas digitados) e `PER_KG` (g/kg, "fórmula de bolso" de macros) foram **removidos** em 16/09 e são rejeitados; o pedido não aceita mais `patient`.

Os campos `carbohydrate`, `protein` e `fat` são percentuais da prescrição. Não há fatores automáticos, carboidrato por diferença ou ajuste da prescrição pela soma dos macros. Zero é meta explícita; null é ausência.

### Composição como meta

`POST /api/target-calculations/from-composition` é usado pela ação explícita "Definir composição como meta". Recebe os totais consumidos do dia (como devolvidos por `/api/diet-calculations`):

```json
{"energyKcal": 124, "carbohydrateG": 25.8, "proteinG": 2.6, "fatG": 1}
```

e retorna:

```json
{"prescribedEnergyKcal": 124.00, "carbohydratePercent": 84.1762, "proteinPercent": 8.4829, "fatPercent": 7.3409}
```

- `prescribedEnergyKcal` = energia consumida, arredondada a 2 casas.
- Percentuais = energia de cada macro (C×4, P×4, G×9) sobre a soma dessas energias, com 4 casas (HALF_UP). O resíduo do arredondamento é somado à maior fatia, para totalizar exatamente 100 e ser aceito por `PERCENTAGE`.
- Como as kcal da tabela diferem da soma 4/4/9, as metas em gramas derivadas desses percentuais ficam próximas, mas não iguais, aos gramas consumidos (ex.: 25,8 g consumidos → meta de 26,09 g).
- Campos obrigatórios, não negativos, até 2 casas. Energia zero (`energyKcal`) ou macros todos zero (`macros`) retornam 400. O endpoint não altera nenhuma meta; o cliente aplica o resultado.

## Composição por refeições

`POST /api/diet-calculations` recebe `meals` obrigatório e `targets` diário opcional. O antigo `foods` na raiz é rejeitado com HTTP 400.

```json
{
  "targets": {"energyKcal": 2000, "proteinG": 150},
  "meals": [
    {"name": "Almoço", "foods": [{"foodId": 1, "quantityG": 150}]},
    {"name": "Ceia", "foods": []}
  ]
}
```

- Até 20 refeições e 500 porções somadas no dia. Dia vazio (`meals: []`) e refeição vazia são válidos.
- Nome obrigatório, não branco após trim, até 60 caracteres; nomes repetidos são permitidos. A resposta devolve o nome sem espaços nas extremidades.
- Cada `foods` é obrigatório e contém IDs positivos e quantidades positivas em gramas, com até três casas decimais. Alimentos repetidos são contabilizados individualmente.
- Resposta: `meals[]` na ordem do pedido, cada item com `name`, `foods` calculados e `totals` simples (`energyKcal`, `carbohydrateG`, `proteinG`, `fatG`). Não há meta ou saldo por refeição.
- `totals` na raiz contém os saldos diários `{target, consumed, remaining}`. Sem meta, target/remaining são null. Excedentes têm saldo negativo.
- `macroEnergyShares` na raiz: `{carbohydratePercent, proteinPercent, fatPercent}` com a distribuição da energia dos macros do dia por 4/4/9 kcal/g, calculada sobre os gramas consumidos arredondados, 4 casas e soma exata de 100 (mesma regra de `from-composition`). `null` quando não há macros. Descreve os macros, não as kcal da tabela.
- Quantidade de porção: obrigatória, maior que zero, até 7 inteiros e 3 decimais; mensagens em português (ex.: "Informe uma quantidade maior que zero.").
- Uma única chamada a `FoodCatalog.findAllById` carrega todos os IDs do dia. Alimento inexistente em qualquer refeição retorna 404.
- Valores exatos das porções são somados antes de arredondar. Cada refeição é arredondada separadamente; o dia usa a soma exata de todas as porções, nunca os totais de refeições já arredondados. A soma dos totais exibidos por refeição pode diferir do total diário em centésimos.
- Erros 400 usam caminhos como `meals[1].name`, `meals[0].foods[2].quantityG` ou `meals` para o limite diário de porções.

Os arquivos `examples/diet-calculation-request.json` e `examples/diet-calculation-response.json` trazem o contrato completo com **fixtures sintéticas da suíte**, não dados TACO. Para uso real, consulte IDs e valores da base via `/api/foods`. Não há persistência, entidades ou tabelas de refeições.

## Precisão e erros

`BigDecimal` em toda aritmética; HALF_UP e duas casas na saída. FAO multiplica TMB exata pelo PAL antes de arredondar; composição soma porções exatas antes de arredondar. Saldo usa meta apresentada menos consumo apresentado. Kcal da base são preservadas, sem reconstrução por macros.

Campos desconhecidos, enums/tipos inválidos, combinações incompatíveis e entradas fora do escopo geram HTTP 400 (`application/problem+json`). Todo 400 inclui `errors[{field,message}]`, também para parâmetros de URL e JSON ilegível (ex.: `meals[0].foods[0].foodId`, propriedade desconhecida `targetKcal`); a lista fica vazia apenas quando não há campo identificável, como em JSON malformado. Alimento inexistente retorna 404. Não há compatibilidade artificial com o antigo objeto `energy` de `/api/target-calculations`; ele agora é rejeitado.

Metas e quantidades têm limites técnicos de dígitos. Peso/altura positivos; idade inteira de 19 a 130 quando informada; quantidades positivas até 3 casas; fatores e macros até 4 casas (PAL FAO até 2).

## Testes

`mvn clean verify` cobre as oito equações DRI, FAO/BMR/PAL/limites etários, precisão sem arredondamento intermediário, objetivos sem efeito matemático, atividade DRI sem conversão para FAO, independência de prescrição, macros, composição, contratos HTTP e catálogo. A suíte não exige PostgreSQL; integração real é verificada separadamente.

Validação da feature Refeições (16/09): **137 testes backend** passando em `mvn clean verify`; JAR gerado somente após parar a API. Inclui precisão entre refeições, carga única de alimentos, limites, contrato antigo rejeitado e erros aninhados.

Histórico de 16/09: **141 testes backend**, incluindo composição como meta (percentuais, resíduo na maior fatia, rejeições e contrato HTTP).


## Login de nutricionista e cadastro de pacientes (17/09/2026)

Todos os endpoints de cálculo e alimentos acima continuam públicos. Apenas `/api/auth/me` e `/api/patients/**` exigem `Authorization: Bearer <token>`.

| Método | Endpoint | Contrato |
|---|---|---|
| POST | `/api/auth/register` | `{name,email,password}` → 201 com a resposta de login |
| POST | `/api/auth/login` | `{email,password}` → 200 `{accessToken,tokenType:"Bearer",expiresAt,nutritionist:{id,name,email}}` |
| GET | `/api/auth/me` | Perfil `{id,name,email}` |
| GET | `/api/patients?name=&archived=false&page=0&size=20` | `{content,page,size,totalElements,totalPages}`; página zero, tamanho 1–100, nome + id como desempate |
| POST | `/api/patients` | Criação → 201 com o paciente |
| GET | `/api/patients/{id}` | Detalhe do próprio paciente |
| PUT | `/api/patients/{id}` | Substitui os campos editáveis; `version` obrigatório |
| POST | `/api/patients/{id}/archive` | Arquiva e retorna o paciente atualizado |
| POST | `/api/patients/{id}/unarchive` | Reativa e retorna o paciente atualizado |

Registro normaliza nome (trim) e e-mail (trim + minúsculas). E-mail duplicado retorna 409 com campo `email`. Senhas de registro têm 8–72 caracteres e BCrypt; o limite técnico do BCrypt também é **72 bytes UTF-8**, portanto caracteres multibyte podem atingir esse limite antes de 72 caracteres (400, campo `password`, sem truncamento). Login com senha incorreta, inclusive curta, ou e-mail inexistente retorna o mesmo 401: “E-mail ou senha inválidos.”

JWT HS256, `sub` UUID, `name`, `iat`, `exp`, validade 8 horas. Sem refresh token. Logout descarta o token no cliente; **não revoga** um token já emitido no servidor. API stateless e sem cookie de sessão; CSRF desabilitado. Token ausente, inválido ou expirado gera 401 nas rotas protegidas. Erros de autenticação/acesso usam `application/problem+json`, com `errors`.

Paciente recebe `name`, `birthDate`, `sex`, `phone`, `email`, `notes`, `weightKg`, `heightCm`, `driActivity`, `measuredAt` e, na edição, `version`. Somente nome é obrigatório na criação. Resposta inclui esses campos e `id`, `ageYears`, `archived`, `createdAt`, `updatedAt`; idade é calculada pelo backend na data atual e fica null sem nascimento. `sex`: FEMALE/MALE/null; atividade: INACTIVE/LOW_ACTIVE/ACTIVE/VERY_ACTIVE/null. Não há restrição 19+ no cadastro.

Nome até 120 após trim; nascimento entre 1900-01-01 e hoje; telefone até 30, e-mail válido até 254, observações até 2000; peso positivo até 4 inteiros/3 decimais, altura positiva até 3 inteiros/2 decimais; data das medidas não futura. Campos opcionais aceitam null. Propriedades desconhecidas retornam 400. Consulta por palavras AND, ignorando caixa e acentos, sem extensão PostgreSQL. Por padrão, lista somente ativos; `archived=true` lista somente arquivados. A propriedade do paciente vem exclusivamente do JWT, nunca do corpo da requisição. Paciente inexistente ou de outro nutricionista retorna 404 em todas as operações. Versão desatualizada ou concorrência durante a gravação retorna 409: “O paciente foi alterado em outra sessão. Recarregue.” Sem DELETE nem histórico de medidas.

### Banco e migração

`V1__create_nutritionists_and_patients.sql` cria somente `nutritionists`, `patients` e seu índice. Flyway usa `baseline-on-migrate: true`, `baseline-version: 0`, preservando `foods`. `ddl-auto: validate` permanece.

Spring Boot 4 modulariza a autoconfiguração Flyway; como o módulo/starter adicional não está na lista autorizada, `DatabaseMigrationConfiguration` configura o `Flyway` diretamente com as dependências autorizadas. O bean migra antes de `entityManagerFactory`, preserva outras dependências de inicialização e exige a chave JWT válida antes de migrar. Perfil `test` exclui DataSource/Flyway e a configuração manual; repositórios são simulados apenas em código de teste. O segredo fixo do perfil `test` fica exclusivamente em `src/test/resources/application-test.yml`, não integra o JAR e nunca deve ser usado fora da suíte.

### Validação desta entrega

`mvn test` e `mvn package`: **170 testes passando**, sem PostgreSQL; cobertura HTTP com assinatura JWT real e repositórios Mockito, busca/isolamento via especificação, validação, idade e concorrência. Código novo revisado sem logging de senhas, tokens ou dados de pacientes.

**Validação real pendente:** não existe `JWT_SECRET` no ambiente nem na configuração da API na IDE. O processo anterior foi parado antes de empacotar. O JAR novo foi executado com as variáveis de banco existentes e confirmou falha por segredo ausente, antes de migrar; a API ficou parada. Não foram criadas contas/pacientes nem executada a V1 no PostgreSQL. Após o usuário disponibilizar o segredo no ambiente, iniciar o JAR e validar cadastro/login, dois nutricionistas fictícios, isolamento, edição, busca, arquivamento e preservação de `foods` no banco real. Usar somente dados fictícios até revisão de segurança e autorização para uso real.

## Porção pelo nutriente (17/09/2026)

`POST /api/portion-quantities` (público, como os demais da calculadora) recebe `{foodId, nutrient, amount}`, com `nutrient` em `ENERGY`, `CARBOHYDRATE`, `PROTEIN` ou `FAT` e `amount` positivo (até 7 inteiros e 3 decimais), e devolve `{foodId, nutrient, amount, quantityG}`.

- `quantityG = amount × 100 ÷ valor do nutriente por 100 g`, arredondado a **0,1 g HALF_UP** (decisão do usuário). A porção continua sendo informada em gramas em `/api/diet-calculations`; este endpoint só converte a quantidade desejada em peso.
- Alimento sem o nutriente (ausente ou zero por 100 g) → 400 em `nutrient` ("Este alimento não tem carboidrato para dimensionar a porção.").
- Peso resultante menor que 0,1 g ou acima de 9.999.999,9 g → 400 em `amount`.
- Alimento inexistente → 404. Campos inválidos → 400 por campo, em português.

Exemplo (catálogo sintético dos testes, 28 g de carboidrato por 100 g): `{"foodId":1,"nutrient":"CARBOHYDRATE","amount":40}` → `quantityG: 142.9`.
