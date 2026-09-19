# nutrition-web

Angular 22 + TypeScript. Angular CLI utiliza Vite no servidor de desenvolvimento, sem configuração Vite paralela.

## Executar

Inicie a API com PostgreSQL e as variáveis `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` no ambiente do backend. Depois, em `nutrition-web`:

```powershell
npm ci
npm start
```

Abra http://127.0.0.1:4200. `proxy.conf.cjs` encaminha `/api/**` para http://127.0.0.1:8081. `API_TARGET` permite outra porta. Nenhuma credencial do banco é enviada ao navegador.

## Fluxo do planejamento

1. **Paciente:** o botão Paciente abre um **menu suspenso compacto logo abaixo dele, só com busca e nomes** dos pacientes do nutricionista; escolher, clicar fora ou Esc fecham o menu. Os dados do paciente e o **Objetivo** ficam no painel **"Dados do paciente"**, que hoje só abre pelo aviso "Abrir paciente" da estimativa (o botão do topo foi removido; acesso a redefinir). A lista mostra ativos, 20 primeiros, busca por nome com debounce de 250 ms, escolhido marcado, e "Cadastrar paciente" quando a lista está vazia. A escolha preenche nome, sexo, peso, altura, atividade DRI e a idade calculada pelo backend, e os campos ficam somente leitura. **Editar** libera os campos e **Salvar no cadastro** grava com `PUT /api/patients/{id}` (envia o paciente inteiro, preservando telefone, e-mail, observações, nascimento e data das medidas; 409 pede recarregar). **Desvincular** volta ao preenchimento livre mantendo os valores. No painel "Dados do paciente", com paciente escolhido os campos ficam somente leitura até Editar; sem paciente escolhido, é o preenchimento temporário. Sem sessão, o menu só oferece Entrar. Objetivo é apenas contexto da tela e não vai para o cadastro. Abaixo de 19 anos não há estimativa automática (as equações cobrem adultos 19+). O planejamento em si (refeições e metas) continua não sendo salvo.
2. **Estimativa automática DRI:** método inicial DRI 2023. Confirmar os cinco dados necessários (sair do campo, Enter ou Concluir) dispara o cálculo após 300 ms. Abaixo da estimativa, o botão discreto **Calcular estimativa energética com outra fórmula** revela FAO e fórmula de bolso, com opção de voltar à DRI. FAO solicita PAL numérico próprio. Bolso solicita kcal/kg e preenche diretamente a meta prescrita com o cálculo do backend, sem cartão de estimativa. Dados incompatíveis são rejeitados no backend.
3. **Decisão profissional:** a estimativa mostra método e parâmetros utilizados. O botão **Usar estimativa como meta** copia explicitamente seu valor para a prescrição. Também é possível digitar qualquer meta positiva sem estimativa, editar o valor ou removê-lo. Recalcular DRI/FAO preserva a prescrição. No modo bolso, alterar peso/fator recalcula a meta; objetivo e outros dados não a alteram. Uma edição manual cancela a requisição pendente; voltar a DRI/FAO preserva a última meta.
4. **Macros opcionais:** nenhum ou percentual da energia prescrita, com as faixas DRI/AMDR exibidas apenas como sugestão. Trocar de método limpa os números.
5. **Refeições temporárias (retráteis):** a tela começa sem refeições; atalhos criam Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar e Ceia, e há nome livre com o botão Nova refeição. Cada refeição é uma linha em grid compartilhado: `[alça] horário | nome | itens/peso/ação | C | P | G | kcal | remover`. Recolhida mostra só o resumo; o botão "N itens" abre/fecha os alimentos. Há "expandir todas" e "recolher todas"; recolher fecha a busca daquela refeição, e criar uma refeição ou abrir sua busca a expande. Campos editáveis (horário, nome, peso) têm fundo branco e borda; valores de leitura não têm borda. Renomear clicando no nome. Horário opcional HH:mm em 24 h (máscara própria), **só na tela**, não enviado à API. Reordenar arrastando pela alça (Angular CDK: bloco segue o ponteiro e vizinhos deslizam) ou com ↑/↓ na alça em foco. Excluir pede confirmação se houver alimentos. A busca de alimentos fica **dentro de cada refeição** (não há catálogo global): o botão "+ Adicionar alimento" do cartão abre a busca naquela refeição, com uma busca aberta por vez; criar uma refeição já abre sua busca. Nome de refeição nunca é enviado vazio: "Nova refeição" fica desabilitado sem nome, e ao apagar o nome de uma refeição o último nome válido continua sendo enviado e é restaurado ao sair do campo (correção de 16/09).
6. **Total do dia:** barra de valor energético ("consumido / meta", restante e %), donut com a distribuição da energia dos macros (`macroEnergyShares`, calculado pelo backend) cercado por um anel com um trecho por meta de macro que enche conforme consumido / meta, e uma barra por macro (C, P, G) com "consumido / meta". Barras param na meta; excedente fica em tom forte com "Acima da meta em X". Passar o mouse ou dar foco em um macro (barra, fatia ou arco) destaca esse macro no donut, clareia os demais e mostra uma descrição com consumido, % da energia dos macros, meta e restante; com o mouse ela segue o cursor, e com o teclado fica ancorada sob o donut. Cores em variáveis CSS: `--energy` verde, `--carb` azul, `--protein` vermelho, `--fat` amarelo (paleta de referência original, restaurada em 17/09). Os valores vêm exclusivamente dos totais diários retornados pelo backend. Cada cartão mostra os quatro totais da refeição, sem metas próprias. A soma de valores exibidos por refeição pode diferir em centésimos do total diário, pois o backend arredonda apenas após somar as porções exatas.
7. **Definir composição como meta:** botão no resumo do dia chama `POST /api/target-calculations/from-composition` e aplica a meta energética (= kcal consumidas) e os percentuais de macros equivalentes. Se já houver meta, pede confirmação mostrando a atual e a nova. Quando essa meta volta do backend com restante zero, roda uma animação (barras e donut de 0 ao valor, tremor e confetes, sem biblioteca), desativada com "reduzir movimento". As barras de macros ficam próximas de 100%, não exatas (kcal da tabela ≠ 4/4/9).

**Opções de refeição:** no corpo da refeição aberta, abas "Opção 1", "Opção 2"… e "+" (nova opção vazia, até 5). Abas renomeáveis por clique duplo, F2 ou menu do botão direito (Renomear / Definir como principal / Fechar opção); o nome é só da tela. Só a Opção 1 conta para metas, saldos e resumo do dia (regra do backend); as outras mostram "Totais da Opção N · não conta na meta". "Tornar opção 1" move a opção aberta para o início; "Remover opção" pede confirmação se tiver alimentos e renumera. A linha resumida mostra sempre a Opção 1, com "+N opções" junto ao nome. Adicionar, remover e editar alimentos atuam na opção aberta. Abas acessíveis (←/→).

**Visual de aba de navegador (18/09):**
- A aba ativa se funde com a folha da refeição.
- **×** em cada aba; botão do meio do mouse ou Delete também fecham. Aba com alimentos pede confirmação.
- Arrastar uma aba reordena as opções; a primeira conta na meta.

**Fibra e micronutrientes:** o card de análise ganhou a barra **Fibra alimentar** (cor `--fiber`, verde-água):
- mostra "consumido / referência g" e "% da referência (AI)", ou "Sem referência";
- fica fora do donut.

Abaixo do card, na mesma coluna lateral, o relatório **Micronutrientes**:
- recolher/expandir; começa expandido;
- grupos Minerais, Vitaminas e Lipídios, na ordem do backend;
- cada linha tem nome, consumido / referência + unidade e uma barra de 0 a 200% da referência, com a linha tracejada da referência no meio e "›" acima de 200%;
- `*` marca total parcial ("Sem dado em N alimentos"), e "—" indica sem dado;
- rodapé com a fonte e o perfil, ou "Informe sexo e idade do paciente…".

Regras:
- O pedido envia `referenceProfile` só com sexo ≠ não informado e idade preenchida. Mudar sexo ou idade recalcula.
- Em telas ≥ 861 px a coluna lateral é `sticky` com rolagem própria.
- Sem `nutrients` (API antiga), o relatório fica vazio sem erro.
- Refeições não mostram micronutrientes, e o Angular não calcula nada nutricional (só posições de desenho).

**Porção pelo nutriente:** na linha do alimento, clicar em C, P, G ou kcal transforma o chip num campo; Enter/sair confirma e Esc cancela. O peso vem de `POST /api/portion-quantities` (arredondado a 0,1 g pelo backend) e é aplicado como edição de quantidade. Só aparece para nutrientes que o alimento tem; erros ficam marcados no chip sem mudar a porção.

Só a busca consulta a cada letra (200 ms de debounce). Quantidade recalcula ao confirmar; nome não recalcula; criar, adicionar/remover, reordenar e excluir recalculam imediatamente. Cada requisição cancela a anterior, e os últimos totais permanecem na tela até a resposta (retirados só em erro). O payload é `{targets, meals:[{name, options:[{foods:[{foodId, quantityG}]}]}]}` (todas as opções, na ordem das abas); a resposta mantém a ordem das refeições e das opções, e o backend calcula o dia **só com a Opção 1** de cada refeição. Não há armazenamento local nem metas por refeição; o horário não entra no payload.

Estimativas/metas são atualizadas 300 ms após confirmar o campo (sair, Enter ou Concluir), ou por botão. Estados, erros e cancelamento das requisições são separados. Uma estimativa inválida não impede prescrição manual e alimentos. Valores anteriores permanecem visíveis enquanto recalculam; são retirados apenas em erro ou quando os dados ficam incompletos.

O frontend não calcula fórmulas, macros, diferença prescrição−estimativa ou saldos. DRI/FAO só são copiadas ao clicar no botão. Bolso preenche diretamente a meta com o resultado do endpoint de prescrição. A diferença exibida vem da API. Metas percentuais usam exclusivamente a prescrição.

MVP restrito a adultos 19+ não gestantes/lactantes. Não há campo nem validação de condição fisiológica. Nenhum fator é selecionado pelo objetivo, e não há conversão de atividade entre metodologias.

Sem meta, o resumo mostra somente o consumido. Zero de macros é diferente de campo vazio; metas parciais comparam apenas os nutrientes definidos. Valores negativos de restante indicam excedente.

## Validação

```powershell
npm run build
npm test
```

Saída em `dist/nutrition-web/browser`; publicação exige encaminhamento de `/api/**` pelo servidor. A suíte verifica separação entre estimativa/prescrição/composição, ação explícita de aplicar estimativa, preservação da prescrição após mudanças, parâmetros por metodologia, metas parciais, erros, debounce e cancelamento de requisições.

O planejamento não é persistido: recarregar o descarta. A sessão das novas telas usa somente sessionStorage. Consulte também o `HANDOFF.md` na raiz para decisões e continuidade do desenvolvimento.

Validação do planejamento em 16/09: **44 testes frontend** passando; `npm run build` e `npm test` concluídos. Cobertura de criação, busca por refeição, edição, exclusão com confirmação, reordenação (teclado e soltar), horário 24 h, envio só ao confirmar, manutenção dos valores durante recálculo, composição como meta (direta e com confirmação) e animação sem disparos indevidos. Dependência adicional: `@angular/cdk` 22.1.6 (decisão do usuário).


## Rotas e sessão (17/09/2026)

Foi adicionado somente `@angular/router` 22.1.6. O `Shell` hospeda as rotas. As telas do nutricionista ficam dentro de `NutritionistLayout`, com **barra lateral esquerda** (Perfil, Pacientes, Planejamento alimentar, nome e Sair) exibida só com sessão; abaixo de 860 px ela vira barra superior. O planejamento é mantido em memória ao navegar pela barra (`PlanningReuseStrategy`) e descartado ao recarregar, sair ou trocar de conta.

| Rota | Acesso / função |
|---|---|
| `/` | Redireciona para `/planejamento` |
| `/planejamento` | Planejamento (público por enquanto); com sessão, escolhe pacientes cadastrados |
| `/perfil` | Dados da conta do nutricionista (protegida, somente leitura) |
| `/login` | Login de nutricionista |
| `/cadastro` | Cadastro aberto de nutricionista |
| `/pacientes` | Lista protegida |
| `/pacientes/novo` | Novo paciente |
| `/pacientes/:id` | Editar paciente |

Cadastro/login navegam para `/pacientes`. Token em memória e `sessionStorage`, nunca localStorage. Ao recarregar com sessão, `/api/auth/me` recupera o nome para a barra lateral; “Sair” limpa sessão e navega para login. Interceptor envia Bearer somente à própria origem em `/api/auth/me`, `/api/patients`, `/api/record-fields`, `/api/record-templates` e subrotas. Nunca envia ao planejamento nem a outros servidores. Guard redireciona sem token; 401 protegido limpa a sessão. O token expira em 8 horas, exigindo novo login. Logout não revoga o token no backend.

Lista pesquisa a cada letra com debounce de 250 ms e cancela consultas anteriores; filtro ativos/arquivados reinicia na página zero. Exibe idade e data de medidas retornadas pelo backend. Formulário separa Dados pessoais e Medidas atuais e só envia ao salvar. Edição envia a versão recebida; 409 bloqueia novo salvamento até “Recarregar paciente”. Arquivar/reativar exige confirmação; alterações não salvas são descartadas quando a ação é confirmada. Erros por campo vêm da API. Não há fórmulas nem integração com a calculadora nessas telas.

Build de produção exige fallback das rotas Angular para `index.html`, além do encaminhamento `/api/**`; infraestrutura continua fora do escopo.

### Validação atual

**61 testes passando** (44 de planejamento intactos + 17 de auth/pacientes); `npm run build` passou. Navegador: login, cadastro e sua navegação conferidos visualmente; `/pacientes` sem sessão redireciona a `/login`; `/planejamento` abre sem autenticação. **Fluxos autenticados no navegador/PostgreSQL pendentes por ausência de `JWT_SECRET`**, conforme HANDOFF. API nova está parada e o planejamento mostra erro de serviço enquanto ela não for iniciada com o segredo; não confundir com teste integrado concluído.

`npm audit` apontou dois alertas em dependências de desenvolvimento já existentes: `vitest` 4.0.18 (crítico) e `@vitest/mocker` (moderado), com correção indicada em Vitest 4.1.11. Nenhuma atualização automática foi aplicada, preservando a lista e versões autorizadas; revisão dessa ferramenta de testes fica registrada como pendência separada.

**Opções de refeição e nutrientes (18/09):** **94 testes** passando (`npm test`), incluindo 10 de opções (abas de navegador) e 4 de fibra/relatório/perfil de referência; `npm run build` passou. Conferido no navegador com a API nova sobre um PostgreSQL descartável com dados TACO reais (abas de opções, totais da Opção 2, fibra e relatório).

## Prontuário: Oficina de modelos (18/09/2026)

Especificação: [docs/features/prontuario-oficina.md](../docs/features/prontuario-oficina.md). Na barra lateral, "Prontuário" fica entre Pacientes e Planejamento. As rotas são protegidas e carregadas sob demanda (`loadComponent`), fora do pacote inicial:

| Rota | Função |
|---|---|
| `/prontuario` | Redireciona para `/prontuario/modelos` |
| `/prontuario/modelos` | Lista de modelos com as ações: novo (modelo inicial ou em branco), abrir, duplicar, tornar padrão e excluir com confirmação |
| `/prontuario/modelos/:id` | Oficina; ao sair com alterações não salvas, pede confirmação (guard de rota e `beforeunload`) |

Código em `app/records/`: `records-api.ts` (contratos), `template-list.*`, `oficina.*` e `field-preview.*`. Este último desenha cada tipo de campo, desabilitado na folha e preenchível na pré-visualização.

**Oficina.** Área de trabalho delimitada, com a altura da janela e até 1440 px de largura. Tem três colunas, cada uma com rolagem própria:
- **Ferramentas:** busca por palavras sem acento, categorias recolhíveis e o catálogo vindo da API. Um campo já usado aparece como "no modelo" e, se clicado, é selecionado na folha. Para adicionar, arraste para a folha ou tecle Enter/clique, e o campo entra no fim da seção aberta.
- **Folha:**
  - seções como abas: clique duplo ou F2 renomeia; botão direito abre Renomear / Mover para a esquerda / Mover para a direita / Excluir seção; arrastar reordena; "+" cria uma seção já em modo de renomear;
  - excluir uma seção com campos pede confirmação e devolve os campos à caixa de ferramentas;
  - os campos ficam numa grade que quebra linha, com larguras 1/3, 1/2, 2/3 ou inteira;
  - arrastar reordena os campos; Alt+↑/↓ também; Delete remove;
  - o botão direito no campo oferece "Mover para …" e "Remover do modelo".
- **Propriedades:** tipo, categoria, resumo da configuração, aviso de sincronização com o cadastro, largura (bloqueada em tabela), altura (só texto longo), seção e remover. Sem campo selecionado, mostra os dados do modelo e "Tornar padrão".

A barra superior tem o nome editável no lugar, o estado ("Tudo salvo" ou "Alterações não salvas"), **Pré-visualizar** (preenchível; nada é salvo nem enviado) e **Salvar**, que envia a estrutura inteira. Um erro 400 abre a seção do campo com problema e o destaca; um 409 oferece recarregar. Abaixo de 1024 px, aparece só o aviso "A Oficina precisa de uma tela maior.". O arrastar e soltar usa o `@angular/cdk`, que já estava no projeto, com `cdkDropListOrientation="mixed"` na grade.

**Validação (18/09):** **110 testes** passando, sendo 14 da Oficina e da lista; `npm run build` também passa. No navegador, contra a API nova num PostgreSQL descartável, foram conferidos: lista, Oficina, arrastar da caixa para a folha, reordenar arrastando, salvar (ordem gravada no banco conferida) e pré-visualização, sem erros no console. O pacote inicial está em 609 kB, acima do aviso de 600 kB do `angular.json`. O crescimento vem do planejamento (renomear e menu das abas de opção); as telas do prontuário já ficam fora do pacote inicial.

## Prontuário por consulta (18/09/2026, entrega 2a)

Especificação: [docs/features/prontuario-consultas.md](../docs/features/prontuario-consultas.md). Código em `app/consultations/`. As telas são carregadas sob demanda:

| Rota | Função |
|---|---|
| `/pacientes/:id/consultas` | Lista de consultas do paciente (botão **Consultas** no cadastro): estado, abrir, excluir com confirmação e **Nova consulta** (modelo padrão e hoje pré-selecionados) |
| `/pacientes/:id/consultas/:consultaId` | Preenchimento: seções em abas com o progresso (respondidas/total), campos na grade do modelo, **Salvar rascunho**, **Concluir** (salva antes o que está na tela) e **Reabrir**. Concluída fica somente leitura. Sair com alterações pede confirmação; erro de campo abre a seção dele; 409 oferece recarregar |

`records/field-control.*` (antes `field-preview`) é o controle de cada tipo de campo, com valor (`model`): estático na folha da Oficina, preenchível e descartável na pré-visualização, e preenchendo as respostas na consulta. O interceptor envia o token também para `/api/consultations`. **118 testes** passando.
