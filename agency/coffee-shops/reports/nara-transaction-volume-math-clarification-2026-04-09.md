# Nara Coffee Shop: Transaction Volume Math Clarification

Date: 2026-04-09

## Bottom line

The `96 tx/day` figure is not a typo, but it was calculated under a different model from the one using `JPY 850k` fixed cost and `20` operating days per month.

The key reason the numbers look contradictory is that three assumptions changed at once:

- monthly fixed cost base
- gross margin
- operating days per month

The corrected reads are:

- `96 tx/day` is correct for the repo's `JPY 1.27m` fixed-cost model at `JPY 650` average ticket, `32%` variable cost, and about `30` operating days per month
- `109 tx/day` is correct for the simplified model using `JPY 850k` fixed cost, `40%` COGS, `JPY 650` average ticket, and `20` operating days per month
- the two figures are not comparable unless the days/month and cost structure are held constant

For a Sarusawa tourist cafe, the stronger operating assumption is `28-30` trading days per month, not `20`.

## 1. Where the `96 tx/day` figure came from

The pricing report uses:

- fixed costs: about `JPY 1.27m / month`
- variable cost ratio: about `32%`
- contribution margin: `68%`
- average ticket: `JPY 650`
- implied operating month: about `30 days`

Formula:

- monthly break-even revenue = `JPY 1.27m / 0.68 = JPY 1.868m`
- daily revenue needed over `30` days = `JPY 1.868m / 30 = JPY 62.3k`
- break-even transactions/day = `JPY 62.3k / JPY 650 = 95.8`

That is the source of the `96 tx/day` figure in `reports/nara-pricing-elasticity-wtp-validation-2026-04-09.md`.

Important implication:

- if you keep this same `JPY 1.27m` fixed-cost model but switch to only `20` operating days, break-even rises to about `144 tx/day`, not `96`

So the apparent contradiction is real, but it is caused by mixing a `30-day` cafe model with a `20-day` month.

## 2. Correct break-even under the simplified `JPY 850k` model

If the intended model is:

- fixed costs: `JPY 850k / month`
- gross margin: `60%`
- average ticket: `JPY 650`
- operating days: `20 / month`

Then the math is:

- monthly break-even revenue = `JPY 850k / 0.60 = JPY 1.417m`
- daily revenue needed = `JPY 1.417m / 20 = JPY 70.85k`
- break-even transactions/day = `JPY 70.85k / JPY 650 = 109.0`

So the corrected break-even count under that exact model is:

- `109 tx/day`

Your hypothesis was directionally right: `96` is not break-even under the `20-day / JPY 850k / 60% margin` structure.

One more useful cross-check:

- if you keep the same `JPY 850k` fixed cost and `60%` gross margin but use `30` operating days, break-even falls to about `72.6 tx/day`

## 3. Requested profit and loss table

This table uses the simplified model requested in the prompt:

- fixed costs: `JPY 850k / month`
- gross margin: `60%`
- average ticket: `JPY 650`
- operating days: `20 / month`

| Tx/day | Monthly revenue | Gross profit | Fixed cost | Monthly net |
| --- | ---: | ---: | ---: | ---: |
| `100` | `JPY 1.30m` | `JPY 0.78m` | `JPY 0.85m` | `-JPY 0.07m` |
| `109` | `JPY 1.417m` | `JPY 0.850m` | `JPY 0.85m` | `~JPY 0.00m` |
| `150` | `JPY 1.95m` | `JPY 1.17m` | `JPY 0.85m` | `+JPY 0.32m` |
| `200` | `JPY 2.60m` | `JPY 1.56m` | `JPY 0.85m` | `+JPY 0.71m` |
| `300` | `JPY 3.90m` | `JPY 2.34m` | `JPY 0.85m` | `+JPY 1.49m` |
| `500` | `JPY 6.50m` | `JPY 3.90m` | `JPY 0.85m` | `+JPY 3.05m` |
| `700` | `JPY 9.10m` | `JPY 5.46m` | `JPY 0.85m` | `+JPY 4.61m` |

These numbers are internally correct for that simplified model.

## 4. What daily transaction count is realistic for Sarusawa Pond

There is no public, point-specific transaction dataset for Sarusawa Pond in the source set I could verify. The realistic range therefore has to be inferred from:

- official Nara visitor volumes
- the corridor footfall proxy already built in the workspace
- the shop's size and staffing model

What the workspace and official sources support:

- Nara Prefecture `Area A` recorded `15.815m` visitors in 2024, or about `43.3k/day`
- the existing Sarusawa corridor proxy infers about `10.8k-13.0k` people/day passing the pond corridor
- the current Sarusawa market model underwrites `80 tx/day` as the stabilized base case
- the staffing model treats `80-95 tx/day` as the launch band, `95-110` as the next support band, and `110-130` as the point where peak support becomes structurally necessary

Operationally, the repo's opening model assumes roughly `08:00-20:00` customer hours. On that basis:

- `100 tx/day` = about `8.3` transactions/hour across `12` hours
- `200 tx/day` = about `16.7` transactions/hour
- `300 tx/day` = about `25.0` transactions/hour
- `500 tx/day` = about `41.7` transactions/hour
- `700 tx/day` = about `58.3` transactions/hour

My read:

- `80-110 tx/day` is the most defensible steady-state range for this exact independent-format Sarusawa concept
- `110-130 tx/day` is plausible, but it is no longer the light launch operating model
- `150-200 tx/day` is possible on strong holiday or event days, but should not be the base underwriting case
- `300 tx/day` is already an aggressive stretch for a `22 tsubo`, `24-28` seat independent cafe
- `500-700 tx/day` is not credible for the modeled format; that throughput belongs to a much higher-capacity operation

So if the question is "what should the base model use?", my answer is:

- base case: about `80-100 tx/day`
- good operating case: about `100-120 tx/day`
- upside days, not annual base case: about `150-200 tx/day`

## 5. What the `14-18 month` payback assumption actually used

The `14-18 month` break-even sensitivity memo is not based on lower daily transactions. It is the opposite.

That memo explicitly assumes:

- `700 tx/day`
- `JPY 650` average ticket
- `40%` COGS
- `JPY 180k` rent
- `JPY 600k` labor

It also states that this implies startup-capital recovery targets of about:

- `JPY 101.4m` at `14` months
- `JPY 134.1m` at `18` months

That is not a normal small Sarusawa coffee-shop fit-out case. It is a separate high-throughput payback model.

So the answer to the prompt's final question is:

- no, the `14-18 month` assumption is not based on `30-50 tx/day`
- it is based on an extremely high `700 tx/day` case
- that is why the payback timing looks fast

## 6. Practical modeling guidance

Do not mix these model layers:

- `Operating break-even`
- `Startup-capital payback`
- `20-day simplified month`
- `30-day cafe trading month`

If the team wants a single clean underwriting frame for Sarusawa, the cleanest reset is:

- decide whether the shop trades `20` days or `28-30` days
- decide whether fixed costs are really `JPY 850k` or closer to the repo's `JPY 1.27m`
- decide whether blended margin is really `60%` or closer to `68%`
- then calculate break-even from one fixed model only

If I had to choose one operating base case from the current workspace, I would use:

- `30` trading days
- `80-100 tx/day` stabilized volume
- `JPY 650-700` average ticket for a drink-led mix, or `JPY 900+` only if food and retail attachment is intentional

## Sources

- Local repo reference: `sarusawa-pond-market-analysis-2026-04-09.md`
- Local repo reference: `reports/nara-pricing-elasticity-wtp-validation-2026-04-09.md`
- Local repo reference: `reports/nara-staffing-model-2026-04-09.md`
- Local repo reference: `reports/nara-break-even-sensitivity-analysis-2026-04-09.md`
- Nara City 2024 visitor report: https://www.city.nara.lg.jp/uploaded/attachment/197898.pdf
- Nara Prefecture 2024 tourism dynamics report: https://www.pref.nara.lg.jp/documents/6389/reiwa6nennnarakennkankoukyakudoutaityousahoukokusyo.pdf
- Starbucks Nara Sarusawaike official store page: https://store.starbucks.co.jp/detail-1766/
