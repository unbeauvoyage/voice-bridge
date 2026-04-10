# Agency: Housing / Mortgage Property Scanner — Japan

**See `~/.claude/CLAUDE-common-to-all-agency-projects.md`** for common agency rules: research methodology, communication patterns, role definitions. This file contains market-specific content only.

---

## Mission
Find the most cost-effective properties to buy with a mortgage (住宅ローン) in Japan. Identify best value areas, price ranges, and opportunities across target cities.

## Priority
1. **Nara**
2. **Kyoto**
3. **Osaka**
4. **Tokyo**

## What to Research

### Properties
- Used houses (中古一戸建て) and condos (中古マンション) for sale
- New builds (新築) where cost-effective
- Price ranges by area within each city
- Best value neighborhoods — up-and-coming areas, underpriced for their access/quality
- Listings platforms: SUUMO, HOME'S, at home (アットホーム), LIFULL, Real Estate Japan (for foreigners)

### Mortgage / Loan
- How mortgages work in Japan for residents (外国人も含む)
- Major lenders: Japan Housing Finance Agency (住宅金融支援機構 / Flat 35), major banks (MUFG, SMBC, mizuho), regional banks, SBI/Aruhi online lenders
- Current interest rates (fixed vs variable) — as of 2026
- Flat 35 — government-backed fixed rate mortgage details
- Down payment requirements (typically 10-20%)
- Eligibility for non-Japanese nationals
- Total cost calculation: purchase price + registration fees (登記費用) + agency fee (仲介手数料 3%) + bank fees

### Market Conditions
- Japan property market trends 2025-2026 — rising? stabilizing?
- Best time to buy? Any seasonal patterns?
- Areas with strong rental yield if buying as investment
- Areas with declining population (buying risk) vs growing areas

### Nara Specifics
- Nara city vs Yamato-Koriyama vs Kashihara — where is best value?
- Commute to Osaka/Kyoto (Kintetsu line) — commuter towns with low prices?
- Rural Nara — very cheap properties (古民家), renovation potential?

## Messaging
To message COMMAND or any other agent: `mcp__message-hub__hub_send(to, message)`
To check your messages: `mcp__message-hub__hub_poll("agency-housing-mortgage")`
Don't worry about whether the target is online — the hub queues if needed.
When you finish a research cycle, send: `hub_send(to: "command", message: "DONE — [one sentence]")`

## You Are the Research Lead
Read ~/environment/CLAUDE.md (agency section). Your context = pure data. Subagents only for fetching. Log everything to .worklog/housing-lead.md.
