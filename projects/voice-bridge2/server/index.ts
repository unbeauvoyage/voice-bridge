/**
 * voice-bridge Bun HTTP server
 *
 * Endpoints:
 *   GET  /           — mobile recording UI
 *   POST /transcribe — receives audio, transcribes via Whisper, delivers to relay
 *   GET  /health     — liveness check
 *   GET  /mic        — { state: "on"|"off" }
 *   POST /mic        — { state: "on"|"off" } → set mic state
 */

import { readFile } from "node:fs/promises";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { transcribeAudio } from "./whisper.ts";
import { deliverToAgent } from "./relay.ts";
import { deliverViaCmux, listWorkspaceNames } from "./cmux.ts";
import { llmRoute } from "./llmRouter.ts";
import { startRelayPoller } from "./relay-poller.ts";

const PORT = Number(process.env.PORT ?? 3030);
const PUBLIC_DIR = join(import.meta.dir, "../public");
const RELAY_BASE_URL = process.env.RELAY_BASE_URL ?? "http://localhost:8767";
const RELAY_TIMEOUT_MS = 30_000;
const LAST_TARGET_FILE = join(import.meta.dir, "../tmp/last-target.txt");

// Audio dedup — WKWebView retries fetches when Whisper is slow, causing duplicate relay delivery.
// We hash audio bytes on arrival and reject same hash within 30s.
type DedupEntry = { ts: number; transcript: string; to: string; message: string } | { ts: number; inProgress: true };
const recentAudioHashes = new Map<string, DedupEntry>();
const DEDUP_WINDOW_MS = 30_000;

function hashAudioBuffer(buf: Buffer): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(buf);
  return hasher.digest("hex").slice(0, 16);
}

function evictStaleHashes(): void {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  for (const [h, entry] of recentAudioHashes) {
    if (entry.ts < cutoff) recentAudioHashes.delete(h);
  }
}

// Mic control — server owns the pause file; daemon reads it every loop iteration
const MIC_PAUSE_FILE = "/tmp/wake-word-pause";

function isMicOn(): boolean {
  return !existsSync(MIC_PAUSE_FILE);
}
function setMic(on: boolean): void {
  if (on) {
    try { unlinkSync(MIC_PAUSE_FILE); } catch { /* file may not exist */ }
  } else {
    try { writeFileSync(MIC_PAUSE_FILE, ""); } catch { /* ignore write errors */ }
  }
}

// Returns true if transcript is a mic control command, and handles it.
// "turn off (the) (mac/max) mic(rophone)" → pause
// "turn on (the) (mac/max) mic(rophone)"  → resume
function handleMicCommand(transcript: string): { handled: true; state: "on" | "off" } | null {
  const t = transcript.toLowerCase().trim();
  if (/\b(turn\s+off|disable|mute|pause)\b.{0,20}\b(mic(rophone)?|listening)\b/.test(t)) {
    setMic(false);
    return { handled: true, state: "off" };
  }
  if (/\b(turn\s+on|enable|unmute|resume)\b.{0,20}\b(mic(rophone)?|listening)\b/.test(t)) {
    setMic(true);
    return { handled: true, state: "on" };
  }
  return null;
}

function loadLastTarget(): string {
  try { return readFileSync(LAST_TARGET_FILE, "utf8").trim() || "command"; } catch { return "command"; }
}
function saveLastTarget(target: string): void {
  try { writeFileSync(LAST_TARGET_FILE, target); } catch { /* ignore write errors */ }
}


// Returns all known agent/workspace names, normalized to lowercase with hyphens.
async function getKnownAgents(): Promise<string[]> {
  const names: string[] = [];
  // Relay uses /status which returns {agents: {name: {workspace}, ...}}
  try {
    const res = await fetch(`${RELAY_BASE_URL}/status`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data: unknown = await res.json();
      if (typeof data === "object" && data !== null && "agents" in data) {
        const obj: Record<string, unknown> = Object.fromEntries(Object.entries(data));
        const agents = obj["agents"];
        if (agents && typeof agents === "object") {
          names.push(...Object.keys(agents).map(a => a.toLowerCase()));
        }
      }
    }
  } catch { /* relay may be offline */ }
  // Add cmux workspace names as fallback
  try {
    const ws = listWorkspaceNames();
    names.push(...ws.map((w: string) => w.toLowerCase()));
  } catch { /* cmux may be unavailable */ }
  // Deduplicate
  return [...new Set(names)].filter(a => !a.includes('test') && !a.includes('probe'));
}

// Sticky last-used target — persisted to disk so it survives server restarts

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // ── Health ────────────────────────────────────────────────────────────────
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", ts: Date.now() });
    }

    // ── Mobile UI ─────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/") {
      try {
        const html = await readFile(join(PUBLIC_DIR, "index.html"));
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }

    // ── CORS preflight — allow dashboard (localhost:5173) to call voice-bridge ──
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ── Transcribe ────────────────────────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/transcribe") {
      const corsHeaders = { "Access-Control-Allow-Origin": "*" };
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return Response.json({ error: "Invalid form data" }, { status: 400, headers: corsHeaders });
      }

      const audioFile = formData.get("audio");
      const transcribeOnly = formData.get("transcribe_only") === "1";
      const toField = formData.get("to");
      const explicitTo = typeof toField === "string" ? toField.trim() : "";
      let to = explicitTo || loadLastTarget();

      if (!audioFile || !(audioFile instanceof File)) {
        return Response.json({ error: "Missing audio field" }, { status: 400, headers: corsHeaders });
      }

      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      const mimeType = audioFile.type || "audio/webm";
      console.log(`[voice-bridge] audio received: ${audioBuffer.length} bytes, mime: ${mimeType}`);

      // Dedup: reject if same audio bytes seen within 30s (WKWebView retry on slow Whisper)
      evictStaleHashes();
      const audioHash = hashAudioBuffer(audioBuffer);
      const existing = recentAudioHashes.get(audioHash);
      if (existing) {
        console.log(`[voice-bridge] duplicate audio detected (hash=${audioHash})`);
        if ("inProgress" in existing) {
          // First request still transcribing — wait for it to complete rather than returning empty,
          // because returning empty causes the phone to freeze in "transcribing" state (Tailscale latency triggers WKWebView retries)
          const deadline = Date.now() + 90_000;
          while (Date.now() < deadline) {
            await Bun.sleep(300);
            const updated = recentAudioHashes.get(audioHash);
            if (!updated || !("inProgress" in updated)) {
              if (updated) {
                console.log(`[voice-bridge] duplicate resolved after wait, returning cached transcript`);
                return Response.json({ transcript: updated.transcript, to: updated.to, deduplicated: true }, { headers: corsHeaders });
              }
              break;
            }
          }
          return Response.json({ transcript: "", deduplicated: true }, { headers: corsHeaders });
        }
        // First request already completed — return cached result, skip relay
        return Response.json({ transcript: existing.transcript, to: existing.to, deduplicated: true }, { headers: corsHeaders });
      }
      recentAudioHashes.set(audioHash, { ts: Date.now(), inProgress: true });

      let transcript: string;
      try {
        transcript = await transcribeAudio(audioBuffer, mimeType);
      } catch (err) {
        console.error("[whisper] transcription failed:", err);
        return Response.json({ error: "Transcription failed: " + String(err) }, { status: 500, headers: corsHeaders });
      }

      if (!transcript) {
        return Response.json({ error: "Empty transcription — no speech detected" }, { status: 422, headers: corsHeaders });
      }

      // Cancel detection: if last 10 words contain >1 "cancel", discard
      const lastTenWords = transcript.trim().split(/\s+/).slice(-10);
      const cancelCount = lastTenWords.filter(w => /^cancel$/i.test(w.replace(/[^a-zA-Z]/g, ''))).length;
      if (cancelCount > 1) {
        console.log(`[voice-bridge] cancelled (${cancelCount}x "cancel" in last 10 words) — discarding: "${transcript}"`);
        return Response.json({ transcript, cancelled: true }, { headers: corsHeaders });
      }

      // Test mode: if transcript starts with "test" skip relay entirely
      const isTest = /^test\b/i.test(transcript);
      if (isTest) {
        console.log(`[voice-bridge] test mode — skipping relay: ${transcript}`);
        return Response.json({ transcript, test: true }, { headers: corsHeaders });
      }

      // Mic control commands — handled before routing, from any source (phone or Mac)
      const micCmd = handleMicCommand(transcript);
      if (micCmd) {
        console.log(`[mic] ${micCmd.state === "off" ? "PAUSED" : "RESUMED"} via voice command: "${transcript}"`);
        return Response.json({ transcript, mic: micCmd.state, command: true }, { headers: corsHeaders });
      }

      // Routing logic (three cases, in priority order):
      //
      // 1. Explicit `to` + no "please" in first 7 words → use explicit `to`, full transcript, skip llmRoute.
      // 2. "please" found in first 7 words (even if explicit `to` is set) → llmRoute OVERRIDES.
      //      routingPart = text BEFORE "please" → passed to llmRoute to detect agent
      //      messagePart = text AFTER "please" (trimmed) → the actual message body to deliver
      //    llmRoute returns an agent → deliver messagePart to that agent.
      //    llmRoute fails/returns nothing → fall back to explicit `to`, or "command" if no explicit `to`.
      // 3. No "please" in first 7 words, no explicit `to` → deliver full transcript to "command".
      let message: string;

      // Detect "please" only within the first 7 words (case-insensitive).
      // We match the word boundary for "please" and check its position.
      const words = transcript.trimStart().split(/\s+/);
      const pleaseIndex = words.slice(0, 7).findIndex(w => /^please$/i.test(w));
      const pleaseInFirst7 = pleaseIndex !== -1;

      if (pleaseInFirst7) {
        // Case 2: "please" in first 7 words — llmRoute OVERRIDES explicit `to`.
        // Pass everything up to and including "please" to llmRoute so it can detect the agent.
        const routingPart = words.slice(0, pleaseIndex + 1).join(" "); // words up to and including "please"
        const messagePart = words.slice(pleaseIndex + 1).join(" ").trim(); // words after "please"
        console.log(`[route] please-gate (word ${pleaseIndex + 1}): routingPart="${routingPart}", messagePart="${messagePart}"`);
        const llmResult = await llmRoute(routingPart, await getKnownAgents(), "");
        const fallback = explicitTo || "command";
        to = llmResult.agent || fallback;
        message = messagePart || transcript; // fallback to full transcript if nothing after "please"
        if (llmResult.agentChanged) {
          saveLastTarget(to);
        }
        console.log(`[route] → ${to} (please-gate, changed=${llmResult.agentChanged}): "${message}"`);
      } else if (explicitTo) {
        // Case 1: Explicit UI selection, no "please" in first 7 words — honour it, full transcript.
        to = explicitTo;
        message = transcript;
        saveLastTarget(to);
        console.log(`[route] → ${to} (explicit, sticky updated): "${message}"`);
      } else {
        // Case 3: No "please" in first 7 words, no explicit `to` — deliver full transcript to "command".
        to = "command";
        message = transcript;
        console.log(`[route] → ${to} (no-please, direct): "${message}"`);
      }

      // Upgrade hash entry from in-progress → resolved so retries get cached transcript
      recentAudioHashes.set(audioHash, { ts: Date.now(), transcript, to, message });

      // transcribe_only: app will send the message itself after user confirms
      if (transcribeOnly) {
        console.log(`[voice-bridge] transcribe_only — skipping relay delivery, target="${to}"`);
        return Response.json({ transcript, to }, { headers: corsHeaders });
      }

      try {
        await deliverToAgent(message, to);
        console.log(`[relay] → ${to}: ${message}`);
      } catch {
        // Relay not running — fall back to direct cmux injection
        try {
          deliverViaCmux(message, to);
          console.log(`[cmux] → ${to}: ${message}`);
        } catch (cmuxErr) {
          console.warn("[cmux] delivery failed:", cmuxErr);
        }
      }

      return Response.json({ transcript, to, message }, { headers: corsHeaders });
    }

    // ── Messages proxy ────────────────────────────────────────────────────────
    // GET /messages?agent=command — proxies relay GET /messages/:agent
    if (req.method === "GET" && url.pathname === "/messages") {
      const agent = url.searchParams.get("agent") || "command";
      const headers = { "Access-Control-Allow-Origin": "*" };
      try {
        const relayRes = await fetch(`${RELAY_BASE_URL}/messages/${encodeURIComponent(agent)}`, {
          signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
        });

        if (!relayRes.ok) {
          const detail = await relayRes.text().catch(() => "");
          return Response.json(
            {
              error: "Relay unavailable",
              agent,
              relayStatus: relayRes.status,
              detail: detail.slice(0, 200),
            },
            {
              status: 502,
              headers,
            },
          );
        }

        const data = await relayRes.json();
        return Response.json(data, { headers });
      } catch (err) {
        console.warn("[relay] messages fetch failed:", err);
        return Response.json(
          {
            error: "Relay unavailable",
            agent,
            detail: String(err),
          },
          {
            status: 502,
            headers,
          },
        );
      }
    }

    // ── Mic control ──────────────────────────────────────────────────────────
    // GET  /mic         — { state: "on"|"off" }
    // POST /mic         — { state: "on"|"off" } → toggle
    if (url.pathname === "/mic") {
      const headers = { "Access-Control-Allow-Origin": "*" };
      if (req.method === "GET") {
        return Response.json({ state: isMicOn() ? "on" : "off" }, { headers });
      }
      if (req.method === "POST") {
        let body: { state?: string } = {};
        try { body = await req.json(); } catch { /* malformed body — default to empty */ }
        const on = body.state === "on";
        setMic(on);
        console.log(`[mic] ${on ? "RESUMED" : "PAUSED"} via API`);
        return Response.json({ state: on ? "on" : "off" }, { headers });
      }
    }

    // ── Agents list ───────────────────────────────────────────────────────────
    // GET /agents?source=relay|workspaces — list available agents/workspaces
    if (req.method === "GET" && url.pathname === "/agents") {
      const headers = { "Access-Control-Allow-Origin": "*" };
      const source = url.searchParams.get("source") ?? "auto";

      if (source !== "workspaces") {
        // Try relay
        try {
          const relayRes = await fetch(`${RELAY_BASE_URL}/agents`, {
            signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
          });
          if (relayRes.ok) {
            const data = await relayRes.json();
            return Response.json(data, { headers });
          }
        } catch {
          if (source === "relay") {
            return Response.json({ agents: [], error: "Relay unavailable" }, { headers });
          }
          // auto mode: fall through to cmux
        }
      }

      // workspaces or auto fallback
      const agents = listWorkspaceNames();
      return Response.json({ agents }, { headers });
    }

    // ── Status ───────────────────────────────────────────────────────────────
    // GET /status — returns { target, micState }
    if (req.method === "GET" && url.pathname === "/status") {
      const headers = { "Access-Control-Allow-Origin": "*" };
      return Response.json({ target: loadLastTarget(), micState: isMicOn() ? "on" : "off" }, { headers });
    }

    // ── Target control ────────────────────────────────────────────────────────
    // POST /target — { target: string } → saves new target
    if (req.method === "POST" && url.pathname === "/target") {
      const headers = { "Access-Control-Allow-Origin": "*" };
      let body: { target?: string } = {};
      try { body = await req.json(); } catch { /* malformed body — default to empty */ }
      const target = (body.target ?? "").trim();
      if (!target) {
        return Response.json({ error: "Missing target" }, { status: 400, headers });
      }
      saveLastTarget(target);
      console.log(`[target] updated to "${target}"`);
      return Response.json({ target }, { headers });
    }

    // ── Settings ─────────────────────────────────────────────────────────────
    // GET  /settings — read daemon/settings.json
    // POST /settings — write daemon/settings.json (partial or full update)
    if (url.pathname === "/settings") {
      const headers = { "Access-Control-Allow-Origin": "*" };
      const settingsPath = join(import.meta.dir, "../daemon/settings.json");

      if (req.method === "GET") {
        try {
          const raw = readFileSync(settingsPath, "utf8");
          return new Response(raw, { headers: { ...headers, "Content-Type": "application/json" } });
        } catch {
          return Response.json({ error: "settings.json not found" }, { status: 404, headers });
        }
      }

      if (req.method === "POST") {
        let incoming: Record<string, unknown> = {};
        try { incoming = await req.json(); } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
        }
        let current: Record<string, unknown> = {};
        try { current = JSON.parse(readFileSync(settingsPath, "utf8")); } catch { /* file may not exist yet */ }
        const merged = { ...current, ...incoming };
        try {
          writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
        } catch (err) {
          return Response.json({ error: "Failed to write settings: " + String(err) }, { status: 500, headers });
        }
        console.log(`[settings] updated: ${JSON.stringify(incoming)}`);
        return Response.json(merged, { headers });
      }
    }

    // ── Wake word process control ─────────────────────────────────────────────
    // POST /wake-word/stop  — kill the wake_word.py process (closes mic, dot disappears)
    // POST /wake-word/start — restart it
    // GET  /wake-word       — { running: bool }
    if (url.pathname === "/wake-word" || url.pathname.startsWith("/wake-word/")) {
      const headers = { "Access-Control-Allow-Origin": "*" };
      const daemonDir = join(import.meta.dir, "../daemon");

      function findWakeWordPid(): number | null {
        const result = spawnSync("pgrep", ["-f", "wake_word.py"], { encoding: "utf8" });
        const pid = parseInt(result.stdout.trim().split("\n")[0] ?? "", 10);
        return isNaN(pid) ? null : pid;
      }

      if (req.method === "GET" && url.pathname === "/wake-word") {
        return Response.json({ running: findWakeWordPid() !== null }, { headers });
      }

      if (req.method === "POST" && url.pathname === "/wake-word/stop") {
        const pid = findWakeWordPid();
        if (pid) {
          spawnSync("kill", [String(pid)]);
          console.log(`[wake-word] stopped (PID ${pid})`);
        }
        return Response.json({ running: false }, { headers });
      }

      if (req.method === "POST" && url.pathname === "/wake-word/start") {
        const existing = findWakeWordPid();
        if (!existing) {
          // Replicate run_daemon.sh: use Python.app (has mic entitlements) with venv PYTHONPATH
          const pythonApp = "/opt/homebrew/Cellar/python@3.14/3.14.0/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python";
          const script = join(daemonDir, "wake_word.py");
          const venvPackages = join(daemonDir, ".venv/lib/python3.14/site-packages");
          const child = spawn(pythonApp, ["-u", script, "--target", "jarvis"], {
            cwd: join(daemonDir, ".."),
            detached: true,
            stdio: "ignore",
            env: { ...process.env, PYTHONPATH: venvPackages },
          });
          child.unref();
          console.log(`[wake-word] started (PID ${child.pid})`);
        }
        return Response.json({ running: true }, { headers });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`voice-bridge server running at http://localhost:${server.port}`);
console.log(`Mobile UI (HTTPS required): use mkcert for non-localhost access`);

// Start relay response poller — agent replies appear as overlay message toasts
const OVERLAY_URL = process.env.OVERLAY_URL ?? "http://localhost:47890/overlay";
const SETTINGS_PATH = join(import.meta.dir, "../daemon/settings.json");
startRelayPoller({
  relayBaseUrl: RELAY_BASE_URL,
  overlayUrl: OVERLAY_URL,
  settingsPath: SETTINGS_PATH,
});
console.log(`[relay-poller] polling ${RELAY_BASE_URL}/queue/ceo every 3s → overlay at ${OVERLAY_URL}`);
