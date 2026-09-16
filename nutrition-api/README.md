# nutrition-api

Backend da calculadora nutricional: **estimativa energética ≠ prescrição ≠ composição real**.
Java 25, Spring Boot 4.1.1, Maven, JPA, Validation e PostgreSQL. Sem novas dependências.

## Executar

Configure JDK 25 em `JAVA_HOME`, Maven no PATH e `DB_URL` (JDBC), `DB_USERNAME`, `DB_PASSWORD` no ambiente do processo:

```powershell
mvn clean verify
java -jar target/nutrition-api-0.0.1-SNAPSHOT.jar
```

Porta padrão 8081, configurável por `SERVER_PORT`. `mvn spring-boot:run` também funciona. A execução normal usa PostgreSQL; o perfil `postgres` é aceito, mas não necessário. `ddl-auto: validate` não modifica a tabela `foods`. Fixtures sintéticas vivem apenas em `src/test/java`, sob perfil `test`, e não integram o JAR nem são fallback de produção.

## Organização

- `patient`: `PatientContext`, DTO temporário com dados, objetivo e categoria específica `driActivity`; nenhuma entidade/tabela de paciente.
- `energy`: estimativas; DRI escolhe uma equação EER, FAO calcula TMB e aplica PAL.
- `targets`: prescrição explícita, diferença para estimativa de referência e metas opcionais de macros.
- `calculation`: composição proporcional dos alimentos e saldos das metas efetivamente prescritas.
- `food`: catálogo PostgreSQL somente leitura, busca por palavras e paginação.
- `shared`: precisão decimal e erro de cálculo com identificação de campo.
- `api`: tratamento HTTP de erros.

Não há cadastro de usuários/pacientes, autenticação, persistência de dietas ou atividade universal no perfil.

## Endpoints

| Método | Caminho | Finalidade |
|---|---|---|
| GET | `/api/foods?name=file%20frango&page=0&size=20` | Busca por palavras/trechos, ignorando ordem, caixa e acentos portugueses |
| GET | `/api/foods/{id}` | Composição por 100 g e origem |
| POST | `/api/energy-estimates` | Estimativa energética, nunca prescrição |
| POST | `/api/energy-prescriptions/per-kg` | Meta direta por peso × kcal/kg |
| POST | `/api/target-calculations` | Prescrição explícita, comparação e macros |
| POST | `/api/diet-calculations` | Composição e saldos opcionais |

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

## Composição

```json
{"targets":{"energyKcal":2000,"proteinG":150,"fatG":70},"foods":[{"foodId":1,"quantityG":150}]}
```

`targets` pode ser omitido por completo. O cliente envia somente IDs e quantidades dos alimentos; nutrientes são lidos da base TACO. `foods` obrigatório, podendo ser vazio, até 500 porções. Valores por 100 g × quantidade / 100; porções repetidas são contabilizadas separadamente. Cada saldo contém `target`, `consumed`, `remaining`. Sem meta, target/remaining são null; excedentes geram restante negativo.

Os arquivos `examples/diet-calculation-*.json` continuam sendo **fixtures sintéticas da suíte**, não dados TACO. Para uso real, consulte IDs e valores da base via `/api/foods`.

## Precisão e erros

`BigDecimal` em toda aritmética; HALF_UP e duas casas na saída. FAO multiplica TMB exata pelo PAL antes de arredondar; composição soma porções exatas antes de arredondar. Saldo usa meta apresentada menos consumo apresentado. Kcal da base são preservadas, sem reconstrução por macros.

Campos desconhecidos, enums/tipos inválidos, combinações incompatíveis e entradas fora do escopo geram HTTP 400 (`application/problem+json`). Todo 400 inclui `errors[{field,message}]`, também para parâmetros de URL e JSON ilegível (ex.: `foods[0].foodId`, propriedade desconhecida `targetKcal`); a lista fica vazia apenas quando não há campo identificável, como em JSON malformado. Alimento inexistente retorna 404. Não há compatibilidade artificial com o antigo objeto `energy` de `/api/target-calculations`; ele agora é rejeitado.

Metas e quantidades têm limites técnicos de dígitos. Peso/altura positivos; idade inteira de 19 a 130 quando informada; quantidades positivas até 3 casas; fatores e macros até 4 casas (PAL FAO até 2).

## Testes

`mvn clean verify` cobre as oito equações DRI, FAO/BMR/PAL/limites etários, precisão sem arredondamento intermediário, objetivos sem efeito matemático, atividade DRI sem conversão para FAO, independência de prescrição, macros, composição, contratos HTTP e catálogo. A suíte não exige PostgreSQL; integração real é verificada separadamente.
