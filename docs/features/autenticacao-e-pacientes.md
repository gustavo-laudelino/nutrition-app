# Feature: Login de nutricionista e cadastro de pacientes

Épico: **Nutricionista e pacientes** (novo) · Definida em 17/09/2026.

Leia antes o [HANDOFF.md](../../HANDOFF.md) (seções 1, 2, 8 e 11). Continuam valendo: **não executar comandos Git**, não inventar regras, executar build/testes, atualizar README/HANDOFF ao final e **não gerar o JAR com a API rodando a partir de `target/`**.

## Objetivo

Permitir que um nutricionista crie conta, faça login e gerencie **seus** pacientes (cadastro básico + medidas atuais). É a base para, em features futuras, vincular planos alimentares a pacientes.

**Sem vínculo com a tela atual de planejamento.** A calculadora/refeições existente continua funcionando exatamente como hoje, sem login, e seus endpoints permanecem públicos. Nada do planejamento passa a ler pacientes nesta entrega.

## Decisões já tomadas pelo usuário (não reabrir)

1. **Autenticação por token JWT** (Bearer), stateless.
2. **Cadastro aberto** de nutricionista: nome, e-mail e senha. Sem confirmação de e-mail e sem recuperação de senha nesta entrega.
3. **Paciente: dados básicos + medidas atuais** (peso, altura, atividade DRI).
4. **PostgreSQL é o banco oficial para nutricionistas e pacientes**, com tabelas criadas por **Flyway**. A tabela `foods` existente não é alterada.
5. **Dependências autorizadas pelo usuário** (exceção à regra de dependências do HANDOFF), e somente estas:
   - backend: `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server` (validação/emissão de JWT com Nimbus, sem biblioteca JWT adicional), `flyway-core`, `flyway-database-postgresql`, e `spring-security-test` (escopo test);
   - frontend: `@angular/router` na **mesma versão** dos demais pacotes Angular (22.1.6), necessário para as novas telas.
   Qualquer outra dependência exige perguntar ao usuário.

## Dados sensíveis (LGPD)

Dados de saúde são dados pessoais sensíveis. Nesta entrega:
- usar **somente pacientes fictícios** em testes, exemplos, documentação e validação;
- **nunca** registrar em log senhas, tokens, nem dados de pacientes (nome, e-mail, telefone, medidas, observações);
- isolamento estrito: um nutricionista **nunca** vê, altera ou descobre a existência de pacientes de outro.

## Backend

### Organização

Novos pacotes por funcionalidade, no padrão do projeto, **separando entidade JPA de DTO**:
- `auth`: configuração de segurança, emissão/validação de token, registro, login, `me`.
- `nutritionist`: entidade/repositório do nutricionista.
- `patient`: entidade, repositório, serviço, controller e DTOs do paciente. O record temporário `PatientContext` existente **não é removido nem alterado** (continua servindo a calculadora); se houver conflito de nome, usar nomes distintos para as novas classes (ex.: `Patient`, `PatientRequest`, `PatientResponse`).

### Banco (Flyway)

- Migration `V1__create_nutritionists_and_patients.sql` em `src/main/resources/db/migration`.
- O banco local já tem a tabela `foods` (não versionada). Configurar Flyway com `baseline-on-migrate: true` e `baseline-version: 0`, para que a V1 rode sobre o banco existente sem tocar em `foods`.
- `ddl-auto: validate` permanece. Flyway roda antes da validação JPA.
- Perfil `test` continua **sem banco**: excluir também a autoconfiguração do Flyway nesse perfil.

Tabelas:

```text
nutritionists
  id             uuid primary key
  name           varchar(120) not null
  email          varchar(254) not null unique   -- sempre armazenado em minúsculas, sem espaços nas pontas
  password_hash  varchar(100) not null          -- BCrypt
  created_at     timestamptz not null

patients
  id               uuid primary key
  nutritionist_id  uuid not null references nutritionists(id)
  name             varchar(120) not null
  birth_date       date
  sex              varchar(10)                   -- FEMALE | MALE | null (não informado)
  phone            varchar(30)
  email            varchar(254)
  notes            varchar(2000)
  weight_kg        numeric(7,3)
  height_cm        numeric(5,2)
  dri_activity     varchar(20)                   -- INACTIVE | LOW_ACTIVE | ACTIVE | VERY_ACTIVE | null
  measured_at      date                          -- data das medidas atuais, opcional
  archived_at      timestamptz
  created_at       timestamptz not null
  updated_at       timestamptz not null
  version          bigint not null               -- controle otimista
  index (nutritionist_id, name)
```

IDs são **UUID** (evitam enumeração). Medidas guardam apenas o **valor atual**; histórico de avaliações é feature futura.

### Autenticação

- Senhas com **BCrypt**. Senha: 8 a 72 caracteres (limite técnico do BCrypt). Nenhuma outra regra de complexidade.
- Token JWT **HS256**, assinado com segredo da variável de ambiente **`JWT_SECRET`** (mínimo 32 bytes). Sem valor padrão fora do perfil `test`: a API não sobe sem o segredo. O perfil `test` usa um segredo fixo de teste. **Nunca** colocar segredo real em código, docs ou exemplos.
- Claims: `sub` = id do nutricionista, `name`, `iat`, `exp`. Validade **8 horas**. Sem refresh token nesta entrega; ao expirar, novo login.
- Logout é do lado do cliente (descarta o token). Revogação no servidor está fora de escopo; documentar essa limitação.
- API stateless (`SessionCreationPolicy.STATELESS`), CSRF desabilitado (não há cookie de sessão).
- **Endpoints públicos:** `/api/auth/register`, `/api/auth/login` e **todos os endpoints já existentes** (`/api/foods/**`, `/api/energy-estimates`, `/api/energy-prescriptions/**`, `/api/target-calculations/**`, `/api/diet-calculations`). **Protegidos:** `/api/auth/me` e `/api/patients/**`.
- Respostas 401/403 em `application/problem+json`, com `errors` (lista vazia quando não houver campo), seguindo o padrão atual do `ApiExceptionHandler`.

Contratos:

| Método | Endpoint | Corpo | Resposta |
|---|---|---|---|
| POST | `/api/auth/register` | `{name, email, password}` | **201** + mesma resposta do login (já autenticado) |
| POST | `/api/auth/login` | `{email, password}` | **200** `{accessToken, tokenType: "Bearer", expiresAt, nutritionist: {id, name, email}}` |
| GET | `/api/auth/me` | — | **200** `{id, name, email}` |

Regras:
- E-mail normalizado (trim + minúsculas) antes de salvar e de comparar; validação de formato.
- E-mail já cadastrado no registro → **409** com campo `email` e mensagem em português.
- Login com e-mail inexistente **ou** senha errada → **401** com a **mesma** mensagem genérica ("E-mail ou senha inválidos."), sem indicar qual campo falhou.
- Mensagens de erro em português.

### Pacientes

Todos os endpoints exigem token e operam **somente** sobre pacientes do nutricionista autenticado. Paciente de outro nutricionista ou inexistente → **404** (não 403, para não revelar existência).

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/patients?name=&archived=false&page=0&size=20` | Lista paginada, ordenada por nome; busca por palavras sem acento/caixa (reaproveitar a lógica de `FoodSearch` ou equivalente); por padrão só ativos |
| POST | `/api/patients` | Cria → **201** |
| GET | `/api/patients/{id}` | Detalhe |
| PUT | `/api/patients/{id}` | Atualiza (todos os campos editáveis + `version`); versão desatualizada → **409** |
| POST | `/api/patients/{id}/archive` | Arquiva (define `archived_at`) |
| POST | `/api/patients/{id}/unarchive` | Reativa |

Não há exclusão definitiva nesta entrega.

Corpo de criação/edição:

```json
{
  "name": "Paciente Fictício",
  "birthDate": "1990-05-20",
  "sex": "FEMALE",
  "phone": "(11) 90000-0000",
  "email": "paciente.ficticio@example.com",
  "notes": "Texto livre",
  "weightKg": 68.5,
  "heightCm": 165,
  "driActivity": "LOW_ACTIVE",
  "measuredAt": "2026-09-17",
  "version": 0
}
```

Resposta: todos os campos + `id`, `ageYears` (calculada no backend a partir de `birthDate` e da data atual; `null` sem data), `archived` (boolean), `createdAt`, `updatedAt`, `version`.

Validação (limites técnicos, não nutricionais):
- `name` obrigatório, não branco após trim, até 120.
- `birthDate` opcional, não futura, não anterior a 1900-01-01. **Não** restringir a 19+ no cadastro (a restrição de idade é da calculadora, não do cadastro).
- `sex` opcional: `FEMALE` ou `MALE` (null = não informado).
- `phone` até 30 caracteres livres; `email` opcional com formato válido, até 254; `notes` até 2000.
- `weightKg` e `heightCm` opcionais, positivos, mesmos dígitos de `PatientContext` (peso 4 inteiros/3 decimais; altura 3 inteiros/2 decimais).
- `driActivity` opcional, enum atual; `measuredAt` opcional, não futura.
- Propriedades desconhecidas continuam rejeitadas (400), como no restante da API.
- `version` obrigatório no PUT.

### Testes mínimos (backend)

A suíte continua **sem PostgreSQL**. Testar serviços com repositórios simulados (Mockito, já disponível) e controllers com MockMvc + `spring-security-test`.
- Registro: sucesso retorna token; e-mail normalizado; e-mail duplicado → 409; senha curta/longa → 400.
- Login: sucesso; senha errada e e-mail inexistente → 401 com a mesma mensagem.
- Token: ausente, inválido ou expirado → 401 em `/api/patients` e `/api/auth/me`; válido → acesso.
- Endpoints existentes da calculadora continuam acessíveis **sem token** (ao menos um teste por grupo).
- Pacientes: criar, listar (paginação, busca sem acento, filtro de arquivados), detalhar, editar, arquivar/reativar.
- Isolamento: nutricionista B recebe 404 ao ler, editar ou arquivar paciente de A; listagem de B não inclui pacientes de A.
- `ageYears` calculada corretamente (incluindo aniversário ainda não ocorrido no ano).
- Validações de campos e conflito de versão (409).
- Nenhum log com senha/token/dados do paciente (ao menos revisão de código; teste se viável).

## Frontend (`nutrition-web`)

Adicionar `@angular/router` e rotas. **A tela atual de planejamento não muda** (layout, comportamento e testes existentes intactos) e continua acessível **sem login**.

Rotas:
- `/` e `/planejamento` → tela atual (sem autenticação).
- `/login` e `/cadastro` → telas públicas.
- `/pacientes` → lista (protegida).
- `/pacientes/novo` e `/pacientes/:id` → criar/editar (protegidas).

Comportamento:
- Token guardado em **`sessionStorage`** (some ao fechar a aba) e em memória; nunca em `localStorage`. Interceptor adiciona `Authorization: Bearer` **apenas** em `/api/auth/me` e `/api/patients/**`.
- Guard redireciona para `/login` sem token; resposta 401 limpa a sessão e redireciona para `/login`.
- Login e cadastro: formulários simples, mensagens de erro da API em português, botão desabilitado durante envio. Após sucesso → `/pacientes`.
- Cabeçalho das telas protegidas: nome do nutricionista e "Sair".
- Lista de pacientes: busca por nome (consulta a cada letra com debounce, como a busca de alimentos), alternar ativos/arquivados, paginação, botão "Novo paciente", linha com nome, idade, sexo e data da última medida.
- Formulário do paciente: seções "Dados pessoais" e "Medidas atuais"; **envio só ao salvar** (sem requisição por tecla); arquivar/reativar com confirmação; tratamento do 409 de versão ("O paciente foi alterado em outra sessão. Recarregue.").
- Visual: seguir o padrão atual (fundo claro, pílulas brancas com borda para campos editáveis, botões verde claro translúcido, tipografia de 13 px nos dados).
- Não acoplar pacientes ao planejamento (nenhum botão "abrir no planejamento" nesta entrega).

### Testes mínimos (frontend)

- Todos os testes atuais do planejamento continuam passando sem alteração de comportamento.
- Login: sucesso guarda token e navega; erro exibe mensagem; cadastro idem.
- Interceptor: adiciona Bearer só nas rotas protegidas da API; não adiciona na calculadora.
- Guard: sem token redireciona para `/login`; 401 limpa sessão.
- Lista: busca, filtro de arquivados, paginação.
- Formulário: criar, editar com `version`, erros de validação por campo, conflito 409, arquivar/reativar.

## Fora de escopo

- Recuperação de senha, confirmação de e-mail, refresh token, revogação de token no servidor, limite de tentativas de login, 2FA, papéis/admin.
- Exclusão definitiva de paciente; histórico de avaliações/medidas; anexos.
- Vincular paciente à tela de planejamento, planos alimentares persistidos, refeições persistidas.
- Modelo genérico de nutrientes/micronutrientes (decisão pendente em documento de arquitetura futuro).
- Proteger os endpoints atuais da calculadora.
- Deploy, HTTPS, infraestrutura.

## Ordem de execução sugerida

1. Backend: dependências, Flyway + migration, segurança/JWT, auth, pacientes, testes. Rodar `mvn test`.
2. Frontend: router, auth (serviço, interceptor, guard), login/cadastro, pacientes, testes. Rodar `npm test` e `npm run build`.
3. Validação real: **parar a API**, gerar o JAR, subir com `DB_URL`/`DB_USERNAME`/`DB_PASSWORD` e `JWT_SECRET` (valores fornecidos pelo ambiente do usuário, nunca copiados para arquivos), criar dois nutricionistas **fictícios**, cadastrar pacientes fictícios e conferir isolamento no navegador. Se o ambiente não tiver `JWT_SECRET`, registrar no HANDOFF que a validação real ficou pendente e por quê, sem inventar um segredo em arquivo.
4. Documentação: READMEs (contratos, variáveis de ambiente, rotas) e HANDOFF (seção 2 status, seção 8 stack/dependências, seção 9 contratos, seção 11 banco/Flyway, seção 14 validação).

## Critérios de aceite

- [ ] Registro, login e `me` funcionando com JWT; senhas com BCrypt; mensagens em português.
- [ ] Endpoints da calculadora continuam públicos e a tela de planejamento funciona sem login.
- [ ] CRUD de pacientes (sem exclusão definitiva) com arquivamento, busca, paginação e controle de versão.
- [ ] Isolamento total entre nutricionistas (404 para paciente alheio).
- [ ] Flyway cria as tabelas novas sem alterar `foods`; perfil `test` sem banco.
- [ ] Somente as dependências autorizadas foram adicionadas.
- [ ] Telas de login, cadastro, lista e formulário de pacientes no padrão visual atual.
- [ ] `mvn test`, `npm test` e `npm run build` passando com os testes mínimos.
- [ ] Nenhum segredo, senha, token ou dado de paciente real em código, docs, exemplos ou logs.
- [ ] READMEs e HANDOFF atualizados.
