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

1. **Paciente temporário:** nome, peso, altura, idade, sexo, objetivo e atividade física DRI. Dados ficam visíveis; ainda não há entidade de paciente/usuário nem gravação. Objetivo é apenas contexto.
2. **Estimativa automática DRI:** método inicial DRI 2023. Preencher os cinco dados necessários dispara o cálculo após 300 ms. Abaixo da estimativa, o botão discreto **Calcular estimativa energética com outra fórmula** revela FAO e fórmula de bolso, com opção de voltar à DRI. FAO solicita PAL numérico próprio. Bolso solicita kcal/kg e preenche diretamente a meta prescrita com o cálculo do backend, sem cartão de estimativa. Dados incompatíveis são rejeitados no backend.
3. **Decisão profissional:** a estimativa mostra método e parâmetros utilizados. O botão **Usar estimativa como meta** copia explicitamente seu valor para a prescrição. Também é possível digitar qualquer meta positiva sem estimativa, editar o valor ou removê-lo. Recalcular DRI/FAO preserva a prescrição. No modo bolso, alterar peso/fator recalcula a meta; objetivo e outros dados não a alteram. Uma edição manual cancela a requisição pendente; voltar a DRI/FAO preserva a última meta.
4. **Macros opcionais:** nenhum ou percentual da energia prescrita, com as faixas DRI/AMDR exibidas apenas como sugestão. Trocar de método limpa os números.
5. **Composição da dieta:** busca recolhida enquanto vazia; pesquisa após 200 ms, por palavras no backend, sem Enter. Adicionar, editar gramas (200 ms) e remover porções atualiza o cálculo no backend. A dieta funciona sem paciente, estimativa ou metas.

Estimativas/metas são atualizadas após 300 ms de edição ou por botão. Estados, erros e cancelamento das requisições são separados. Uma estimativa inválida não impede prescrição manual e alimentos. Comparações antigas são retiradas enquanto metas estão sendo editadas; o consumo continua calculável.

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
