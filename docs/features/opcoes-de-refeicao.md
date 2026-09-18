# Feature: opções de refeição (variações)

Épico: **Planejamento alimentar** (refeições) · Definida em 17/09/2026 · **Especificação para execução autônoma**, na mesma execução de [nutrientes-e-relatorio.md](nutrientes-e-relatorio.md) (ver "Ordem com a outra feature").

Leia antes o [HANDOFF.md](../../HANDOFF.md) (seções 1, 5, 9, 10, 12), [refeicoes.md](refeicoes.md), [porcao-por-nutriente.md](porcao-por-nutriente.md). Continuam valendo: **não executar comandos Git**, **nenhuma fórmula nutricional no Angular**, mensagens em português, não adicionar dependências, `mvn test` / `npm test` / `npm run build`, **não gerar o JAR nem reiniciar a API do usuário**, atualizar READMEs e HANDOFF.

## Objetivo

Cada refeição (ex.: "Almoço") pode ter **mais de uma opção** de cardápio. No canto superior esquerdo da refeição aparecem as abas **"Opção 1"**, **"Opção 2"**… e um botão **"+"**. O profissional monta alternativas para o paciente escolher, mas **somente a Opção 1 conta** para a meta calórica, os macros e todo o resumo do dia.

## Decisões do usuário (17/09, não reabrir)

1. **"+"** cria uma nova opção **vazia** (sem alimentos), depois da última, e a abre. (Alterado pelo usuário em 18/09; antes, a nova opção era cópia da opção aberta.)
2. **Só a opção 1 conta** para tudo no resumo do dia: energia, macros, saldos, donut, "Definir composição como meta", **fibra e relatório de micronutrientes**. As demais opções mostram seus próprios totais de C/P/G/kcal dentro da refeição.
3. **Remover:** qualquer opção pode ser removida (confirmação se tiver alimentos); se a Opção 1 sair, a seguinte vira a Opção 1. Cada opção tem **"Definir como principal"** (antes "Tornar opção 1"), que a move para a primeira posição (as outras seguem na ordem).
4. **Linha resumida (recolhida):** mostra **sempre a Opção 1** (C/P/G/kcal e itens), com um indicador "+N opções" quando houver outras.
5. **Renomear (18/09):** clique duplo no nome da aba ou F2 abre a edição; **Enter** ou sair do campo salva e **Esc** cancela. Limite de 30 caracteres. Nome em branco, ou o próprio "Opção N" digitado de volta, restaura o nome padrão, que acompanha a posição. Um nome dado acompanha a opção quando ela é reordenada. O nome existe **só na tela**: não é enviado à API e não é salvo.
6. **Menu do botão direito (18/09):** abre sobre a aba (ou sob ela, pela tecla de menu/Shift+F10), com **Renomear**, **Definir como principal** (exceto na primeira) e **Fechar opção** (exceto quando é a única). ↑/↓ navegam; Esc fecha e volta o foco à aba; clicar fora ou rolar também fecha.

## Regras

- Toda refeição tem **pelo menos 1 opção** e **no máximo 5**. Não é possível remover a única opção (para limpar, remova os alimentos ou a refeição).
- Nome e horário são **da refeição** (valem para todas as opções).
- O limite de **500 porções no dia** soma **todas as opções** de todas as refeições.
- A **regra "só a opção 1 conta" fica no backend**: o frontend envia todas as opções; o backend devolve os totais de cada opção e calcula os totais do dia apenas com a primeira opção de cada refeição.

## Backend (`nutrition-api`)

### Contrato `POST /api/diet-calculations`

Pedido — cada refeição passa a ter `options` (obrigatório, 1 a 5); `foods` na raiz da refeição deixa de existir (propriedade desconhecida → 400, como o restante da API):

```json
{
  "targets": { "energyKcal": 2000 },
  "meals": [
    { "name": "Almoço", "options": [
      { "foods": [ { "foodId": 1, "quantityG": 150 } ] },
      { "foods": [ { "foodId": 2, "quantityG": 120 } ] }
    ] }
  ]
}
```

Resposta — cada refeição traz `options[]` na mesma ordem, cada uma com `foods` calculados e `totals`; o `totals` da refeição é o da **Opção 1**; os totais do dia (`totals`, `macroEnergyShares` e, após a outra feature, `nutrients`) usam **só a Opção 1** de cada refeição:

```json
{
  "meals": [
    { "name": "Almoço",
      "totals": { "energyKcal": 195, "carbohydrateG": 42, "proteinG": 4.5, "fatG": 1.5 },
      "options": [
        { "foods": [ ... ], "totals": { "energyKcal": 195, ... } },
        { "foods": [ ... ], "totals": { "energyKcal": 198, ... } }
      ] }
  ],
  "totals": { ... somente opções 1 ... }
}
```

- Validação e mensagens em português: `options` ausente/vazio → 400 em `meals[i].options` ("Informe ao menos uma opção."); mais de 5 → "Informe no máximo 5 opções por refeição."; porções continuam validadas em `meals[i].options[j].foods[k].quantityG` (mesmas mensagens atuais). Limite de 500 porções soma todas as opções (erro em `meals`, como hoje).
- O total do dia soma as porções exatas das opções 1 (arredondamento só no final, como hoje). Alimentos de todas as opções são carregados **numa única chamada** do catálogo (`findAllById`), como hoje.
- `MealRequest` ganha `List<MealOptionRequest> options`; `CalculatedMeal` ganha `options` (`CalculatedMealOption` com `foods` e `totals`). Não duplicar a lógica de porção: reaproveitar `NutritionValues`.
- Atualizar `examples/diet-calculation-request.json` e `-response.json` (teste STRICT) com uma refeição de duas opções.

### Testes (backend)

- Totais do dia, `macroEnergyShares` (e `nutrients`, depois da outra feature) consideram **só a opção 1**; opção 2 com alimento diferente não altera o dia.
- Totais por opção e `totals` da refeição = opção 1.
- Limites: 0 opções, 6 opções, 500 porções somando opções; caminhos de erro `meals[0].options[1].foods[0].quantityG`.
- `foods` na raiz da refeição rejeitado; opção vazia é válida.
- Carga única de alimentos com várias opções.

## Frontend (`nutrition-web`)

### Modelo da tela

- `Meal` passa a ter `options: MealOption[]` e `activeOptionKey`; `MealOption` = `{ key, foods: Portion[] }`. Chaves de porção continuam únicas na tela inteira.
- Tudo que hoje usa `meal.foods` passa a operar na **opção ativa** (adicionar alimento, remover, quantidade, porção pelo nutriente, marca de porção inválida), exceto o resumo, que usa a **Opção 1**. Revisar: `addFood`, `removeFood`, `changeQuantity`, `calculate` (monta `options`), `alignResult` (alinha resultado por opção; porções excluídas por quantidade inválida continuam `null` na posição), `rejectedPortions` (novo caminho `meals[i].options[j].foods[k].quantityG`), `removeMeal`/`requestRemoveMeal` (tem alimentos se **qualquer** opção tiver), contagem "N itens" (da Opção 1), reordenação de refeições (inalterada) e `invalidPortions`.

### Interface

- **Barra de opções** no **canto superior esquerdo do corpo da refeição** (refeição expandida), acima das linhas de alimento: abas "Opção 1", "Opção 2"… e o botão **"+"** (desabilitado com 5 opções). A aba ativa fica destacada; a Opção 1 tem um selo discreto "conta na meta".
- Ações da opção ativa (ao lado das abas, discretas): **"Tornar opção 1"** (oculta na própria Opção 1) e **"Remover opção"** (oculta quando só há uma). Remover com alimentos pede confirmação; se for a Opção 1, o texto avisa que a próxima passará a contar na meta. As abas renumeram após remover/trocar.
- Ao ver uma opção que não é a 1, uma linha de totais da opção (C/P/G/kcal vindos do backend) com o aviso "não conta na meta".
- **Linha resumida** (recolhida e expandida): valores e "N itens" da **Opção 1**, com indicador "+N opções" quando houver mais.
- A busca de alimentos adiciona na **opção ativa**. Criar refeição começa com uma opção.
- Visual no padrão atual das refeições (pílulas, cinza/branco, verde claro na ativa). Acessível: abas com `role="tablist"`/`role="tab"`, `aria-selected`, setas ←/→ trocam de aba.

### Testes (frontend)

- "+" cria uma opção vazia e a abre; limite de 5.
- Adicionar/remover/editar quantidade e porção pelo nutriente afetam só a opção ativa.
- Pedido envia `options` na ordem; resumo da refeição e dia refletem a Opção 1; indicador "+N opções".
- "Tornar opção 1" reordena e recalcula; remover com confirmação e renumeração; não remove a única opção.
- Porção inválida numa opção ≠ 1 é marcada naquela porção (caminho com `options`).
- Os testes atuais continuam passando, ajustados ao novo formato (refeições com uma opção).

## Ordem com a outra feature

Executar **primeiro esta feature (opções)** e **depois** [nutrientes-e-relatorio.md](nutrientes-e-relatorio.md). Assim a soma de fibra e micronutrientes da outra feature já nasce considerando **só a Opção 1** de cada refeição (regra desta especificação). Rodar `mvn test`, `npm test` e `npm run build` ao fim de cada uma.

## Ajuste de 18/09 (pedido do usuário)

As opções passaram a ter visual e mecânica de **abas de navegador**:
- abas no topo da folha da refeição, com a ativa fundida a ela;
- **×** em cada aba; botão do meio do mouse ou Delete também fecham;
- **+** logo depois da última aba;
- arrastar para reordenar (a primeira conta na meta).

Isso substitui o botão "Remover opção" e tira "reordenar opções por arrastar" do fora de escopo.

## Fora de escopo

- Paciente escolher opção; persistir opções; horário por opção; comparação automática entre opções.

## Critérios de aceite

- [x] Refeição com abas de opções, "+" criando opção vazia (18/09; antes copiava a aberta), até 5.
- [x] Só a Opção 1 conta para meta, macros, donut, composição como meta, fibra e micronutrientes (regra no backend).
- [x] "Tornar opção 1" e remover (com confirmação e renumeração) funcionando.
- [x] Linha resumida sempre com a Opção 1 e indicador "+N opções".
- [x] Contrato documentado, exemplos atualizados, testes backend e frontend e build passando; READMEs e HANDOFF atualizados.
