# Nara Coffee Shop: Break-Even Sensitivity Analysis

Date: `2026-04-09`

## Executive summary

Using the underwriting inputs in the request and holding the original `14-18 month` payback target as the baseline, the break-even assumption is **most sensitive to transactions/day and average ticket**, then to `COGS`, then to labor execution. `Rent` barely moves the result.

The modeled break-even ranges come out as:

- Best case: about `9.1-11.5 months`
- Most likely case: `14.0-18.0 months`
- Worst case: about `23.4-31.2 months`

The practical read is simple:

- If traffic or ticket is softer than planned, `14-18 months` is not robust.
- If the traffic and pricing assumptions hold, the model can beat `14 months`.
- A strong `November` helps, but **one peak month does not rescue a weak annual base**.

## Important caveats

Two issues in the input set matter before trusting the payback story:

1. The foot-traffic math in the request is internally inconsistent.

- `8,000-15,000` passers/day at `8%` conversion implies about `640-1,200` transactions/day, not `600-800`.
- The "`20% higher`" traffic case in the request lists `960-1,200` transactions/day, which is much more than a true `+20%` move from a `600-800` base.

For the sensitivity model below, I treated the **base case as the midpoint** of the stated transaction range:

- Base transactions/day: `700`
- `-20%` traffic case: `560/day`
- `+20%` traffic case: `840/day`

If you intended the literal `960-1,200/day` upside case, payback compresses further to about `8.8-11.1 months`.

2. The requested payback horizon implies a very large capital exposure under these operating assumptions.

With:

- `700` transactions/day
- `¥650` average ticket
- `40%` COGS
- `¥180k` rent
- `¥600k` labor

the model generates about `¥90.4m` of annual operating cash before debt service and tax. Holding the baseline payback at `14-18 months` implies an underlying startup / capital recovery target of about:

- `¥101.4m` at the `14 month` end
- `¥134.1m` at the `18 month` end

That is far above a normal small coffee-shop fit-out. So either:

- this is a much larger capitalized concept than a standard cafe,
- the transaction assumption is too high,
- or meaningful fixed costs are missing from the current model.

## Method

This analysis uses:

- Baseline payback target: `14-18 months`
- Baseline operating inputs from the request:
  - `700` average transactions/day
  - `¥650` average ticket
  - `40%` COGS
  - `¥180,000/month` rent
  - `¥600,000/month` labor
- Monthly seasonality: Nara City `2024` visitor profile already documented in this workspace
- Break-even definition: month when cumulative operating cash repays the same capital amount implied by the baseline `14-18 month` model

For dynamic pricing, I used the existing Nara seasonality read already in the repo:

- Peak months: `May`, `October`, `November` at `¥800`
- Off-season months: `January`, `February`, `July`, `September` at `¥500`
- Other months: `¥650`

## Sensitivity table

| Scenario | Annual operating cash | Break-even month | Shift vs base midpoint |
| --- | ---: | ---: | ---: |
| Base case | `¥90.4m` | `14.0-18.0` | baseline |
| Foot traffic `-20%` | `¥70.5m` | `17.5-22.9` | `+4.2 months` |
| Foot traffic `+20%` | `¥110.4m` | `11.0-15.0` | `-3.0 months` |
| `November` only at `1,200 tx/day` | `¥94.7m` | `13.1-17.4` | `-0.7 months` |
| Average ticket `¥550` | `¥75.1m` | `16.5-21.7` | `+3.1 months` |
| Average ticket `¥750` | `¥105.8m` | `11.5-15.6` | `-2.4 months` |
| Dynamic pricing: `¥800` peak / `¥500` off-season | `¥90.8m` | `14.3-18.0` | `+0.2 months` |
| Rent `¥150k` | `¥90.8m` | `13.9-17.9` | `-0.1 months` |
| Rent `¥220k` | `¥89.9m` | `14.1-18.1` | `+0.1 months` |
| Rent `¥100k` | `¥91.4m` | `13.8-17.8` | `-0.2 months` |
| COGS `35%` | `¥98.7m` | `12.4-16.6` | `-1.5 months` |
| COGS `45%` | `¥82.1m` | `15.3-19.9` | `+1.6 months` |
| Labor `¥500k`, no sales hit | `¥91.6m` | `13.7-17.8` | `-0.3 months` |
| Labor `¥500k`, with `5%` sales hit from weaker service | `¥86.6m` | `14.5-18.9` | `+0.7 months` |
| Labor `¥700k` | `¥89.2m` | `14.2-18.3` | `+0.2 months` |
| Best case: high traffic, high price, low rent, low COGS | `¥140.7m` | `9.1-11.5` | `-5.8 months` |
| Worst case: low traffic, low price, high rent, high COGS | `¥52.1m` | `23.4-31.2` | `+11.3 months` |

## What the scenarios mean

### 1. Foot traffic sensitivity

- A true `-20%` transaction hit pushes payback from `14-18` months to about `17.5-22.9` months.
- A true `+20%` lift brings payback forward to about `11.0-15.0` months.
- A single blockbuster `November` at `1,200 tx/day` adds about:
  - `¥7.2m` revenue in that month versus base
  - `¥4.3m` operating cash in that month versus base
- But that only improves annual payback by about `0.6-0.9` months. One peak month helps liquidity, not model rescue.

### 2. Pricing sensitivity

- Dropping to `¥550` average ticket delays payback to about `16.5-21.7` months.
- Raising to `¥750` accelerates payback to about `11.5-15.6` months.
- The modeled peak/off-season pricing mix barely changes annual payback because the weighted average ticket stays close to base at about `¥653`.

Interpretation:

- Dynamic pricing only helps if premium pricing is concentrated into enough high-volume days, or if low-season discounting materially lifts volume.
- If dynamic pricing only swaps `¥800` peak months for `¥500` low months without incremental traffic, it does little.

### 3. Rent sensitivity

Rent has almost no effect in this model:

- `¥150k` rent only improves payback by about `0.1` month
- `¥220k` rent only delays payback by about `0.1` month
- even `¥100k` rent improves payback by only about `0.2` month

Interpretation:

- At the current sales assumption, occupancy cost is too small to drive the investment case.
- If rent is showing up as a major debate point, the model is probably overestimating revenue or understating other costs.

### 4. COGS sensitivity

- Improving COGS from `40%` to `35%` pulls payback into about `12.4-16.6` months.
- Deteriorating to `45%` pushes it out to about `15.3-19.9` months.

This is meaningful, but still secondary to traffic and ticket.

### 5. Staffing cost sensitivity

Pure payroll changes are not the core risk. The real risk is whether labor cuts reduce sales.

- At `¥500k` labor and no revenue loss, payback improves only modestly to `13.7-17.8` months.
- If that staffing cut causes just a `5%` sales hit, payback worsens to `14.5-18.9` months.
- At `¥700k` labor for stronger bilingual service, payback only slips to `14.2-18.3` months.

Break-even math:

- A `¥100k/month` labor saving is offset by only about `¥166.7k/month` of lost sales at a `40%` COGS ratio.

That means service erosion is expensive. A small loss of conversion can wipe out the payroll saving.

## Sensitivity ranking

From most sensitive to least sensitive:

1. `Transactions/day` / conversion
2. `Average ticket`
3. `COGS`
4. `Labor`, but only because labor affects service quality and conversion
5. `Rent`

## Assumptions that need validation first

These are the assumptions most likely to break the `14-18 month` payback story:

1. Real sustainable transaction volume

- `700/day` is the dominant assumption in the model.
- It also implies extremely high hourly throughput for a coffee shop.

2. Service capacity versus staffing

- `¥600k/month` labor for `700/day` is likely too lean unless the format is closer to a highly simplified high-throughput kiosk than a normal sit-down cafe.
- The existing staffing model in this workspace is materially more conservative.

3. Real ticket mix

- If the concept cannot hold `¥650+` through pastries, desserts, gifts, and seasonal drinks, payback slips quickly.

4. Achievable COGS

- A `5 point` miss in COGS moves payback about `1.5-1.6` months.
- Premium beans, waste, and pastry attachment can all move this line.

5. Missing fixed costs or overstated capex

- The stated operating model only supports a `14-18 month` payback if the capital base is roughly `¥101m-134m`.
- If real startup capital is much lower, then payback should be materially faster.
- If payback still shows `14-18 months`, the current model is probably missing costs.

## Bottom line

The `14-18 month` break-even assumption is **not robust** unless the shop can truly sustain both:

- roughly `700` transactions/day, and
- roughly `¥650` average ticket

Those two assumptions do most of the work. If either is wrong, payback moves into the high teens or low twenties quickly. If both are wrong at the same time, payback extends into roughly `23-31 months`.

The assumptions that matter most to validate on the ground are:

- actual pedestrian counts by hour and day type
- real conversion into paying orders
- queue capacity and staffing needed to serve the modeled volume
- actual ticket mix by beverage-only vs beverage-plus-food
- true COGS after waste and premium product mix
