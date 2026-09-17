# Feature: Refeições

Épico: **Planejamento alimentar** · Feature: **Composição da dieta → Refeições** · Definida em 16/09/2026.

Leia antes o [HANDOFF.md](../../HANDOFF.md) (seções 1, 2 e 5). Todas as instruções de trabalho de lá continuam valendo, em especial: não executar comandos Git, não inventar regras nutricionais, cálculos pertencem ao backend, executar build/testes e atualizar o HANDOFF ao final.

## Objetivo

Permitir que o nutricionista organize a dieta em **refeições**: criar refeições, nomeá-las e colocar alimentos dentro de cada uma. Hoje a composição é uma lista única de alimentos; passa a ser uma lista de refeições, cada uma com seus alimentos.

## Decisões já tomadas (não reabrir)

1. **Temporárias.** Refeições não são salvas no banco. A tela mantém o estado; o backend apenas calcula. Recarregar a página descarta tudo, como hoje. Não criar entidades, tabelas, migrations ou CRUD.
2. **Tela começa vazia, com atalhos.** Nenhuma refeição pré-criada. Botões rápidos com nomes comuns — "Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia" — e opção de nome livre.
3. **Metas continuam diárias.** Energia e macros são comparados apenas com o **total do dia** (soma de todas as refeições). Cada refeição mostra seus próprios totais, **sem meta por refeição** e sem distribuição de metas entre refeições.

## Backend

### Contrato: `POST /api/diet-calculations`

Substituir `foods` na raiz por `meals`. Sem compatibilidade com o formato antigo (o HANDOFF proíbe preservar modelos só por compatibilidade): `foods` na raiz passa a ser rejeitado com 400.

Pedido:

```json
{
  "targets": {"energyKcal": 2000, "carbohydrateG": 250, "proteinG": 100, "fatG": 66.67},
  "meals": [
    {"name": "Café da manhã", "foods": [{"foodId": 1, "quantityG": 150}]},
    {"name": "Almoço", "foods": [{"foodId": 2, "quantityG": 100}, {"foodId": 1, "quantityG": 80}]},
    {"name": "Ceia", "foods": []}
  ]
}
```

Resposta:

```json
{
  "meals": [
    {
      "name": "Café da manhã",
      "foods": [{"foodId": 1, "name": "...", "source": "...", "sourceCode": "...", "quantityG": 150, "nutrients": {"energyKcal": 0, "carbohydrateG": 0, "proteinG": 0, "fatG": 0}}],
      "totals": {"energyKcal": 0, "carbohydrateG": 0, "proteinG": 0, "fatG": 0}
    }
  ],
  "totals": {
    "energyKcal": {"target": 2000, "consumed": 0, "remaining": 0},
    "carbohydrateG": {"target": 250, "consumed": 0, "remaining": 0},
    "proteinG": {"target": 100, "consumed": 0, "remaining": 0},
    "fatG": {"target": 66.67, "consumed": 0, "remaining": 0}
  }
}
```

- `meals` na resposta segue **a mesma ordem** do pedido; o cliente associa por índice.
- `meals[].totals` são valores simples (`NutritionValues`), **sem** target/remaining.
- `totals` (dia) mantém o formato atual de `Balance`, comparando com `targets`.

### Regras

- `meals` obrigatório; lista vazia é válida (dia sem refeições → consumo zero).
- Refeição sem alimentos é válida (totais zero).
- `name` obrigatório, não vazio após trim, até 60 caracteres. Nomes repetidos são permitidos.
- Limites técnicos (não nutricionais): até 20 refeições; até 500 porções somando todas as refeições. Regras atuais de porção continuam (`foodId` positivo, `quantityG` positivo com até 3 casas).
- **Precisão (manter a regra vigente):** somar porções exatas e arredondar só no fim. Total de cada refeição = soma exata das suas porções, arredondada. Total do dia = soma exata de **todas as porções**, arredondada — **não** somar os totais já arredondados das refeições. Documentar que a soma dos totais exibidos por refeição pode diferir do total do dia em centésimos.
- Carregar os alimentos de todas as refeições com **uma única chamada** a `FoodCatalog.findAllById`. Alimento inexistente continua 404.
- Erros de campo seguem o padrão atual, com caminhos como `meals[1].name` e `meals[0].foods[2].quantityG`.

### Organização

- Continua no pacote `calculation` e no `DietCalculator`. Novos records ao lado dos atuais (ex.: `MealRequest`, `CalculatedMeal`).
- Não criar camadas, interfaces ou abstrações novas além do necessário.
- Atualizar `examples/diet-calculation-request.json` e `examples/diet-calculation-response.json` (o teste `exampleMatchesCompleteResponse` os usa em modo estrito).

### Testes mínimos (backend)

- Dia com várias refeições: totais por refeição e do dia corretos.
- Refeição vazia e lista de refeições vazia.
- Mesmo alimento em refeições diferentes (e repetido na mesma refeição).
- Precisão: total do dia calculado sobre porções exatas, não sobre totais arredondados das refeições.
- Metas comparadas apenas com o total do dia; sem metas → `target`/`remaining` nulos.
- Validação: nome ausente/vazio/longo, limites de refeições e porções, `foods` antigo na raiz rejeitado, caminhos de erro corretos.
- Alimento inexistente em qualquer refeição → 404.
- Busca dos alimentos feita uma vez para todas as refeições.

## Frontend (`nutrition-web`)

O frontend é temporário e será reformulado, mas a feature deve ser utilizável para validação com o nutricionista. Seguir o visual atual (painéis laterais, botões de configuração, anéis).

### Comportamento

- A seção "Composição da dieta" vira a área de **Refeições**.
- Estado vazio: mensagem curta e os atalhos de nomes comuns + "Nova refeição" com nome livre.
- Cada refeição aparece como um cartão com:
  - nome (editável);
  - totais da refeição vindos do backend (kcal, carboidratos, proteínas, gorduras);
  - lista de alimentos com quantidade editável (g) e remover;
  - ação para adicionar alimento a **essa** refeição;
  - excluir refeição (pedir confirmação se tiver alimentos);
  - mover para cima/baixo para reordenar.
- Adicionar alimento: a busca fica **dentro da refeição** (decisão de 16/09, após a primeira entrega): não existe catálogo global nem seletor de destino. Nenhum alimento é adicionado fora de uma refeição.
- Nome de refeição nunca é enviado vazio (correção de 16/09).
- Os anéis e a legenda continuam mostrando o **total do dia** vs. metas.
- Nenhum cálculo nutricional no Angular: totais por refeição e do dia vêm da resposta.
- Manter o comportamento atual de debounce/cancelamento: editar quantidade, adicionar/remover alimento, renomear, reordenar ou excluir refeição dispara novo cálculo, cancelando o anterior. Renomear pode usar debounce.

### Testes mínimos (frontend)

- Criar refeição por atalho e por nome livre; payload com `meals` na ordem correta.
- Adicionar alimento à refeição escolhida (e não a outra).
- Editar quantidade, remover alimento, excluir e reordenar refeição → novo payload correto.
- Renderizar totais por refeição e total do dia a partir da resposta.
- Estado vazio com atalhos.

## Fora de escopo

- Salvar refeições, planos ou dietas; paciente como entidade.
- Metas por refeição ou distribuição de metas entre refeições.
- Observações, receitas, substituições, cópia/duplicação de refeições. (Horário da refeição foi incluído depois, em 16/09, por decisão do usuário: HH:mm 24 h, só na tela, não enviado à API.)
- Kanban completo. (Arrastar e soltar para reordenar refeições foi incluído depois, em 16/09, por decisão do usuário, com `@angular/cdk`.)
- Mover alimento entre refeições (pode ser removido e adicionado de novo).
- Mudanças no catálogo de alimentos, estimativa ou metas.

## Critérios de aceite

- [x] `POST /api/diet-calculations` aceita `meals` e rejeita `foods` na raiz.
- [x] Totais por refeição e do dia corretos, com a regra de precisão documentada.
- [x] Tela permite criar (atalho e nome livre), renomear, reordenar e excluir refeições, e adicionar/editar/remover alimentos em cada uma.
- [x] Anéis refletem o total do dia vs. metas.
- [x] `mvn test` e `npm test`/`npm run build` passando, com os testes mínimos acima.
- [x] READMEs (`nutrition-api`, `nutrition-web`) e HANDOFF atualizados: contrato, regras, contagem de testes e status da feature na seção 2.
- [x] Teste real no navegador com a API e o banco TACO, descrito na seção de validação do HANDOFF.
- [x] Não gerar o JAR com a API rodando a partir de `target/`.

Implementação e validação técnica concluídas em 16/09/2026: 137 testes backend, 30 frontend, builds e teste real no navegador com TACO. Ampliações posteriores do usuário no mesmo dia (horário, arrastar e soltar, layout em grid, composição como meta) elevaram para 141 backend e 44 frontend — ver HANDOFF. Evidências e limites registrados no HANDOFF. Validação do nutricionista e merge manual pelo usuário permanecem pendentes para o fechamento do ciclo.
