# Agency: Coin Parking Business — Kansai Japan

**See `~/.claude/CLAUDE-common-to-all-agency-projects.md`** for common agency rules: research methodology, communication patterns, role definitions. This file contains market-specific content only.

---

## Mission
Build a complete, actionable business model for owning and operating a coin parking lot (コインパーキング) in Kansai (Nara, Osaka, Kyoto, Wakayama). This is a **TYPE A passive income business** — machines collect money 24/7, owner visits once a week to collect cash and check equipment. Near-zero daily involvement.

## Why This Business
The CEO's target model: lease or own a small lot (3–10 spaces), install coin parking machines (¥500K–¥1.5M), earn ¥150K–¥400K/month passively. Near tourist spots, train stations, and hospitals, parking demand is constant. A 5-space lot near Nara Park could earn ¥30K–¥60K per space per month. Owner collects cash weekly — no staff needed.

## Why This Business (Type C Angle)
Landowners who no longer want to manage their property sometimes contract coin parking operators at very favorable terms. A vacant lot near a tourist attraction = money printer. Find these opportunities.

## Priority Research Topics

### 1. The Business Model Numbers
- Monthly revenue per space in: Nara city center, near Kintetsu Nara station, Osaka suburb, near hospitals
- Typical hourly/daily rates for coin parking in Kansai tourist areas
- What % of the time is each space occupied? (occupancy rate)
- Fixed costs: machine maintenance, cash collection service, land lease if not owned, electricity
- Is the ¥500K investment → ¥150K/month passive model realistic? Find real operator data.

### 2. Getting Started — Capital and Setup
- Cost of coin parking machine systems (Park24-style flat systems vs gate systems)
- Companies that provide turnkey coin parking installation: Times24, Navipark, D-Parking
- Can a foreigner own/operate a coin parking business in Japan?
- Minimum lot size (how many spaces needed to be profitable?)
- Permit/licensing requirements in Nara and Osaka

### 3. Land — The Key Variable
- How to find vacant lots to lease for parking in Nara/Osaka
- Typical land lease cost per tsubo (坪) in Nara city center vs suburbs
- Are there landowners actively seeking parking operators? Where to find them?
- TYPE C ANGLE: Operators exiting the business, selling locations cheap — where to find?

### 4. Operating Model
- Self-managed vs managed service (e.g., Times24 manages everything for a fee — what's the split?)
- How often must cash be collected? Can it be automated with Suica/QR payment?
- Machine breakdown frequency and maintenance cost
- What insurance is needed?

### 5. Realistic Scenarios
- Scenario A: Lease a 5-space lot in Nara city for ¥50K/month, machines cost ¥800K → what is monthly profit?
- Scenario B: Lease a 10-space lot near Osaka station for ¥200K/month → breakeven and profit?
- Scenario C: Own land outright, install machines for ¥1.5M → ROI timeline?
- What is the realistic TYPE A (¥100K–¥500K startup) path to ¥100K/month passive?

### 6. Nara-Specific Opportunities
- Tourist parking demand around Nara Park, Todai-ji, Horyu-ji — quantify
- Are there vacant lots near major Nara attractions currently unused?
- Seasonal demand spikes (deer season, cherry blossom, autumn leaves) — how much uplift?
- Competition mapping: how many coin lots exist near Kintetsu Nara station?

## What to Log
- All findings with source URLs
- Real operator revenue numbers when found
- Specific lot locations or opportunities found
- Names of companies offering turnkey coin parking setups
- TYPE C deals: anyone selling a parking route or exiting the business

## Communication
When you complete a research round, send to command via relay:
```python
python3 -c "
import urllib.request, json
payload = json.dumps({'from':'agency-parking','to':'command','type':'done','body':'DONE — [one sentence summary of top finding]'}).encode()
req = urllib.request.Request('http://localhost:8765/send', data=payload, headers={'Content-Type':'application/json'}, method='POST')
urllib.request.urlopen(req)
"
```
