# Feature: dimensionar a porção pelo nutriente

Épico: **Planejamento alimentar** (composição/refeições) · Definida em 17/09/2026.

Leia antes o [HANDOFF.md](../../HANDOFF.md) (seções 1, 5, 9, 10 e 12). Continuam valendo: **não executar comandos Git**, **nenhuma fórmula nutricional no Angular**, mensagens em português, executar build/testes e atualizar README/HANDOFF ao final.

## Objetivo

Hoje a porção de cada alimento é escolhida pelo **peso**. Esta feature permite escolhê-la pela **quantidade de um nutriente**: na linha do arroz, clicar no carboidrato e pedir "40 g de carboidrato"; o sistema calcula o peso de arroz que entrega isso e os demais valores (proteína, gordura, kcal, totais, metas, donut) atualizam a partir desse peso. Diferencial pedido pelo usuário: os apps do gênero só dimensionam por peso.

## Decisões do usuário (17/09, não reabrir)

1. **Nutrientes:** carboidrato, proteína, gordura **e energia (kcal)**.
2. **Arredondamento do peso calculado:** **0,1 g** (HALF_UP). O nutriente obtido fica praticamente igual ao pedido (diferenças de centésimos), e o peso segue prático de pesar.

## Regra

- O alimento tem os valores do nutriente **por 100 g** (catálogo). Peso da porção = quantidade desejada × 100 ÷ valor por 100 g, arredondado a 0,1 g.
- A porção **continua guardada em gramas**: o nutriente é só uma forma de digitar o peso. Depois de calculado, tudo segue o fluxo atual (a composição usa o peso).
- Alimento **sem aquele nutriente** (valor por 100 g ausente ou zero, ex.: carboidrato do frango) **não** pode ser dimensionado por ele.
- Quantidade desejada: positiva, até 7 inteiros e 3 decimais. Peso resultante: maior que zero e dentro do limite atual de porção (até 7 inteiros); fora disso → erro.

## Backend

Novo endpoint **público** (como os demais da calculadora), no pacote `calculation`:

`POST /api/portion-quantities`

```json
{ "foodId": 1, "nutrient": "CARBOHYDRATE", "amount": 40 }
```

- `nutrient`: `ENERGY` | `CARBOHYDRATE` | `PROTEIN` | `FAT`.
- Resposta 200: `{ "foodId": 1, "nutrient": "CARBOHYDRATE", "amount": 40, "quantityG": 142.3 }`.
- Erros (ProblemDetail com `errors`, em português):
  - campos ausentes/inválidos → 400 por campo;
  - alimento sem o nutriente → 400 no campo `nutrient`;
  - peso resultante zero (quantidade pequena demais) ou acima do limite → 400 no campo `amount`;
  - alimento inexistente → 404 (como hoje).

Testes: cálculo e arredondamento para os quatro nutrientes, nutriente ausente/zero, limites, validação e endpoint público sem token.

## Frontend (`nutrition-web`)

- Na linha do alimento (refeição expandida), os chips de **C, P, G e kcal** passam a ser clicáveis quando a porção tem valor calculado e o alimento tem aquele nutriente.
- Clicar transforma o chip num campo com o valor atual. **Enter** ou sair do campo confirma: chama `POST /api/portion-quantities`, aplica o `quantityG` devolvido como nova quantidade da porção e recalcula como uma edição de peso. **Esc** cancela.
- Campo vazio, igual ao valor atual ou inválido para envio → cancela sem requisição.
- Erro da API (ex.: nutriente ausente) → o campo fica marcado com a mensagem, sem alterar a porção.
- O Angular não calcula o peso: só envia o pedido e aplica a resposta.

Testes: clicar no chip abre o campo; confirmar envia o pedido correto e aplica o peso; Esc e vazio cancelam sem requisição; alimento sem o nutriente não é editável; erro da API mantém a porção e mostra a mensagem.

## Fora de escopo

- "Travar" a porção no nutriente (manter 40 g de carbo se o alimento mudar): a porção continua em gramas.
- Dimensionar vários alimentos ao mesmo tempo para fechar uma meta.
- Outros nutrientes além de C, P, G e kcal (dependem do modelo genérico de nutrientes).

## Critérios de aceite

- [ ] Clicar em C, P, G ou kcal de um alimento permite digitar a quantidade desejada daquele nutriente.
- [ ] O peso é calculado no backend, arredondado a 0,1 g, e os demais valores e totais atualizam.
- [ ] Alimento sem o nutriente não é dimensionável por ele; erros aparecem em português.
- [ ] Endpoint público documentado; testes backend e frontend passando; `npm run build` passando.
- [ ] HANDOFF e READMEs atualizados.
