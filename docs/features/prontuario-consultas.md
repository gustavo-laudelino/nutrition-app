# Épico Prontuário · Feature 2a: prontuário por consulta

Definida e **implementada em 18/09/2026** por Claude, a pedido do usuário. Testes e builds passando; V5 e o fluxo completo conferidos num PostgreSQL descartável. Falta aplicar a V5 no banco real (reiniciar a API) e validar no navegador. Decisões de origem: [prontuario-oficina.md](prontuario-oficina.md), seção "Decisões do usuário para a Feature 2". Segue o padrão das telas do nutricionista: dono do recurso, 404 para recurso alheio, `version` com 409, ProblemDetail com `errors`. Dados de saúde: **apenas pacientes fictícios** até haver revisão de segurança (LGPD).

## Próxima revisão: atendimento pelo prontuário (decisões do usuário, 19/09)

Motivação: na prática, o paciente chega e o cadastro nasce na própria consulta. A tela de cadastro separada deixa de ser o caminho obrigatório (continua existindo para correções).

1. **Entrada:** item **"Atendimento"** na barra lateral. Um botão flutuante "+" fica como possibilidade futura. Ele abre uma busca de paciente: escolher um existente ou digitar só o nome de um novo. A consulta abre direto, com o modelo padrão e a data de hoje.
2. **Cabeçalho fixo em toda consulta** (fora da Oficina): nome, idade (a partir da data de nascimento), sexo e telefone. Vem preenchido pelo cadastro e grava no cadastro.
3. **Aba fixa "Antropometria"** em toda consulta, com **peso e altura**, que são dados essenciais.
4. **Sincronização:** o cabeçalho atualiza o cadastro ao **Salvar** e ao **Concluir**. Peso e altura continuam indo ao cadastro na conclusão, pela regra de data das medidas; se o usuário quiser os dois pontos também para eles, mudar aqui.
5. **Propostas de Claude, a confirmar:**
   - **Obrigatoriedade:** nome obrigatório para criar o paciente; nascimento e sexo obrigatórios para concluir (a estimativa energética precisa deles); telefone opcional.
   - **Peso e altura:** saem da caixa de ferramentas (`weight_kg`/`height_cm` marcados como `deprecated`, sem quebrar modelos existentes) e passam a morar na aba fixa; no modelo inicial, a seção "Antropometria" vira "Medidas corporais" (circunferências). Consultas antigas mantêm a estrutura que copiaram.

## Escopo

- **Entra (2a):** abrir uma consulta para um paciente a partir de um modelo; preencher por seções; salvar rascunho; concluir; reabrir; listar e excluir consultas; sincronizar peso e altura com o cadastro ao concluir.
- **Fica para depois:** evolução das medidas e consulta anterior lado a lado (2b); abrir o planejamento a partir da consulta (2c); campos obrigatórios; histórico de versões das respostas.

## Regras

1. **Consulta** pertence a um paciente e ao nutricionista dono dele. Tem data (não futura), estado `DRAFT` ou `COMPLETED`, o nome do modelo de origem e uma **cópia da estrutura** do modelo no momento em que foi aberta: seções, larguras, alturas e a **definição completa de cada campo** do catálogo. Editar ou excluir o modelo, ou mudar o catálogo, nunca altera consultas já abertas.
2. **Abrir** exige paciente ativo (arquivado → 400 "Reative o paciente para registrar consultas.") e um modelo do próprio nutricionista. O modelo padrão vem pré-selecionado na tela.
3. **Respostas** ficam guardadas por código do campo. Pergunta sem resposta fica ausente (`null`); não há campos obrigatórios. Formato por tipo:

   | Tipo | Valor | Validação |
   |---|---|---|
   | `SHORT_TEXT`, `LONG_TEXT` | texto | não vazio; até `maxLength` |
   | `NUMBER` | número | entre `min` e `max`; até `decimals` casas |
   | `DATE` | `"AAAA-MM-DD"` | data válida |
   | `YES_NO_DETAIL` | `{"answer": true\|false, "detail": "…"}` | `answer` obrigatório; `detail` opcional, até 500 |
   | `SINGLE_CHOICE` | `{"option": "código"}` ou `{"other": "texto"}` | exatamente um; código existente; `other` só com `allowOther`, até 200 |
   | `MULTI_CHOICE` | `{"options": ["código", …], "other": "texto"}` | códigos existentes e sem repetição; `other` só com `allowOther`; ao menos um dos dois |
   | `SCALE` | inteiro | entre `min` e `max` |
   | `TABLE` | `[{"código da coluna": "texto", …}, …]` | até 50 linhas; só colunas da tabela; textos até 500; linhas vazias descartadas |

   Código fora da estrutura da consulta → 400 "Campo fora deste prontuário.". Erros em `answers.<código>`.
4. **Salvar** (PUT) só vale para **rascunho**; consulta concluída → 400 "Reabra a consulta para editar.". Exige `version` (diferente → 409 "A consulta foi alterada em outra sessão. Recarregue.").
5. **Concluir** marca `COMPLETED`. Na primeira conclusão, grava `firstCompletedAt`; em toda conclusão, `completedAt`. **Sincroniza** as respostas dos campos com `sync` (peso e altura) com o cadastro, quando o paciente não tem data de medidas ou a data da consulta é **igual ou posterior** à data das medidas: atualiza o valor e `measuredAt` passa a ser a data da consulta.
6. **Reabrir** volta para `DRAFT` e grava `reopenedAt` (o "registro" de alteração após concluir). A tela mostra "Concluída em … · reaberta em …".
7. **Excluir**: consulta **nunca concluída** é apagada de fato. Consulta **já concluída alguma vez** sai das telas, mas continua guardada (`deletedAt`), por causa da guarda de prontuários (Lei 13.787/2018: 20 anos). É uma proposta provisória, a confirmar com o nutricionista/CRN.

## Backend

Pacote novo `consultation`. **V5** cria:

```text
consultations
  id                 uuid primary key
  nutritionist_id    uuid not null references nutritionists(id)
  patient_id         uuid not null references patients(id)
  template_id        uuid references record_templates(id) on delete set null   -- só referência
  template_name      varchar(60) not null
  structure          text not null        -- JSON da cópia da estrutura
  answers            text not null        -- JSON {código: valor}
  consultation_date  date not null
  status             varchar(10) not null -- DRAFT | COMPLETED
  first_completed_at, completed_at, reopened_at, deleted_at  timestamptz
  created_at, updated_at timestamptz not null
  version            bigint not null
  index (patient_id, consultation_date)
```

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/patients/{patientId}/consultations` | Consultas não excluídas, da mais recente para a mais antiga (data, depois criação): `[{id, date, status, templateName, firstCompletedAt, completedAt, reopenedAt, updatedAt}]` |
| POST | `/api/patients/{patientId}/consultations` | `{templateId, date}` → 201 com a consulta completa |
| GET | `/api/consultations/{id}` | `{id, patientId, date, status, templateName, sections: [{name, fields: [{width, textRows, field}]}], answers, firstCompletedAt, completedAt, reopenedAt, updatedAt, version}` |
| PUT | `/api/consultations/{id}` | `{date, version, answers}` (rascunho) |
| POST | `/api/consultations/{id}/complete` | `{version}`; conclui e sincroniza |
| POST | `/api/consultations/{id}/reopen` | `{version}`; volta a rascunho |
| DELETE | `/api/consultations/{id}` | 204; apaga ou oculta conforme a regra 7 |

Paciente ou consulta alheios/inexistentes → 404 "Paciente não encontrado." / "Consulta não encontrada.". Consulta excluída logicamente → 404.

## Frontend

- **Paciente** (`/pacientes/:id`): botão **"Consultas"** no topo.
- **`/pacientes/:id/consultas`**: nome, idade e sexo do paciente; **Nova consulta** (modelo, com o padrão pré-selecionado, e data, com hoje pré-preenchido) cria a consulta e a abre; lista com data, modelo, estado ("Rascunho" / "Concluída em …", "· reaberta em …"), Abrir e Excluir com confirmação. O texto da confirmação diz se a consulta será apagada ou se sai da lista e fica guardada. Sem modelos: link para criar um na Oficina.
- **`/pacientes/:id/consultas/:consultaId`**: cabeçalho com paciente, data (editável no rascunho), estado e ações (**Salvar rascunho**, **Concluir**; concluída: **Reabrir**). Seções em abas e campos na grade de larguras do modelo, preenchíveis. Concluída fica somente leitura. Sair com alterações não salvas pede confirmação. Erro 400 abre a seção do campo e o destaca; 409 oferece recarregar. Ao concluir, avisa se peso/altura atualizaram o cadastro.
- O componente de campo da Oficina passa a ser um controle com valor (`FieldControl`): na folha da Oficina fica estático, na pré-visualização é preenchível sem salvar, e na consulta preenche as respostas.
