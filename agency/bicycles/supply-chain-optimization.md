# Supply Chain Optimization: Nara Sourcing to Kansai Resale Hubs

As of 2026-04-02

## Bottom line

- Start with a `1 + 1` network, not a permanent `1 + 2` network.
- Keep one primary intake/refurbishment hub in Nara.
- Keep Osaka as the default active resale hub.
- Use Kyoto as a selective overflow or appointment hub, not a fully stocked second hub, until volume justifies it.

Why:

- Nara storage is materially cheaper than central-city storage.
- Nara is close enough to both Osaka and Kyoto that stock can be moved in batches.
- Per-bike parcel shipping inside Kansai is too expensive for routine inter-hub replenishment.

## Recommended Network Design

### 1. Primary intake hub: Nara west / south-west

Use the Nara side for:

- intake
- cleaning and basic repair
- photography and listing
- slow-moving or low-margin stock
- parts and tools

The strongest current storage bands I found are on the low-cost outer Nara side:

- Hello Storage Nara Minamikyobate 1: JPY 3,200 to JPY 26,800 per month
- Hello Storage Nara Horencho: JPY 4,300 to JPY 28,200 per month
- Hello Storage Nara Daianji: JPY 7,400 to JPY 30,900 per month

Operationally, this should be the only place that always carries full inventory.

### 2. Secondary resale hub: Osaka first

Use Osaka for:

- the highest buyer density
- faster commuter-bike turnover
- handoff pickups after pre-listing from Nara
- weekend batch drops

A practical Osaka pattern is:

- store in Nara
- list inventory to Osaka buyers immediately
- move only the bikes with active inquiries, holds, or enough batch density

For Osaka storage, the useful current benchmarks are:

- Inaba Box Takadono: JPY 4,180 to JPY 16,390 per month
- Inaba Box Shigino Higashi: JPY 4,070 to JPY 17,710 per month
- Quraz is a higher-service indoor option with no admin fee or deposit, but it is better reserved for cleaner, higher-value inventory

### 3. Kyoto as a selective hub

Kyoto should not be permanently stocked at small scale. Use it for:

- better-condition commuter bikes
- student-facing inventory
- road / cross / lifestyle bikes with stronger photo-led presentation
- pre-sold pickup windows

Good current south-Kyoto benchmark:

- Hello Storage Kyoto Takeda 2: JPY 6,800 to JPY 48,500 per month, 6 minutes on foot from Takeda Station

South Kyoto is preferable to central Kyoto because access is better and rent is easier to justify.

## Transport Economics

### Route reality

Current route references show:

- JR Nara Station to Umeda: about 32.5 km by road, about 35 minutes by car
- JR Nara Station to Kyoto Station: about 39.4 km by road, about 34 minutes by car

That means both resale cities are close enough for batched same-day moves. The optimization problem is not distance. It is load factor.

### Shipping modes

### A. Own vehicle or short self-drive run

This is the cheapest option if you already control a kei van, light truck, or rental with enough cargo room.

- Nara to Umeda driving estimate: JPY 558 to JPY 806
- Nara to Kyoto Station driving estimate: JPY 684 to JPY 988

These are route-cost estimates, not a full sourcing-loop day. They still show the core point: if you already have the vehicle, intercity movement is cheap.

### B. Akabou light-truck charter

Akabou Nara pricing is useful for urgent low-volume moves:

- up to 20 km: JPY 5,500
- 21 to 50 km: add JPY 242 per km
- if Osaka City is origin or destination: add JPY 440 district surcharge

Approximate distance-mode economics:

- Nara to Osaka central: about JPY 9,100 before extra loading time
- Nara to Kyoto Station: about JPY 10,100 before extra loading time

This is workable when split across several bikes:

- 4 bikes to Osaka: about JPY 2,275 per bike
- 6 bikes to Osaka: about JPY 1,517 per bike
- 8 bikes to Osaka: about JPY 1,138 per bike

Conclusion:

- Akabou is good for `4 to 8` bikes when you need speed without renting and driving yourself.
- Below 4 bikes, it only works for mid-margin or premium stock.

### C. Rentora van / box truck with driver

Current standard pricing:

- 1t van, 2h regular: JPY 19,000
- 1t van, 3h regular: JPY 25,000
- 1t van, 4h regular: JPY 27,880
- 2t aluminum van, 2h regular: JPY 22,900
- 2t aluminum van, 3h regular: JPY 30,680
- 2t aluminum van, 4h regular: JPY 36,790

Capacity references:

- 1t van: about 4.5 m3 cargo space
- 2t aluminum van: about 11 to 15 m3 cargo space

Inference:

- 1t van only makes sense when combined with other cargo, a dense route, or higher-value bikes.
- If you are already paying for a driver and labor, the jump from 1t to 2t is small enough that the 2t truck is usually the better batch-transfer choice.

### D. Parcel shipping inside Kansai

Sagawa's large-size Kansai rates make routine inter-hub parcel movement unattractive:

- 240 size: JPY 5,240
- 260 size: JPY 6,420

That is per bike, per shipment. For a bicycle resale operation this means:

- do not use parcel shipping for normal Nara to Osaka or Nara to Kyoto replenishment
- use parcel only for direct-to-buyer sold shipments, premium bikes, or remote buyers outside pickup range

### E. One-way rentals

Nippon Rent-A-Car charges one-way fees for wagons and trucks at JPY 1,100 per 10 km, with under 20 km free.

Implication:

- Nara to Osaka one-way will usually add roughly JPY 3,300 to JPY 4,400
- Nara to Kyoto one-way will usually add roughly JPY 4,400

So one-way rentals are usually inferior unless the vehicle ends the day in the right city for additional work.

## Storage Strategy

### What to store where

### Nara: bulk, intake, repairs, low-margin stock

Best fit:

- outdoor container or low-cost warehouse
- direct vehicle access
- room for stands, cleaning gear, spare parts, photos, and repairs

Risks:

- outdoor storage has no air conditioning
- rust, condensation, and battery sensitivity are real

Policy:

- Nara should hold mamachari, basic city bikes, donor bikes, and most unfinished stock
- wrap chains, keep tires off damp floors, use covers and desiccant for anything holding more than a week

### Osaka: clean, sale-ready stock only

Best fit:

- bikes already cleaned, tuned, photographed, and priced
- appointment pickups
- short holding periods

Do not use Osaka as a second refurbishment shop unless weekly volume is high enough to keep labor and storage productive.

### Kyoto: curated stock only

Best fit:

- good-condition commuter and lifestyle bikes
- higher-visual inventory
- appointment or weekend pickup

Kyoto should be a selective presentation node, not a deep inventory node.

### Cheap overflow option

Nara Bicycle Center pricing is:

- JPY 2,900 per month per bicycle
- JPY 160 per day per bicycle

This is too expensive to be a main inventory solution for low-margin bikes, but it can be useful as:

- buyer pickup staging
- 1 to 3 day overflow
- temporary holding during heavy sourcing weeks

## Inventory Management Economics

### The key rule

Physical relocation should be driven by expected gross-margin improvement, not by a vague sense that "Osaka sells faster."

Use this decision rule:

`move stock only if expected price uplift + faster-sale benefit > transfer cost + extra handling + extra storage`

In plain terms:

- if moving a bike to Osaka or Kyoto does not clearly add more net profit than it costs, leave it in Nara and sell from Nara pickup or direct shipment

## Margin classes

### Class A: low-margin / fast-turn

Examples:

- mamachari
- basic city bikes
- rough commuter stock

Policy:

- keep in Nara
- list immediately to all cities
- move only after hold / deposit or when a batch hits at least 6 bikes

Target:

- inventory age under 21 days
- markdown starts by day 14

These bikes cannot absorb repeated handling or per-bike logistics costs above roughly JPY 1,000 to JPY 1,500.

### Class B: mid-margin

Examples:

- branded commuter bikes
- cross bikes
- entry road bikes

Policy:

- Osaka hub is justified if either:
- batch size is at least 4 bikes
- or the expected sale-price uplift is clearly above transfer cost

Target:

- inventory age under 30 days
- markdown at day 21 and day 35

### Class C: high-margin / sensitive

Examples:

- e-bikes
- road bikes worth careful presentation
- vintage / collectible bikes

Policy:

- store indoors
- avoid outdoor containers when batteries, electronics, or corrosion risk matter
- parcel shipping is acceptable after sale

These units can absorb more logistics cost, but not poor storage conditions.

## Carrying-cost model

Use this formula each month:

`carrying cost per bike-month = storage allocation + capital cost + damage/rust reserve + handling/admin reserve`

A practical reserve model:

- storage allocation: facility rent divided by average bikes actually stored
- capital cost: 1 percent of inventory cost per month as a simple hurdle rate
- damage / rust reserve: 1 to 2 percent of target sale price per month for outdoor storage
- handling / admin reserve: JPY 300 to JPY 700 per bike-month

Operational consequence:

- if a bike cannot clear within 30 days, the cheapest supply chain is usually markdown plus sale, not another relocation

## Recommended Operating Policy

1. Source in Nara and bring everything to the Nara hub first.
2. Clean, photograph, and list within 24 hours where possible.
3. Cross-list immediately for Nara, Osaka, and Kyoto pickup even while the bike is physically in Nara.
4. Transfer to Osaka only when:
   - at least 6 low-margin bikes are ready, or
   - at least 4 mid-margin bikes are ready, or
   - specific buyer appointments justify the move.
5. Transfer to Kyoto only for selective inventory or pre-sold appointments.
6. Keep only sale-ready stock in city hubs.
7. After 45 days, either markdown hard, bundle, or part out.

## Best Practical Setup Right Now

If starting from zero, the strongest current operating setup is:

- Nara primary hub in a low-cost outer container site
- Osaka micro-hub in an indoor site with parking for short ready-to-sell holding
- no permanent Kyoto inventory until weekly throughput increases

That gives:

- lowest fixed storage cost
- best access to sourcing
- access to Osaka demand without paying Osaka rent on unsold stock
- optional Kyoto reach without creating a third full inventory pool

## Sources

- Rome2Rio, JR Nara Station to Umeda: https://www.rome2rio.com/ja/s/%E5%A5%88%E8%89%AF%E9%A7%85/%E6%A2%85%E7%94%B0
- Rome2Rio, JR Nara Station to Kyoto Station: https://www.rome2rio.com/ja/s/%E5%A5%88%E8%89%AF%E9%A7%85/%E4%BA%AC%E9%83%BD%E9%A7%85
- Sagawa large-size delivery overview: https://www.sagawa-exp.co.jp/service/h-largesize/
- Sagawa large-size fare table PDF: https://www2.sagawa-exp.co.jp/uploads/resources/whatsnew/2023/pdf/h-largesize_new.pdf
- Akabou Nara fare guide: https://nara.akabou.jp/fare/
- Rentora pricing system: https://rentora.com/system/
- Rentora self-service size and pricing: https://rentora.com/self/
- Nippon Rent-A-Car one-way fees: https://www.nipponrentacar.co.jp/service/oneway.html
- Hello Storage Nara Minamikyobate 1: https://www.hello-storage.com/nara/narashi/detail/4146/
- Hello Storage Nara Horencho: https://www.hello-storage.com/nara/narashi/detail/4224/
- Hello Storage Nara Daianji: https://www.hello-storage.com/nara/narashi/detail/5162/
- Hello Storage Kyoto Takeda 2: https://www.hello-storage.com/kyoto/kyotoshi/fushimiku/detail/5092/
- Inaba Box Takadono: https://www.inaba-box.jp/shop/1210/
- Inaba Box Shigino Higashi: https://www.inaba-box.jp/shop/10457/
- Quraz pricing / fee structure: https://www.quraz.com/common/price.aspx
- Quraz moving support: https://www.quraz.com/guide/moving.aspx
- Quraz usage guide: https://www.quraz.com/guide/
- Nara Bicycle Center: https://www.narakotsu.co.jp/related-business/bicycle-parking/bicycle-nara/
