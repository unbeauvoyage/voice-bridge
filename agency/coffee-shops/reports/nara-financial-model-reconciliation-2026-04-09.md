# Nara Coffee Shop: Financial Model Reconciliation

Date: `2026-04-09`

## Executive conclusion

The `¥101m-134m` figure is **not** a realistic startup-capital estimate for a `20-25 tsubo` Sarusawa Pond coffee shop. It is the capital amount that gets back-solved if you force a `14-18 month` payback onto an implausible `700 tx/day` operating model.

The actual reconciliation is:

- `¥2.5m` startup capital is materially incomplete for this concept and location
- `600-800 tx/day` is the broken assumption, not `¥101m-134m`
- `96 tx/day` is **not** business break-even; it is the traffic needed to hold labor near `28%` of sales
- a realistic startup-capital range is about `¥18m-24m` for a disciplined `居抜き` case and about `¥25m-32m` for a heavier build
- a defendable `14-18 month` payback requires roughly `120-150 tx/day` at a `¥950` ticket in the realistic Sarusawa model, not `600-800 tx/day`

## 1. What actually broke

| Item | Earlier handoff / Gap 3 assumption | Reconciled read |
| --- | --- | --- |
| Startup capital | `¥2.5m` | Too low by a wide margin for a `20-25 tsubo` Sarusawa specialty cafe |
| Daily transactions | `600-800/day` | Inflated for this store size and staffing model; realistic base is about `80/day` |
| `96 tx/day` | Treated as possible break-even clue | Actually the staffing report's labor-ratio target, not store break-even |
| Break-even horizon | `14-18 months` | Only works with much lower traffic than `600-800/day` if capex is tiny, or with much higher capex than `¥2.5m` if traffic is truly `600-800/day` |
| `¥101m-134m` capital | Looked like a model error | It is a correct back-solved implication of the bad `700/day` assumption; it is not a recommended capex budget |

## 2. Startup capital reconciliation

### What is missing from the `¥2.5m` estimate

The `¥2.5m` stack of `deposit + equipment + inventory` omits the biggest real startup buckets:

- interior / MEP / fit-out work
- furniture, POS, signage, takeaway ware, and opening stock
- pre-opening labor, training, and professional fees
- working capital and contingency

For this concept, the issue is not permit fees. Licensing itself is relatively small. The expensive items are buildout, equipment, frontage/signage, and the cash buffer needed to survive ramp-up.

### Reconciled capital stack

| Item | Handoff | Reconciled range | Read |
| --- | ---: | ---: | --- |
| Lease acquisition | `¥1.2m` | `¥1.5m-¥2.5m` | `敷金`, `礼金`, broker fee, guarantee, insurance, first rent |
| Interior / fit-out | not included | `¥4.5m-¥8.0m` efficient `居抜き`; `¥7.0m-¥11.0m` standard specialty build | This is the biggest missing bucket |
| Equipment | `¥0.8m` | `¥3.5m-¥7.0m` | Espresso machine, grinders, water, refrigeration, ice, dishwasher, smallwares |
| Furniture / POS / signage / opening stock | partly inside inventory | `¥1.0m-¥2.0m` | Usually not captured in a simple inventory line |
| Pre-opening payroll / training / permits / fees | not included | `¥0.5m-¥1.0m` | Permits are small; labor, advisors, and launch prep are not |
| Working capital / contingency | not included | `¥2.0m-¥4.0m` | Required because winter and ramp-up months are not strong |
| Total startup capital | `¥2.5m` | `¥18m-¥24m` disciplined case; `¥25m-¥32m` heavier build | Matches the existing Sarusawa market work |

### Capital conclusion

For a leased `20-25 tsubo` Sarusawa Pond cafe, `¥2.5m` is only plausible for a much smaller micro-kiosk or a nearly turnkey, already-equipped site with almost no redesign. It is not a serious underwriting number for the concept described in this workspace.

## 3. Monthly fixed-cost reconciliation

The earlier `¥850k/month` fixed-cost stack is also light versus the workspace's better-developed Sarusawa underwriting.

| Cost line | Earlier model | Realistic Sarusawa model |
| --- | ---: | ---: |
| Rent + CAM | `¥180k` | `¥260k` |
| Utilities | `¥70k` | `¥95k` |
| Labor | `¥600k` | `¥780k` |
| Other fixed | not included | `¥135k` |
| Total fixed costs | `¥850k` | `¥1.27m` |

Delta: about `+¥420k/month`.

That gap matters, but it still does **not** explain the `40x` capital jump. The dominant problem remains the `600-800/day` sales assumption.

## 4. Transaction math reconciliation

### Earlier handoff math, corrected

With:

- average ticket `¥650`
- COGS `40%`
- contribution margin `60%`
- fixed costs `¥850k/month`

the contribution per transaction is:

- `¥650 x 60% = ¥390`

So operating break-even is:

- `¥850,000 / ¥390 = 2,179 transactions/month`
- if open `30` days: about `72.6 tx/day`
- if open `20` days: about `109.0 tx/day`

Payback of `¥2.5m` in `14-18 months` under that same old model requires only:

- about `84.5-87.9 tx/day` if open `30` days

That is the key reconciliation:

- `14-18 months` is compatible with `¥2.5m` capex only at about `85-88 tx/day`
- it is **not** compatible with `600-800 tx/day`

### Why the `600-800/day` line breaks the model

At `600-800 tx/day`, `¥650` ticket, `40%` COGS, `¥850k` fixed costs:

| Volume | Revenue at `20` days | Monthly profit at `20` days | Revenue at `30` days | Monthly profit at `30` days |
| --- | ---: | ---: | ---: | ---: |
| `600/day` | `¥7.8m` | `¥3.83m` | `¥11.7m` | `¥6.17m` |
| `700/day` | `¥9.1m` | `¥4.61m` | `¥13.65m` | `¥7.34m` |
| `800/day` | `¥10.4m` | `¥5.39m` | `¥15.6m` | `¥8.51m` |

Under that math:

- `¥2.5m` capex pays back in well under `1 month`
- even `¥18m-24m` capex pays back in only a few months
- a `14-18 month` payback implies capital of roughly `¥104m-134m` if `700/day` is true and the store trades all year

So the Gap 3 caveat is directionally correct: the `700/day` model is incompatible with small-shop capex.

### What `96 tx/day` actually means

The staffing report says:

- `90 tx/day` is about where labor reaches `30%` of sales
- `96 tx/day` is about where labor reaches `28%` of sales

That is **not** the same as store-level operating break-even.

In the realistic Sarusawa model:

- operating break-even is about `65 tx/day` in an average month
- worst-month break-even is about `70 tx/day`
- `96 tx/day` produces about `¥590k/month` operating profit, not just zero profit

## 5. Foot traffic and capacity validation

### Corridor conversion

The official Nara Prefecture `A` area (`奈良市・生駒市・山添村`) recorded `15.815m` visitors in 2024, or about `43.3k/day`. The existing Sarusawa report then inferred a Sarusawa corridor flow of about `10.8k-13.0k/day` by assuming a `25%-30%` pass-through share.

Using that corridor estimate:

| Transactions/day | Implied corridor conversion |
| --- | ---: |
| `80/day` | about `0.6%-0.7%` |
| `120/day` | about `0.9%-1.1%` |
| `150/day` | about `1.2%-1.4%` |
| `600/day` | about `4.6%-5.6%` |
| `800/day` | about `6.2%-7.4%` |

The `80-150/day` range is commercially plausible for a strong tourist corridor.

The `600-800/day` range is not impossible in abstract, but for this store format it is operationally aggressive enough that it should not be a base case.

### Throughput test

The staffing model assumes:

- average day at `80/day`: about `6.7 tx/store hour`
- normal peak: `8-10 tx/store hour`
- weekend / holiday peak: `10-12 tx/store hour`
- short burst capacity: `12-15 tx/store hour`

By contrast, a `12`-hour store day at:

- `600/day` = `50 tx/store hour` average
- `700/day` = `58.3 tx/store hour` average
- `800/day` = `66.7 tx/store hour` average

That is about `5x-8x` the throughput used in the staffing model.

If even `35%` of daily volume lands in the strongest `3` hours, peak demand becomes:

- `600/day` -> about `70 tx/hour`
- `700/day` -> about `81.7 tx/hour`
- `800/day` -> about `93.3 tx/hour`

That is not a normal independent `20-25 tsubo` cafe workflow. It is closer to a large-format chain or kiosk cluster with materially heavier staffing and a much simpler menu.

### External capacity benchmark

An external cafe-equipment benchmark is consistent with the workspace model, not the handoff's `600-800/day` number:

- a standard `15-30 seat` cafe benchmark is about `¥50k-100k` max daily sales
- a more fully equipped `25-50 seat` cafe benchmark is about `¥150k-200k` max daily sales

At the handoff's assumption of `600-800/day x ¥650`, daily sales would be:

- `¥390k-520k/day`

That is roughly `2x-3.5x` above even the larger benchmark. By contrast:

- `80/day x ¥950 = ¥76k/day`, which fits the standard cafe benchmark well
- `120-150/day x ¥950 = ¥114k-143k/day`, which is aggressive but still defensible for a prime tourist site

## 6. Reconciled monthly model

### Stabilized realistic operating case

This is the existing Sarusawa base case already developed in the workspace:

- size: `22 tsubo`
- rent + CAM: `¥260k/month`
- utilities: `¥95k/month`
- labor: `¥780k/month`
- other fixed costs: `¥135k/month`
- total fixed costs: `¥1.27m/month`
- average ticket: `¥950`
- variable cost ratio: `32%`
- stabilized average traffic: `80 tx/day`

### Month-by-month operating profit

| Month | Tx/day | Sales | Operating profit | Cumulative operating profit |
| --- | ---: | ---: | ---: | ---: |
| Jan | `62.7` | `¥1.85m` | `-¥0.01m` | `-¥0.01m` |
| Feb | `61.4` | `¥1.63m` | `-¥0.16m` | `-¥0.17m` |
| Mar | `85.0` | `¥2.50m` | `¥0.43m` | `¥0.26m` |
| Apr | `86.7` | `¥2.47m` | `¥0.41m` | `¥0.67m` |
| May | `92.5` | `¥2.72m` | `¥0.58m` | `¥1.25m` |
| Jun | `79.8` | `¥2.27m` | `¥0.28m` | `¥1.53m` |
| Jul | `72.4` | `¥2.13m` | `¥0.18m` | `¥1.71m` |
| Aug | `77.5` | `¥2.28m` | `¥0.28m` | `¥1.99m` |
| Sep | `72.8` | `¥2.07m` | `¥0.14m` | `¥2.13m` |
| Oct | `93.8` | `¥2.76m` | `¥0.61m` | `¥2.74m` |
| Nov | `95.1` | `¥2.71m` | `¥0.57m` | `¥3.31m` |
| Dec | `80.0` | `¥2.36m` | `¥0.33m` | `¥3.64m` |

Annual result:

- annual sales: about `¥27.2m`
- annual operating profit: about `¥3.64m`

Payback on startup capital at this realistic traffic level is therefore much slower:

- `¥18m` startup: about `4.9 years`
- `¥25m` startup: about `6.9 years`
- `¥32m` startup: about `8.8 years`

This is the only model in the current workspace where the monthly math, site capacity, and capital stack actually agree with each other.

## 7. What transaction level actually supports `14-18 months`?

### Realistic Sarusawa capital and cost structure

Using:

- startup capital `¥18m-24m`
- fixed costs `¥1.27m/month`
- ticket `¥950`
- contribution margin `68%`
- `30` trading days per month

the steady-state traffic needed for `14-18 month` payback is:

| Capex | Payback target | Required monthly revenue | Required tx/day |
| --- | --- | ---: | ---: |
| `¥18m` | `18 months` | `¥3.34m` | `117/day` |
| `¥24m` | `18 months` | `¥3.83m` | `134/day` |
| `¥18m` | `14 months` | `¥3.76m` | `132/day` |
| `¥24m` | `14 months` | `¥4.39m` | `154/day` |

Working conclusion:

- `120-150 tx/day @ ¥950` is the rough zone that can support `14-18 months`
- that is aggressive but not absurd for a strong tourist frontage and efficient takeout model
- it is still far below `600-800/day`

### If you insist on the earlier `¥650` ticket model

Using the old lighter cost stack:

- fixed costs `¥850k/month`
- ticket `¥650`
- contribution margin `60%`

you still need only about:

- `158/day` to repay `¥18m` in `18 months`
- `219/day` to repay `¥24m` in `14 months`

Again: `600-800/day` is far above the level actually needed to explain a `14-18 month` payback.

## 8. Final reconciliation

The cleanest interpretation of the full workspace is:

1. The `600-800 tx/day` figure is the main broken assumption. It is likely an order-of-magnitude inflation relative to the realistic Sarusawa case of roughly `80-96/day`.
2. The `96/day` number is a labor-efficiency target, not store break-even.
3. The `¥101m-134m` figure is not a capex recommendation; it is the logical output of combining `700/day` with a forced `14-18 month` payback.
4. The `¥2.5m` startup number is materially incomplete; a realistic startup budget is closer to `¥18m-24m` in a disciplined case.
5. If the investment thesis truly requires `14-18 month` payback, the operating target should be framed around roughly `120-150 tx/day @ ¥950`, not `600-800 tx/day @ ¥650`.

## Sources

Workspace documents:

- `sarusawa-pond-market-analysis-2026-04-09.md`
- `reports/nara-staffing-model-2026-04-09.md`
- `reports/nara-break-even-sensitivity-analysis-2026-04-09.md`
- `reports/nara-opening-critical-path-2026-04-09.md`

External sources:

- Nara Prefecture 2024 tourism movement report: <https://www.pref.nara.lg.jp/documents/6389/reiwa6nennnarakennkankoukyakudoutaityousahoukokusyo.pdf>
- Nara City tourism open data page: <https://www.city.nara.lg.jp/soshiki/7/223577.html>
- Cafe fit-out cost benchmark: <https://www.tenpodesign.com/cost/cafe/>
- Cafe opening cost guide: <https://www.rals.net/journal/tenant/cafe_opening_manual/>
- Cafe equipment / capacity benchmark: <https://cafe-bito.com/machine/article/detail/237>
