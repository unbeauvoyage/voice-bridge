# Testing Frameworks Report
**Date:** 2026-04-03
**Asked by:** CEO
**Answered by:** Research agent
**Status:** answered

---

## 1. Playwright vs NutJS

### What They Are

**Playwright** is a browser automation framework maintained by Microsoft. It drives real browsers (Chromium, Firefox, WebKit/Safari) over the Chrome DevTools Protocol (CDP) and the equivalent protocols for Firefox and WebKit. Primary use cases: end-to-end web testing, visual regression, API testing.

**NutJS (nut.js)** is a native desktop automation library for Node.js. It controls the OS itself — mouse, keyboard, screen capture — using platform-native bindings. It does not know anything about web browsers or DOM elements. It just sees pixels and OS-level UI.

### What Each Can Test

| Capability | Playwright | NutJS |
|---|---|---|
| Web apps (Chrome, Firefox, Safari) | Yes, fully | No |
| DOM element interaction | Yes (CSS selectors, roles, text) | No |
| Electron apps | Yes (experimental, via CDP) | Yes (via OS/screen) |
| Native macOS/Windows apps | No | Yes |
| Right-click in desktop apps | Unreliable | Reliable |
| Image matching / pixel search | No | Yes (with @nut-tree/nl-matcher) |
| Accessibility API (macOS/Windows) | No | Yes (@nut-tree/element-inspector) |
| Browser network interception | Yes | No |
| API testing (HTTP) | Yes | No |

### Approach Differences

- **Playwright** uses a structured protocol to interact with DOM elements. It knows what a button is, can wait for it to be enabled, visible, and stable before clicking. Tests are deterministic and readable.
- **NutJS** uses image matching and OS accessibility APIs to find things on screen. It is closer to a robot controlling a mouse — powerful for things outside the browser, brittle if the UI layout changes.

### How They Work Together

The combination is common for Electron app testing: Playwright handles all the React/DOM UI interaction inside the app window, while NutJS handles OS-level actions Playwright can't do (right-click context menus, system dialogs, screenshot comparison at the OS level, drag-and-drop to the Finder/Explorer, etc.).

**Key limitation of NutJS on macOS**: requires explicit Accessibility and Screen Recording permissions granted to the terminal or Node process. Tests cannot run in a sandboxed CI environment without pre-authorizing them.

---

## 2. Playwright + Electron

### Yes, Playwright Can Test Electron Apps

Electron is Chromium-based and exposes CDP. Playwright's `_electron` API connects directly. This is marked "experimental" in the docs but is widely used and well-supported in practice.

### How to Connect

**Method 1: Launch the app from the test**
```typescript
import { _electron as electron } from '@playwright/test';

const electronApp = await electron.launch({ args: ['.'] });
const window = await electronApp.firstWindow();
// Now `window` is a regular Playwright Page
await window.click('button#submit');
```

**Method 2: Connect to a running instance**
Start your Electron app with remote debugging enabled:
```bash
electron your-app --remote-debugging-port=9222
```
Then connect Playwright to `http://localhost:9222`.

### What You Can Do

Everything you can do with a normal Playwright Page works inside the Electron window:
- Click, fill, select, hover
- `evaluate()` to run JavaScript in the renderer process
- `waitForSelector()`, `waitForLoadState()`
- Network interception
- Screenshot and visual diffing
- Multi-window (`electronApp.windows()`)
- IPC bridge testing (you can call main-process APIs via `evaluate()`)

### Limitations vs Regular Browser Testing

1. **No cross-browser** — Electron is always Chromium; you cannot test Firefox/Safari behavior
2. **workers: 1 required** — desktop automation requires sequential execution; parallel test runs against the same Electron window will conflict
3. **Native menus and system dialogs** — OS-native dropdowns (not HTML `<select>`), context menus invoked by right-click, and system file pickers are outside CDP reach. NutJS fills this gap.
4. **App must be buildable** — Playwright needs the Electron entry point (usually `main.js`); for production builds, you point it at the binary
5. **No headless mode** — unlike browser tests, Electron opens a real window. CI requires a virtual display (Xcode Server, `xvfb` on Linux, or GitHub Actions `runs-on: macos-latest`)

### References

- [Playwright Electron API docs](https://playwright.dev/docs/api/class-electron)
- [Simon Willison's TIL: Testing Electron with Playwright + GitHub Actions](https://til.simonwillison.net/electron/testing-electron-playwright)
- [Monokle blog: Testing Electron Apps with Playwright](https://monokle.io/blog/testing-electron-apps-with-playwright)

---

## 3. NutJS and Native Application Testing

### What NutJS Can Control

NutJS controls any application visible on the screen across macOS, Windows, and Linux. It does not need special support from the app — it interacts at the OS level via two mechanisms:

**1. Image matching** — Find a UI element by its screenshot (a button image, an icon). This works on any app but is fragile: if the UI resizes, changes theme, or gets a system update, the image match breaks.

**2. Accessibility API** (`@nut-tree/element-inspector`) — Queries macOS Accessibility API (AX framework), Windows UI Automation, or Linux AT-SPI. This gives you structured access to element labels, roles, and positions — far more reliable than pixel matching.

### Platform Support Matrix

| Platform | Mouse/Keyboard | Image Matching | Accessibility API |
|---|---|---|---|
| macOS | Yes | Yes | Yes (needs AX permission) |
| Windows | Yes | Yes | Yes (UI Automation) |
| Linux | Yes (requires X11) | Yes | Yes (AT-SPI) |
| Linux headless | Needs Xvfb | Needs Xvfb | Limited |

### Realistic Coverage Assessment

- **High coverage**: Any app that exposes accessibility labels (most macOS/Windows native apps, Electron apps)
- **Medium coverage**: Apps with poor accessibility support — you fall back to image matching, which is brittle
- **Low/no coverage**: Sandboxed apps that block AX API, apps that render purely via GPU/Metal (games, some video tools)
- **Practical ceiling**: NutJS is good for workflow automation and UI smoke tests. Full regression coverage of a complex native app is difficult because test maintenance is high when the UI changes.

---

## 4. Testing iPhone Connected to Mac

### Short Answer: Neither Playwright nor NutJS Directly

Neither tool has a native bridge to control a physical iPhone. They are Mac-side tools; iOS has its own sandboxed runtime.

### What Actually Works: Appium + WebDriverAgent

The standard approach for testing a real iPhone connected to a Mac is:

1. **WebDriverAgent (WDA)** — installed on the iPhone by Appium via Xcode. WDA acts as a REST server running on the device, proxying test commands to Apple's XCTest/XCUITest framework.
2. **Appium (appium-xcuitest-driver)** — runs on your Mac, talks to WDA on the device over USB (via `iproxy`/`tidevice`), receives test commands from your test script, and forwards them to the device.
3. **Your test script** — uses Appium's WebDriver API (JavaScript/Python/etc.) to issue commands like tap, swipe, get element by accessibility ID.

### Setup Requirements

- Xcode installed and up to date
- Apple Developer account (free is enough for sideloading WDA for testing)
- Device trusted on Mac
- Bundle ID signing via `xcodeOrgId` + `xcodeSigningId` in Appium capabilities
- WDA pre-built and installed on device (optional but faster)

### What You Can Test via Appium on a Real iPhone

| Capability | Available |
|---|---|
| Tap, swipe, scroll | Yes |
| Native UI element interaction (XCUITest) | Yes |
| WebView content in hybrid apps | Yes (context switch to WEBVIEW) |
| Safari web testing | Yes (via Appium) |
| Camera, microphone, GPS simulation | Partial |
| System-level UI (Control Center, Settings) | No |

### Can Playwright Run on a Physical iPhone?

Not directly from your Mac. However, cloud platforms (BrowserStack, LambdaTest) offer Playwright-on-real-iOS-device as a service — your Playwright scripts connect to their infrastructure, which runs Safari on a real iPhone in their lab. This works for web/WebView testing but requires a cloud account.

---

## 5. Installing and Testing on iPhone

### Real Device Testing

**What's possible today:**

| Method | What It Does | Difficulty |
|---|---|---|
| Xcode (GUI) | Build + install + run on connected device | Low |
| `xcodebuild` CLI | Build and install via terminal | Medium |
| `xcrun simctl` | Manage simulators (not real devices) | Low |
| `ios-deploy` | Install `.ipa` on real device via USB | Medium (deprecated/fragile in iOS 17+) |
| Appium + XCUITest | Full E2E test automation on real device | High (initial setup) |
| `xcodebuild test` | Run XCTest suite on real device | Medium |

**`ios-deploy`** — historically used to deploy apps to real devices from the command line without Xcode GUI, but has become increasingly fragile with iOS 17+ and the removal of some lockdown APIs. Not recommended for new setups. Use `xcodebuild` or `xcrun devicectl` (new in Xcode 15).

**`xcrun devicectl`** (new in Xcode 15+) — the current recommended CLI for device management on real hardware. Replaces many `ios-deploy` use cases.

### Simulator Testing

Simulators are controlled fully via `xcrun simctl` and are much easier to automate:

```bash
xcrun simctl list devices           # list simulators
xcrun simctl boot "iPhone 15"       # boot a simulator
xcrun simctl install booted app.app # install an app
xcrun simctl launch booted com.bundleid  # launch it
```

Playwright cannot run inside a simulator, but Appium/XCUITest can. Capacitor apps can be built for simulator and tested with Appium.

### Android

Android testing is significantly easier:

- `adb install app.apk` — install to real device or emulator
- Android emulator runs headlessly and is scriptable
- Appium + UIAutomator2 driver — full automation on real devices and emulators
- No code signing complexity

### What's Actually Possible Today for a Capacitor iOS App

| Test Type | Tool | Realistic? |
|---|---|---|
| UI E2E on simulator | Appium + XCUITest | Yes |
| UI E2E on real device | Appium + XCUITest + WDA | Yes (complex setup) |
| WebView content testing | Appium context switch to WEBVIEW | Yes |
| Pure web logic (no native) | Playwright in browser | Yes (test web layer independently) |
| Push notifications | Simulator only, limited | Partial |
| In-app purchase, biometrics | Not automatable | No |

---

## 6. Testing Power Assessment

### Stack: Electron (React/TS) + Capacitor iOS + Bun backend

#### What Can Be Automated Today

**Electron desktop app:**
- Full E2E UI testing with Playwright (`_electron` API) — covers all React UI flows
- NutJS for OS-level interactions (right-click menus, file system drag/drop, system dialogs)
- Unit tests for business logic with Vitest or Bun test runner
- API integration tests against the Bun backend
- Visual regression with Playwright screenshots or Percy integration
- Estimated automatable coverage: **70-85%** of user flows

**Bun backend:**
- Unit tests with `bun:test` (Jest-compatible, built-in, fast)
- HTTP API integration tests with Playwright's `request` API or `supertest`-style with `bun:test`
- No special tooling needed — Bun's test runner is production-ready
- Estimated automatable coverage: **85-95%** of backend logic

**Capacitor iOS app:**
- Web layer (all React/TypeScript logic) testable with Playwright in a browser — same code, no device needed
- Device/simulator E2E with Appium + XCUITest (significant setup cost)
- Native plugin interactions (camera, filesystem) harder to automate
- Estimated automatable coverage: **40-60%** (higher if you test the web layer separately)

#### What Stays Manual

| Test Type | Why Manual |
|---|---|
| iOS native purchase / StoreKit | Apple explicitly blocks automation |
| iOS biometrics (Face ID/Touch ID) | Simulator has a workaround; real device cannot be automated |
| Bluetooth/hardware integration | OS-level permissions block it |
| First-launch OS permission dialogs | Partially automatable; timing is unreliable |
| Real-world network conditions | Manual throttling or proxy needed |
| Cross-device UX feel (haptics, scroll physics) | Subjective; no tool measures it |
| App Store submission review | Fully manual |

---

## 7. Testing Maturity Roadmap

### Current State

- Playwright for web UI tests (13 tests passing)
- Coverage: Electron UI, possibly web baseline

### Recommended Next Steps (prioritized by ROI)

#### Phase 1 — Fast wins, low setup cost

**1. Bun unit tests for backend** — highest coverage per hour of effort. Use `bun:test` (zero config). Test route handlers, business logic, data transformations. Target: 80% coverage of critical paths within a sprint.

**2. Vitest unit tests for shared React/TS logic** — anything that is not UI: hooks, state management, utility functions, data models. Runs in Node, no browser needed, very fast. Decoupled from Playwright's slower E2E tests.

**3. Playwright API tests** — use Playwright's `request` context to write integration tests against the Bun server. No browser launched, very fast. Catches API contract regressions.

#### Phase 2 — Electron coverage expansion

**4. Expand Playwright Electron E2E** — map your 13 existing tests to the most critical user journeys. Add tests for: auth flow, core feature flows, error states. Set `workers: 1` and use `_electron.launch`.

**5. NutJS for OS-level gaps** — add NutJS only for actions Playwright can't reach: right-click context menus, system file picker, drag-and-drop to OS. Keep NutJS usage minimal — it is the most brittle part of the stack.

**6. Playwright visual regression** — add `expect(page).toHaveScreenshot()` for key screens. Baseline screenshots committed to git. Catches unintended CSS/layout regressions. Percy (free tier available) adds a review UI for CI diffs.

#### Phase 3 — iOS coverage

**7. Test Capacitor web layer with Playwright** — before touching Appium, extract and test all business logic and UI in a browser context. Capacitor apps are just web apps; Playwright can test them at `localhost` without a device. High ROI.

**8. Appium + XCUITest for iOS device/simulator** — set up the Appium stack for smoke tests on the iOS simulator. Test: app launch, core navigation, WebView content. Real-device testing is reserved for pre-release validation only (cost and fragility do not justify CI use).

#### Phase 4 — Infrastructure

**9. CI pipeline** — GitHub Actions with `macos-latest` runner for Electron + Appium tests. Headless Linux runner for backend + web tests. Separate fast/slow test jobs.

**10. Performance testing** — Playwright has `page.metrics()` and `performance.timing` hooks. Add timing assertions on key operations (app load, page transitions). Bun's test runner supports benchmarks natively.

### Summary Table

| Phase | Tool | Tests | Priority |
|---|---|---|---|
| 1 | `bun:test` | Backend unit | Immediate |
| 1 | Vitest | React/TS unit | Immediate |
| 1 | Playwright request | API integration | Immediate |
| 2 | Playwright `_electron` | Electron E2E | Next sprint |
| 2 | NutJS | OS-level actions | Next sprint |
| 2 | Playwright screenshots | Visual regression | Next sprint |
| 3 | Playwright (browser) | Capacitor web layer | After Electron stable |
| 3 | Appium + XCUITest | iOS smoke tests | After web layer stable |
| 4 | GitHub Actions | CI pipeline | Ongoing |

---

## Recommendation

**Maximum coverage with minimum effort — invest in this order:**

1. **Bun test runner + Vitest** for units — zero configuration, extremely fast, no infrastructure
2. **Playwright Electron (`_electron` API)** — you already have 13 Playwright tests; extending them to cover Electron flows is low incremental cost
3. **Test Capacitor as a web app first** — avoid Appium complexity until the web layer is fully covered. Capacitor apps run in a browser; Playwright already covers that
4. **Appium only when needed for device-specific behavior** — set it up on simulator first, only move to real device for pre-release gates

Do not invest in NutJS until you have exhausted what Playwright's `_electron` API can do. NutJS tests are more brittle and harder to maintain.

---

## Sources

- [Playwright official docs](https://playwright.dev/)
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
- [NutJS official site](https://nutjs.dev/)
- [NutJS GitHub](https://github.com/nut-tree/nut.js/)
- [NutJS Electron testing example](https://nutjs.dev/examples/electron-testing)
- [Desktop App Automation Using Playwright & NutJS — Neova Tech](https://www.neovasolutions.com/2024/04/04/desktop-app-automation-using-playwright-nut-js/)
- [Testing Electron Apps with Playwright — Monokle](https://monokle.io/blog/testing-electron-apps-with-playwright)
- [Testing Electron with Playwright + GitHub Actions — Simon Willison](https://til.simonwillison.net/electron/testing-electron-playwright)
- [Appium XCUITest real device setup](https://appium.readthedocs.io/en/latest/en/drivers/ios-xcuitest-real-devices/)
- [Appium iOS Testing: Simulator vs Real Devices — BrowserStack](https://www.browserstack.com/guide/appium-ios-simulator-vs-real-device-testing)
- [Playwright iOS on Real Devices — BrowserStack](https://www.browserstack.com/guide/playwright-ios-automation)
- [Automating Hybrid Apps — Appium](https://appium.github.io/appium.io/docs/en/writing-running-appium/web/hybrid/)
- [Bun test runner docs](https://bun.com/docs/test/writing-tests)
- [Visual regression with Playwright — BrowserStack](https://www.browserstack.com/guide/visual-regression-testing-using-playwright)
- [Percy visual testing](https://percy.io/)
