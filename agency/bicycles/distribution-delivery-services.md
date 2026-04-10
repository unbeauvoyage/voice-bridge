# Distribution And Delivery Services For Bicycle Resale

Researched on April 2, 2026. Focus: Nara, Kyoto, and Osaka resale operations.

## Bottom line

- Local pickup should be the default for low-ticket, bulky bicycles. On Jimoty, normal transactions are free and built for direct handoff, and if shipping is hard to price the seller can set the handoff method to `取りに来てもらう` (buyer picks up). This keeps delivery cost at zero and protects spread.
- Shipped bikes only make sense when either the buyer covers delivery or the gross spread is large enough to absorb roughly `JPY 5,000-12,000` of freight plus packing friction.
- E-bikes are harder to scale through large-item services. Mercari's `梱包・発送たのメル便` (Mercari large-item packing and shipping service) follows Art Setting Delivery's rules, and batteries or battery-equipped items are listed as non-acceptable. Local pickup is the safer default unless the battery is removed and the carrier confirms acceptance.

## Channel comparison

| Channel | Customer experience | Seller cost / burden | Best fit | Margin impact |
| --- | --- | --- | --- | --- |
| Jimoty local pickup | Direct handoff. Shipping fee can be negotiated between users for online-payment listings, but Jimoty explicitly suggests using `0円` shipping or `取りに来てもらう` (buyer picks up) when shipping is hard to set. | Coordination only. No box required. | Mamachari (upright city bikes), student bikes, lower-ticket city bikes. | Best margin preservation. |
| Seller local delivery / Akabou | Same-day or near-term local dropoff is possible. Akabou's published distance-based rate is `JPY 5,500` up to `20 km`, then `JPY 242/km` for `21-50 km`, plus `JPY 550` for loading/unloading up to `30` minutes and `JPY 550` per additional `15` minutes. | No carton build, but route time matters. | Premium bikes, bundled sales, or customers who will pay for convenience. | Usually too expensive for low-end bikes unless you charge a delivery fee. |
| Sagawa `飛脚ラージサイズ宅配便` (Hikyaku Large Size Express) | Home delivery for large parcels. From Kansai, published standard rates are `JPY 5,240` for `240` size within Kansai and `JPY 6,420` for `260` size within Kansai. To Kanto, the same sizes are `JPY 6,830` and `JPY 8,420`. | Seller must pack the bike. Limit is `260 cm` combined dimensions and `50 kg`. | Mid-value road, folding, or mountain bikes that fit the size cap. | Freight is manageable only when resale spread is already healthy. |
| Sagawa office pickup | Same freight charge as normal delivery, but no extra service fee for pickup at an Sagawa office. This can reduce missed-delivery friction. | Same packing requirement as above. | Buyers who can self-collect from a depot. | Good compromise when home scheduling is awkward. |
| Mercari `梱包・発送たのメル便` (Mercari large-item packing and shipping service) | Nationwide flat pricing for large items. `250` size is `JPY 8,600`, `300` size is `JPY 12,000`. Buyer selects desired delivery date/time. Pickup crew handles packing and carrying. | No packaging labor, but Mercari takes `10%` of `sale price - shipping`. If measured size is larger than expected, extra freight is deducted from profit. | Higher-ticket road, vintage, and collector bikes where convenience matters. | Usually too expensive for low-ticket bikes, but useful when packaging time is the real bottleneck. |
| Art Setting Delivery `家財おまかせ便` (white-glove household-item delivery) direct | White-glove home service: pickup, packing, delivery, unpacking, placement, and material removal. Art measures actual size before packing, and folding bicycles are assessed in their folded state. | Quote depends on postal codes and actual measured size. March 1-April 30 adds a `JPY 2,200` seasonal surcharge per job. | Direct-sale premium bikes, fragile vintage bikes, buyers who value convenience. | Expensive, but it removes most handling risk and seller labor. |

## Packaging costs that affect margin

These raw material prices are current examples from major Japanese office/packing suppliers:

- Roll cardboard `1200 mm x 50 m`: `JPY 6,235`, or about `JPY 125/m`.
- Bubble wrap `1200 mm x 42 m`: `JPY 2,576`, or about `JPY 61/m`.
- OPP packing tape `50 mm x 50 m`: about `JPY 185/roll` for a low-end option.

Operating inference:

- A seller-packed bicycle usually needs about `2-3 m` of cardboard, `2-4 m` of bubble wrap, and `0.25-0.5` roll of tape.
- That puts raw packaging material cost at roughly `JPY 500-900` per bike before extra pads, zip ties, reused spacers, or a replacement carton.
- Hidden cost matters too: partial disassembly, wheel/pedal turning, wrapping, labeling, and dropoff can easily consume `20-45` minutes per bike.

## Margin rules of thumb

These are operating inferences based on the published freight tables above.

- `JPY 12,000` mamachari (upright city bike):
  - Jimoty pickup keeps almost the full gross sale price.
  - Sagawa `260` within Kansai leaves roughly `JPY 4,680-5,080` before acquisition cost, repairs, and platform fees.
  - Mercari `250` leaves about `JPY 3,060` before acquisition cost because `JPY 8,600` shipping and a `JPY 340` sales fee eat the rest.
- `JPY 25,000` bike sold direct with Sagawa `240` inside Kansai:
  - After freight and materials, gross remains about `JPY 18,860-19,260` before acquisition and repair.
- `JPY 25,000` bike on Mercari `250`:
  - Payout is about `JPY 14,760` because the fee is charged on `JPY 16,400` after shipping is removed.
- E-bikes:
  - Treat them as pickup-first inventory unless you have a verified carrier workflow for the battery. Large-item white-glove services explicitly exclude batteries or battery-equipped items.

## Recommended operating policy

- Use Jimoty or direct local sales as the default channel for `mamachari` (upright city bikes) and any bicycle you expect to sell below roughly `JPY 20,000`.
- Offer a fixed local delivery fee inside Nara, Kyoto, or Osaka only when you can do the route yourself or batch multiple deliveries.
- Use Sagawa large-size shipping for bikes with enough spread to survive `JPY 5,000-8,500` freight plus `JPY 500-900` of materials.
- Use Mercari `たのメル便` (Mercari large-item service) or Art direct service for higher-value bikes where customer convenience, anonymity, and reduced handling risk justify the higher freight.
- Keep e-bikes local unless the battery issue is solved before listing.

## Sources

- Jimoty FAQ: shipping fee handling and pickup option  
  https://faq.jmty.jp/%E9%85%8D%E9%80%81%E6%96%99%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6-64be43d2db6d0d001bc36464
- Jimoty FAQ: direct-in-person marketplace positioning  
  https://faq.jmty.jp/%25E6%258C%25AF%25E8%25BE%25BC%25E3%2583%25BB%25E9%2583%25B5%25E9%2580%2581%25E3%2583%25BB%25E7%2599%25BA%25E9%2580%2581%25E3%2581%25A7%25E3%2581%25AE%25E5%25AF%25BE%25E5%25BF%259C%25E3%2582%2592%25E4%25BE%259D%25E9%25A0%25BC%25E3%2581%2595%25E3%2582%258C%25E3%2581%259F-63689ea309405a001d1f2154
- Jimoty FAQ: safer meetup guidance  
  https://faq.jmty.jp/%E8%87%AA%E5%AE%85%E3%81%A7%E3%81%AE%E3%81%8A%E5%8F%96%E5%BC%95-64e70c2f696ccd001ba6ddcf
- Sagawa published parcel size cap example  
  https://www.sagawa-exp.co.jp/service/jikantai/?vm=r
- Sagawa Kansai rate table  
  https://www.sagawa-exp.co.jp/fare/faretable08.html
- Sagawa office pickup example in Osaka  
  https://www.sagawa-exp.co.jp/hands-freetravel/servicecenter/osaka_amemura.html
- Mercari `梱包・発送たのメル便` rates and fee handling  
  https://help.jp.mercari.com/guide/articles/215/
- Mercari `梱包・発送たのメル便` seller flow  
  https://help.jp.mercari.com/guide/articles/203/
- Mercari `梱包・発送たのメル便` buyer flow  
  https://help.jp.mercari.com/guide/articles/279/
- Mercari non-shippable goods for `梱包・発送たのメル便`  
  https://help.jp.mercari.com/guide/articles/221
- Art Setting Delivery `家財おまかせ便`  
  https://www.008008.jp/transport/kazai/
- Akabou Shiga published distance-based rate example  
  https://shiga.akabou.jp/group-client/group1.php
- Askul roll cardboard example  
  https://www.askul.co.jp/p/KR49156/
- Askul bubble-wrap example  
  https://www.askul.co.jp/sp/p/890084/
- Askul OPP tape example  
  https://www.askul.co.jp/p/RX66084/
