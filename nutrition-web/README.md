# nutrition-web

Angular 22 + TypeScript. Angular CLI utiliza Vite no servidor de desenvolvimento, sem configuração Vite paralela.

## Executar

Inicie a API com PostgreSQL e as variáveis `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` no ambiente do backend. Depois, em `nutrition-web`:

```powershell
npm ci
npm start
```

Abra http://127.0.0.1:4200. `proxy.conf.cjs` encaminha `/api/**` para http://127.0.0.1:8081. `API_TARGET` permite outra porta. Nenhuma credencial do banco é enviada ao navegador.

## Fluxo

1. **Paciente temporário:** nome, peso, altura, idade, sexo, objetivo e atividade física DRI. Dados ficam em painel lateral aberto pelo botão Paciente; ainda não há entidade de paciente/usuário nem gravação. Objetivo é apenas contexto.
2. **Estimativa automática DRI:** método inicial DRI 2023. Confirmar os cinco dados necessários (sair do campo, Enter ou Concluir) dispara o cálculo após 300 ms. Abaixo da estimativa, o botão discreto **Calcular estimativa energética com outra fórmula** revela FAO e fórmula de bolso, com opção de voltar à DRI. FAO solicita PAL numérico próprio. Bolso solicita kcal/kg e preenche diretamente a meta prescrita com o cálculo do backend, sem cartão de estimativa. Dados incompatíveis são rejeitados no backend.
3. **Decisão profissional:** a estimativa mostra método e parâmetros utilizados. O botão **Usar estimativa como meta** copia explicitamente seu valor para a prescrição. Também é possível digitar qualquer meta positiva sem estimativa, editar o valor ou removê-lo. Recalcular DRI/FAO preserva a prescrição. No modo bolso, alterar peso/fator recalcula a meta; objetivo e outros dados não a alteram. Uma edição manual cancela a requisição pendente; voltar a DRI/FAO preserva a última meta.
4. **Macros opcionais:** nenhum ou percentual da energia prescrita, com as faixas DRI/AMDR exibidas apenas como sugestão. Trocar de método limpa os números.
5. **Refeições temporárias (retráteis):** a tela começa sem refeições; atalhos criam Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar e Ceia, e há nome livre com o botão Nova refeição. Cada refeição é uma linha em grid compartilhado: `[alça] horário | nome | itens/peso/ação | C | P | G | kcal | remover`. Recolhida mostra só o resumo; o botão "N itens" abre/fecha os alimentos. Há "expandir todas" e "recolher todas"; recolher fecha a busca daquela refeição, e criar uma refeição ou abrir sua busca a expande. Campos editáveis (horário, nome, peso) têm fundo branco e borda; valores de leitura não têm borda. Renomear clicando no nome. Horário opcional HH:mm em 24 h (máscara própria), **só na tela**, não enviado à API. Reordenar arrastando pela alça (Angular CDK: bloco segue o ponteiro e vizinhos deslizam) ou com ↑/↓ na alça em foco. Excluir pede confirmação se houver alimentos. A busca de alimentos fica **dentro de cada refeição** (não há catálogo global): o botão "+ Adicionar alimento" do cartão abre a busca naquela refeição, com uma busca aberta por vez; criar uma refeição já abre sua busca. Nome de refeição nunca é enviado vazio: "Nova refeição" fica desabilitado sem nome, e ao apagar o nome de uma refeição o último nome válido continua sendo enviado e é restaurado ao sair do campo (correção de 16/09).
6. **Total do dia:** anéis concêntricos (energia, C, P, G) enchem até a meta, com segunda volta mais escura no excedente; a legenda usa as cores dos anéis. Os valores vêm exclusivamente dos totais diários retornados pelo backend. Cada cartão mostra os quatro totais da refeição, sem metas próprias. A soma de valores exibidos por refeição pode diferir em centésimos do total diário, pois o backend arredonda apenas após somar as porções exatas.
7. **Definir composição como meta:** botão no resumo do dia chama `POST /api/target-calculations/from-composition` e aplica a meta energética (= kcal consumidas) e os percentuais de macros equivalentes. Se já houver meta, pede confirmação mostrando a atual e a nova. Quando essa meta volta do backend com restante zero, roda uma animação (anéis de 0 ao valor, tremor e confetes, sem biblioteca), desativada com "reduzir movimento". Os anéis de macros ficam próximos de 100%, não exatos (kcal da tabela ≠ 4/4/9).

Só a busca consulta a cada letra (200 ms de debounce). Quantidade recalcula ao confirmar; nome não recalcula; criar, adicionar/remover, reordenar e excluir recalculam imediatamente. Cada requisição cancela a anterior, e os últimos totais permanecem na tela até a resposta (retirados só em erro). O payload é `{targets, meals:[{name, foods:[{foodId, quantityG}]}]}`; a resposta mantém a ordem das refeições. Não há armazenamento local nem metas por refeição; o horário não entra no payload.

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

Não há persistência no navegador: recarregar descarta o planejamento. Consulte também o `HANDOFF.md` na raiz para decisões e continuidade do desenvolvimento.

Estado atual (16/09): **44 testes frontend** passando; `npm run build` e `npm test` concluídos. Cobertura de criação, busca por refeição, edição, exclusão com confirmação, reordenação (teclado e soltar), horário 24 h, envio só ao confirmar, manutenção dos valores durante recálculo, composição como meta (direta e com confirmação) e animação sem disparos indevidos. Dependência adicional: `@angular/cdk` 22.1.6 (decisão do usuário).
