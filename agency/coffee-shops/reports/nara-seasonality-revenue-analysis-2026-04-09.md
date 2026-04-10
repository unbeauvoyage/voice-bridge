# Nara Coffee Shop: Seasonal Patterns and Revenue Impact Analysis

Date: 2026-04-09

## Bottom line

- `Kintetsu` is the most seasonally stable cash-flow location.
- `Sanjo` is the best middle ground: less volatile than `Sarusawa`, better upside than `Kintetsu`.
- `Sarusawa` has the highest tourist upside, but also the highest winter and bad-weather exposure.

## Data quality and method

- I did **not** find a direct official monthly visitor series for `Sarusawa Pond` itself.
- For `Sarusawa` seasonality, I use the official **monthly Nara City visitor pattern** as the closest defensible proxy because Sarusawa sits inside the core sightseeing circuit linking Kintetsu Nara, Sanjo-dori, Kohfukuji, and Nara Park.
- For `2025`, I found official monthly **Nara-prefecture Area A lodging data** for Q1 and Q2, which covers the Nara-city-centered tourism area and confirms that the recovery pattern remained strong.
- As of `2026-04-09`, I did **not** find an official `2025 full-year` monthly Nara City visitor release or `2026 monthly` city visitor series.

## 1. Sarusawa Pond visitor seasonality

### Official proxy: Nara City monthly visitors in 2024

Source base: `14.87 million` annual visitors, average `1.239 million/month`.

| Month | Visitors (m) | Variance vs annual monthly average |
|---|---:|---:|
| Jan | 0.971 | -21.6% |
| Feb | 0.952 | -23.2% |
| Mar | 1.317 | +6.3% |
| Apr | 1.343 | +8.4% |
| May | 1.433 | +15.6% |
| Jun | 1.237 | -0.2% |
| Jul | 1.122 | -9.5% |
| Aug | 1.201 | -3.1% |
| Sep | 1.128 | -9.0% |
| Oct | 1.454 | +17.3% |
| Nov | 1.473 | +18.9% |
| Dec | 1.239 | +0.0% |

### Read-through for Sarusawa

- Peak months: `November`, `October`, `May`
- Trough months: `February`, `January`, then `July/September`
- Peak-to-trough variance: `54.7%` (`November` vs `February`), or `42.0%` spread relative to the annual monthly average

### Predictable patterns

- `New Year`: January is better than February, but still below annual average.
- `Cherry blossom`: late March to early April lifts traffic materially.
- `Golden Week`: May is a clear domestic peak.
- `Rainy season`: June normalizes back to average.
- `Summer heat`: July and September soften despite inbound support.
- `Autumn foliage`: October and November are the strongest months.

### 2025-2026 availability

- `2025 full-year city monthly visitors`: not found in official publication as of 2026-04-09
- `2026 monthly city visitors`: not found
- Best official 2025 confirmation available: Nara-prefecture `Area A` lodging demand
  - `Q1 2025`: `571,979`, up `38.3%` YoY
  - `Q2 2025`: `757,808`, up `31.5%` YoY

Interpretation: the seasonal shape from 2024 still looks usable for Year 1 planning; if anything, inbound recovery is making shoulder and peak months more resilient rather than less.

## 2. Tourist segments and seasonality

### Domestic tourists

- Domestic demand is most visibly concentrated around `Golden Week`, `autumn foliage`, and `New Year`.
- The citywide monthly profile shows strong domestic-driven lifts in `May`, `October`, and `November`.
- `Obon` helps `August`, but not enough to make it a top-tier month in Nara.

### Foreign tourists

Official Nara City foreign lodging counts in 2024 show a different pattern from domestic traffic:

- Strongest months: `April` (`50.0k`), `October` (`45.8k`), `November` (`45.6k`), `July` (`42.6k`)
- Weakest months: `January` (`19.7k`), `February` (`23.0k`)

Implication:

- Foreign visitors strengthen `spring`, `autumn`, and part of `summer`.
- They reduce, but do not remove, the winter trough.

### Group tours and school trips

Official Nara City school-trip lodging counts in 2024:

- Peak months: `October` (`20,065`), `May` (`18,561`), `September` (`11,226`), `November` (`10,434`)
- Weak months: `January`, `February`, `July`, `August`

Implication:

- School groups are a meaningful support line in `May`, `June`, `September`, `October`, and `November`.
- They are **not** a reliable fix for the `January-February` hole.

### School holiday impact

- `Golden Week` is a major revenue driver.
- `Summer school holidays` help family and inbound traffic, but daytime heat likely depresses dwell time and food attachment.
- `Winter school break` helps around New Year, then demand falls off sharply into February.

### Weather impact

- `Cherry blossom`: late `March` to early `April` is the key planning window in Nara.
- `Autumn leaves`: `mid-November` to early `December` is the key planning window.
- `Rain` and `heat` matter more for `Sarusawa` than for `Kintetsu` because tourist strolling is outdoors and discretionary.
- The bloom and foliage windows above are an inference from the official Nara tourism calendar and the observed monthly visitor peaks.

## 3. Local commuter seasonality

### Kintetsu Station area

- `Kintetsu Nara Station` reported `56,935` daily passengers on the 2024 survey day.
- The station area benefits from rail demand, bus interchange demand, convenience demand, and routine errands.
- Nearby education demand adds weekday stability:
  - `Nara Women's University`: `2,591` students (`2022` source page)
  - `Nara Prefectural University`: `705` students (`2025` source page)

Conclusion:

- `Kintetsu` should be the most stable year-round location.
- It is still helped by tourist peaks, but it is less dependent on them than `Sarusawa`.

### Student and commuter patterns

- Term-time weekdays should support morning, lunch, and after-school trade.
- January-February are weaker because university activity and local discretionary spend are softer, but the station base prevents the drop seen in leisure-only zones.

### Weather impact on local foot traffic

- Local commuter demand is relatively weather-resistant because trips are necessity-based.
- `Sarusawa` is the most weather-sensitive.
- `Sanjo` is mixed: it still gets pass-through demand, but tourist strolling matters.

## 4. Revenue impact on break-even

## Model assumptions

- Revenue model uses the official Nara City monthly visitor index above.
- Break-even is modeled as a monthly operating break-even line, not full startup payback.
- Location sensitivity to tourism swings is an inference from geography and demand mix:
  - `Sarusawa`: `0.95` tourism sensitivity
  - `Sanjo`: `0.65` tourism sensitivity
  - `Kintetsu`: `0.45` tourism sensitivity
- Average-month revenue assumptions for Year 1:
  - `Sarusawa`: `¥3.65m`
  - `Kintetsu`: `¥3.45m`
  - `Sanjo`: `¥3.52m`
- Monthly break-even assumptions:
  - `Sarusawa`: `¥3.50m`
  - `Kintetsu`: `¥3.05m`
  - `Sanjo`: `¥3.20m`

### Sarusawa premium location

- Peak season (`November`): `¥4.30m`
- Trough season (`February`): `¥2.85m`
- Average month: `¥3.65m`
- Months in profitability zone: `8`
- Months below break-even: `4`
- Seasonal cash-flow impact:
  - cumulative position bottoms at `-¥1.25m` by end-February
  - recovers above zero in `May`
  - slips close to flat again by end-September (`+¥0.09m`)
  - finishes Year 1 at `+¥1.80m`

Interpretation: Sarusawa works, but it needs a real seasonal buffer. The winter hole is manageable only if opening capital is sized for it.

### Year 1 monthly revenue projection

#### Sarusawa

| Month | Revenue (¥m) | Vs Break-even | Cumulative (¥m) | Status |
|---|---:|---:|---:|---|
| Jan | 2.90 | -0.60 | -0.60 | Below |
| Feb | 2.85 | -0.65 | -1.25 | Below |
| Mar | 3.87 | +0.37 | -0.89 | Above |
| Apr | 3.94 | +0.44 | -0.45 | Above |
| May | 4.19 | +0.69 | +0.25 | Above |
| Jun | 3.64 | +0.14 | +0.39 | Above |
| Jul | 3.32 | -0.18 | +0.21 | Below |
| Aug | 3.54 | +0.04 | +0.26 | Above |
| Sep | 3.34 | -0.16 | +0.09 | Below |
| Oct | 4.25 | +0.75 | +0.85 | Above |
| Nov | 4.30 | +0.80 | +1.65 | Above |
| Dec | 3.65 | +0.15 | +1.80 | Above |

#### Kintetsu

| Month | Revenue (¥m) | Vs Break-even | Cumulative (¥m) | Status |
|---|---:|---:|---:|---|
| Jan | 3.11 | +0.06 | +0.06 | Above |
| Feb | 3.09 | +0.04 | +0.10 | Above |
| Mar | 3.55 | +0.50 | +0.60 | Above |
| Apr | 3.58 | +0.53 | +1.13 | Above |
| May | 3.69 | +0.64 | +1.77 | Above |
| Jun | 3.45 | +0.40 | +2.17 | Above |
| Jul | 3.30 | +0.25 | +2.43 | Above |
| Aug | 3.40 | +0.35 | +2.78 | Above |
| Sep | 3.31 | +0.26 | +3.04 | Above |
| Oct | 3.72 | +0.67 | +3.71 | Above |
| Nov | 3.74 | +0.69 | +4.40 | Above |
| Dec | 3.45 | +0.40 | +4.80 | Above |

#### Sanjo

| Month | Revenue (¥m) | Vs Break-even | Cumulative (¥m) | Status |
|---|---:|---:|---:|---|
| Jan | 3.02 | -0.18 | -0.18 | Below |
| Feb | 2.99 | -0.21 | -0.39 | Below |
| Mar | 3.66 | +0.46 | +0.08 | Above |
| Apr | 3.71 | +0.51 | +0.59 | Above |
| May | 3.88 | +0.68 | +1.27 | Above |
| Jun | 3.52 | +0.32 | +1.58 | Above |
| Jul | 3.30 | +0.10 | +1.69 | Above |
| Aug | 3.45 | +0.25 | +1.94 | Above |
| Sep | 3.31 | +0.11 | +2.05 | Above |
| Oct | 3.92 | +0.72 | +2.77 | Above |
| Nov | 3.95 | +0.75 | +3.52 | Above |
| Dec | 3.52 | +0.32 | +3.84 | Above |

## 5. Seasonal risk mitigation

### Which location is most seasonally stable?

1. `Kintetsu`
2. `Sanjo`
3. `Sarusawa`

Reason:

- `Kintetsu` has the strongest non-tourist demand floor.
- `Sanjo` gets both station flow and tourist spillover.
- `Sarusawa` is the most exposed to leisure timing, weather, and sightseeing intensity.

### Can off-season events help?

Yes, but only partially.

- `Winter`: Nara Park seasonal events such as `Nara Rurie` and winter deer-related events can add bursts of evening traffic.
- `Summer`: `Nara Tokae` can support August evenings.
- `School groups`: strongest in `May`, `September`, `October`, `November`; useful for shoulder support, weak as a winter fix.

Best use:

- Use events to lift `weekday evenings` and `shoulder periods`.
- Do not underwrite the base lease on event traffic.

### Staff adjustment strategies during trough months

- Keep a higher share of flexible part-time labor at `Sarusawa` than at `Kintetsu`.
- Compress weekday trading hours in `January-February` if breakfast demand is weak.
- Shift labor into pre-batch bakery, bottled drinks, beans, and merchandise during rainy or cold weeks.
- Schedule training, maintenance, and menu R&D in `February`.
- Add local-resident offers in winter: morning set, student plan, commuter takeaway subscription, warm-dessert campaign.

## Recommendation

- If the goal is **most stable cash flow**, choose `Kintetsu`.
- If the goal is **balanced upside and acceptable volatility**, choose `Sanjo`.
- If the goal is **maximum tourist upside** and you can fund seasonal dips, choose `Sarusawa`.

My operating recommendation: `Kintetsu` first, `Sanjo` second, `Sarusawa` only if you want a tourism-led concept and can carry at least the `~¥1.25m` modeled seasonal cash hole plus normal startup reserve.

## Sources

- Nara City 2024 tourism release: https://www.city.nara.lg.jp/site/press-release/241572.html
- Nara City tourism report PDF: https://www.city.nara.lg.jp/uploaded/attachment/197898.pdf
- Nara Prefecture accommodation statistics index: https://www.pref.nara.lg.jp/n109/21925.html
- Nara Prefecture Q1 2025 accommodation report PDF: https://www.pref.nara.lg.jp/documents/6390/r71-3houkokusyo.pdf
- Kintetsu station boarding/alighting counts: https://www.kintetsu.co.jp/tetsudo/c.html
- Kintetsu Nara station map/info: https://www.kintetsu.co.jp/soukatsu/kounai/nara.html
- Nara Women's University overview: https://www.nara-wu.ac.jp/nwu/intro/overview/
- Nara Prefectural University outline: https://www.narapu.ac.jp/university/overview/outline/
- Official Nara Park page: https://www.visitnara.jp/venues/A00489/
