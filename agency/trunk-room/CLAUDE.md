# Agency: Trunk Room / Self-Storage Business — Kansai Japan

**See `~/.claude/CLAUDE-common-to-all-agency-projects.md`** for common agency rules: research methodology, communication patterns, role definitions. This file contains market-specific content only.

---

## Mission
Build a complete, actionable business model for owning and operating a trunk room (トランクルーム) / self-storage business in Kansai (Nara, Osaka, Kyoto, Wakayama). This is a **TYPE A/B passive income business** — customers rent storage units monthly, automated access control means near-zero owner involvement. Owner checks in once a week.

## Why This Business
The CEO's target model: convert a warehouse or unused building into 20–50 storage units, rent at ¥5K–¥15K/unit/month, achieve 70-80% occupancy = ¥700K–¥600K/month revenue on a ¥3M–¥5M conversion investment. Japan's trunk room market is growing at 8%+ per year due to small apartment sizes. Once full, owner involvement is near zero — automated door locks, online payment.

## The Japanese Trunk Room Market
- 10,000+ facilities nationwide, growing fast
- Tokyo/Osaka demand strongest — small apartments create chronic storage shortage
- New driver: e-commerce sellers using trunk rooms as mini-warehouses
- Indoor climate-controlled units command premium (¥15K–¥30K/month for 1–2 tsubo)
- Outdoor container units are cheaper to set up (¥500K per container) but lower rent

## Priority Research Topics

### 1. The Business Model Numbers
- Average monthly rent per unit by size (0.5 tsubo, 1 tsubo, 2 tsubo) in Nara/Osaka
- Occupancy rates for established trunk room businesses in Kansai
- Fixed costs: building lease or purchase, renovation, smart lock/access system, insurance, electricity
- Is the ¥3M investment → ¥200K/month passive model realistic? Find real operator data.
- Break-even timeline from opening

### 2. Getting Started — Franchise vs Independent
- Major franchises: Quraz (キュラーズ), Trunk Box, MoveIn, Hello Storage — compare fee structures
- Can a foreigner own/operate trunk room in Japan?
- Minimum viable size to be profitable (how many units?)
- Licensing: trunk room operators need a specific license in Japan — what is required?

### 3. Location and Space
- What type of building works: converted warehouse, container units on empty land, converted parking garage?
- Ideal locations: near dense residential (apartments with no storage), near commercial districts, near universities
- Nara/Wakayama — is demand strong enough, or is this an Osaka/Kyoto play only?
- Cost of renting a suitable warehouse space in Nara vs Osaka suburbs

### 4. Technology and Automation
- Smart lock / keypad systems for automated access — cost and providers
- Online booking and payment systems used by trunk room operators
- Surveillance camera requirements
- How fully automated can operations be? (Target: owner visits once per week max)

### 5. TYPE C Opportunities
- Existing trunk room businesses for sale — where to find them?
- Warehouse owners wanting to convert but lacking capital/knowledge — partnership model?
- Container units on unused land — can you lease land and place containers? What are the rules?

### 6. Realistic Scenarios
- Scenario A: Lease a 100 sqm warehouse in Nara for ¥80K/month, convert to 20 units at ¥8K each → profit at 75% occupancy?
- Scenario B: Buy 5 outdoor containers (¥2.5M total), place on leased land → ROI?
- Scenario C: Franchise model (Quraz) — what's the franchise fee and what do they provide?

## What to Log
- All findings with source URLs
- Real operator revenue numbers when found
- Specific franchise costs and terms
- Any TYPE C deals (businesses for sale, conversion opportunities)
- Automation technology options and costs

## Communication
When you complete a research round, send to command via relay:
```python
python3 -c "
import urllib.request, json
payload = json.dumps({'from':'agency-storage','to':'command','type':'done','body':'DONE — [one sentence summary of top finding]'}).encode()
req = urllib.request.Request('http://localhost:8765/send', data=payload, headers={'Content-Type':'application/json'}, method='POST')
urllib.request.urlopen(req)
"
```
