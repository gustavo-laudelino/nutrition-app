# Feature: paciente cadastrado no planejamento

Épico: **Nutricionista e pacientes** · Definida em 17/09/2026.

Leia antes o [HANDOFF.md](../../HANDOFF.md) (seções 1, 2, 5, 9 e 10) e a [feature de login e pacientes](autenticacao-e-pacientes.md). Continuam valendo: **não executar comandos Git**, não inventar regras, nenhuma fórmula nutricional no Angular, executar build/testes e atualizar README/HANDOFF ao final.

## Objetivo

No planejamento, poder **escolher um paciente já cadastrado** em vez de digitar os dados de novo, e **editar o cadastro dele pela própria tela**. Sem plano alimentar persistido.

## Decisões do usuário (17/09, não reabrir)

1. **Escopo:** somente escolher o paciente e editar seu cadastro. **Nada do planejamento é salvo** (refeições, metas e estimativa continuam temporários e somem ao recarregar).
2. **Acesso:** a tela de planejamento **continua pública por enquanto**. Direção registrada: no futuro a calculadora passa a fazer parte do acesso do nutricionista; não criar nada que dificulte essa mudança.
3. **Edição:** com paciente escolhido, os campos do painel Paciente ficam **somente leitura**. O botão **Editar** libera os campos e **salvar grava direto no cadastro** (`PUT /api/patients/{id}`).
4. **Menor de 19 anos:** pode ser escolhido. A estimativa automática **não roda** e a tela explica que as equações cobrem adultos 19+. Prescrição manual, macros e composição continuam funcionando.

**Plano alimentar persistido continua fora de escopo**, conforme HANDOFF: depende do documento de arquitetura do modelo genérico de nutrientes.

## Backend

**Nenhuma mudança.** A feature usa o que já existe:
- `GET /api/patients?name=&archived=false&page=&size=` para a busca (só ativos);
- `GET /api/patients/{id}` ao recarregar um paciente;
- `PUT /api/patients/{id}` para salvar a edição, com `version` (conflito → 409);
- `ageYears` já vem calculada pelo backend; o Angular não calcula idade.

Continua valendo: paciente de outro nutricionista ou inexistente → 404.

## Frontend (`nutrition-web`)

### Escolher

- **Ajustes do usuário (17/09):** o botão **Paciente** do topo abre um **menu suspenso compacto logo abaixo dele, só com busca e nomes** dos pacientes do nutricionista (sem dados, objetivo ou formulário). Escolher fecha o menu; clicar fora ou Esc também fecha; reabrir reaproveita a lista carregada. Os dados do paciente e o **Objetivo** ficam no painel lateral **"Dados do paciente"** (botão do topo removido a pedido do usuário; hoje abre pelo aviso da estimativa — acesso a redefinir). A navegação entre Perfil (conta do nutricionista), Pacientes e Planejamento é uma **barra lateral esquerda** visível com sessão.
  - **com sessão:** a lista (ativos, 20 primeiros, ordem por nome) carrega ao abrir, com busca por nome acima (debounce de 250 ms, cancelando consultas anteriores). Cada item mostra nome, idade, sexo e peso; o escolhido fica marcado. Lista vazia oferece "Cadastrar paciente" (`/pacientes/novo`). Com mais de 20, a tela avisa e sugere a busca.
  - **sem sessão:** texto e botão **Entrar** (`/login`); o formulário temporário antigo só aparece se a pessoa clicar em **Preencher dados sem cadastro** (a calculadora continua pública por enquanto).
  - Os campos do paciente aparecem **somente em Editar** (com sessão) ou no preenchimento sem cadastro. O **Objetivo** (só da tela) fica disponível abaixo sempre que há paciente escolhido.
- Ao escolher, o `PatientContext` do planejamento é preenchido: `name`, `sex` (sem sexo no cadastro → `UNSPECIFIED`), `weightKg`, `heightCm`, `driActivity` e `age` = `ageYears` do backend. **Objetivo não existe no cadastro**: continua escolha da tela, preservado ao trocar de paciente.
- O painel e o botão do topo mostram qual paciente está selecionado. **Desvincular** volta ao modo livre, mantendo os valores na tela (nada é apagado) e liberando os campos.
- Escolher, desvincular e salvar edição disparam recálculo pelas regras atuais (estimativa/metas com os 300 ms de sempre).

### Editar (grava no banco)

- Com paciente escolhido, o painel mostra o resumo do paciente (nome, idade, peso, altura, data das medidas) com **Editar** e **Desvincular**; os campos não aparecem (e ficam travados internamente) até clicar em **Editar**.
- Em edição: nome, peso, altura, atividade DRI e sexo ficam editáveis; **Salvar** envia `PUT /api/patients/{id}` e **Cancelar** volta aos valores do cadastro.
- O PUT substitui o paciente inteiro: enviar o **paciente carregado** com os campos editados por cima, para **não apagar** telefone, e-mail, observações, data de nascimento e data das medidas.
- `version` é a do paciente carregado. **409** mostra "O paciente foi alterado em outra sessão. Recarregue." com botão que recarrega pelo `GET /api/patients/{id}`.
- Idade não é editável aqui (vem da data de nascimento, que se edita na tela de pacientes).
- Erros por campo da API aparecem junto do campo, em português.
- Objetivo não é enviado ao cadastro.

### Idade abaixo de 19

- Com `ageYears < 19`, a estimativa automática não é disparada e o bloco de estimativa mostra: as equações DRI/FAO cobrem adultos 19+. Sem erro automático e sem bloquear o resto da tela.

### Testes mínimos (frontend)

- Sem sessão: painel oferece entrar, sem chamar `/api/patients`; formulário só após "Preencher dados sem cadastro".
- Com sessão: abrir o painel lista os pacientes sem formulário; lista vazia oferece cadastrar.
- Busca com debounce, cancelamento e escolha preenchendo os campos do planejamento (incluindo idade do backend e sexo ausente → `UNSPECIFIED`).
- Campos somente leitura com paciente escolhido; **Editar** libera; **Cancelar** restaura.
- Salvar envia PUT com o corpo completo (preservando campos não exibidos), com `version`; 409 exibe a mensagem e recarrega.
- Desvincular mantém os valores e libera os campos.
- Paciente com menos de 19 anos: nenhuma requisição de estimativa e aviso na tela.
- Os testes atuais do planejamento continuam passando sem alteração de comportamento.

## Fora de escopo

- Plano alimentar persistido, refeições/metas salvas, histórico de avaliações.
- Criar paciente pela tela de planejamento (continua em `/pacientes/novo`).
- Proteger a calculadora com login (decisão futura registrada na direção do produto).
- Levar objetivo (perda/manutenção/ganho) para o cadastro do paciente.

## Ordem de execução

1. Frontend: serviço/estado do paciente selecionado, seção do painel, modo leitura/edição, regra dos 19 anos.
2. `npm test` e `npm run build`.
3. Navegador: escolher, editar, salvar, 409, desvincular e paciente menor de 19 — com pacientes **fictícios**.
4. Documentação: README do frontend, HANDOFF (seções 2, 3, 10 e 14).

## Critérios de aceite

- [ ] Escolher paciente cadastrado preenche nome, sexo, peso, altura, atividade e idade no planejamento.
- [ ] Sem sessão, a tela explica e leva ao login; a calculadora continua funcionando sem login.
- [ ] Com paciente escolhido os campos ficam somente leitura; Editar + Salvar gravam no cadastro sem apagar os outros campos.
- [ ] Conflito de versão tratado com mensagem e recarga.
- [ ] Desvincular volta ao modo livre sem perder os valores da tela.
- [ ] Paciente com menos de 19 anos não dispara estimativa e a tela explica o motivo.
- [ ] Nenhum plano é persistido; recarregar continua descartando o planejamento.
- [ ] `npm test` e `npm run build` passando; HANDOFF e READMEs atualizados.
