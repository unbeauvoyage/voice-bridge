# Issues

Small bugs, observations, and polish items. Tagged by team. Pick up when idle.

## Open
- [x] **[productivitesse]** Dashboard should remember last page opened — fixed in 5751aaa (localStorage tab persistence + Playwright test)
- [x] **[productivitesse]** Raw markdown in dashboard panels — fixed in 352a132 (markdown rendering in holographic panels, 18/18 tests)
- [x] **[relay/productivitesse]** Playwright tests send messages as "from: ceo" — fixed in 5bc24e1 (page.route mock, never reaches real agents)
- [x] **[relay]** Stuck "[TASK APPROVED]" loop — fixed: relay now only sends pending proposals on reconnect (not approved), Playwright test cleans up seeded proposals (ddd3972), historical queue draining
- [x] **[productivitesse]** Questions/Answers panel — fixed in 7972a29 (Q&A panel, 20/20 tests passing)
- [x] **[command/productivitesse]** Questions/Answers workflow — fixed in 6d89fff (two-section panel with status badges, relay GET /questions, questions/ directory created with backfilled entries)
- [x] **[productivitesse]** Proposals panel — resolved: relay shows 19/19 proposals after pm2 reload + pre-wrap fix (9a48e3b)
- [x] **[productivitesse]** CEO active indicator — fixed in 3571006 (pulsing ring on CEO planet + relay POST /ceo-active)
- [x] **[productivitesse]** Agent current-task label — fixed in 705204e (gold task labels on 3D planets + Playwright tests)
- [x] **[productivitesse]** Dashboard consolidation — fixed in d73b976 (consolidated overview, 20/20 tests passing)
- [x] **[relay]** CEO "recording" broadcast — fixed in 3571006 (relay POST /ceo-active endpoint, dashboard shows pulse ring)
- [x] **[productivitesse]** Notification system — fixed in 9796d2e (holographic notification cards, 19/19 tests)
- [x] **[productivitesse]** Agent/team hierarchy in 3D view — fixed in 21514e0 (AgentMoon component, hierarchy WS events, relay /agents/hierarchy endpoint)
- [x] **[productivitesse]** Proposals panel identical text bug — fixed in 9a48e3b (pre-wrap for multi-line title/summary display)
- [x] **[productivitesse]** Proposal "Do this" voice button — fixed in 562b475 (MediaRecorder → voice-bridge transcribe → relay with proposal context)
- [x] **[voice-bridge/relay]** CEO voice transcriptions not visible in dashboard — fixed in 46ab752 (conversation echo: voice-bridge sends transcripts to CEO relay feed)
- [x] **[productivitesse/voice-bridge]** Merge VoiceBridge into Productivitesse — fixed in 2672c95 (VoicePage + DashboardPage + bottom tab MobileLayout, 41/41 tests)
- [x] **[productivitesse]** Responsive web app — fixed in 8f4b323 (auto-switch to MobileLayout at <768px, 46/46 tests)
- [ ] **[productivitesse]** Doc Drawer — proposal title shows TypeScript code: `string; // display title shown in drawer header` instead of proposal name. Relay/dashboard is extracting title from interface definition in spec body instead of the `# Feature Design Spec — [Name]` heading. Fix: extract title from first `#` heading only.
- [ ] **[productivitesse]** Doc Drawer — file path is hardcoded placeholder `~/environment/proposals/foo.md` instead of actual proposal path. FileLink is using example path from spec rather than real proposal file path. Fix: pass actual proposal file path when constructing FileLink in ProposalsPanel.
- [ ] **[productivitesse]** Doc Drawer — "Read Full Spec" label is too large/prominent (renders as styled link, used as drawer title too). Fix: smaller inline link text (no special styling beyond underline + accent color), drawer title should show the proposal name not "Read Full Spec".
- [ ] **[all teams]** Implement testing & review policy — code review → build → UI test before any VIP commit (policy at ~/environment/TESTING-POLICY.md)
- [x] **[all teams]** Restructure for parallelization — ACTIVE: productivitesse running 9 worktrees with micro-teams, rules codified in TEAM-STRUCTURE.md
- [ ] **[productivitesse]** 3D agent zoom improvements — direct zoom between agents (no zoom-out), save camera position to localStorage, reset button to show all agents, responsive to agent count
- [ ] **[productivitesse]** Sub-agents visibility in 3D — design/implement how to show team-create agents (barely visible, appear on zoom, or other design)

## Questions
- Should reports be editable from Dashboard? (philosophical — are reports data or read-only?)
- Dashboard editability scope: what should be editable vs read-only?
- Proposal ownership & workflow — should managers/team leads handle proposals, or are they for CEO only? Should proposals block work?

## Done
- [x] **[productivitesse]** Panels off-screen / responsiveness — fixed in e98d0c5 (moved to DOM overlays)
- [x] **[productivitesse]** Z-index/occlusion: panels behind 3D objects — fixed in e98d0c5 (DOM overlay above canvas)
- [x] **[productivitesse]** Worklog content shows "prepared" — fixed in 311f5fe (lazy /report-content fetch)
- [x] **[productivitesse]** Invalid date timestamps — fixed in 311f5fe
- [x] **[productivitesse]** Zoom too far out — fixed in 311f5fe
- [x] **[productivitesse]** Raw markdown in reports/worklog — fixed in 311f5fe
- [x] **[productivitesse]** Dashboard editability — fixed in 311f5fe
- [x] **[productivitesse]** Message truncation — fixed in 311f5fe
- [x] **[productivitesse]** Main page raw markdown — fixed in 311f5fe
- [x] **[productivitesse]** Message order incorrect — fixed in 311f5fe
- [x] **[productivitesse]** Duplicate proposals — fixed in 311f5fe
- [x] **[productivitesse]** Message input not sending — fixed in ee20f37
- [x] **[productivitesse]** Panel positions should be saved and restored between sessions — fixed in 328ab52 (SidePanel localStorage, Playwright verified)
