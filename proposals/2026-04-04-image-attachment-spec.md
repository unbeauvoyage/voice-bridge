---
title: "Image Attachment in Dashboard Input + Voice Recording"
proposedBy: ux-lead
agent: productivitesse
status: pending
ts: 2026-04-04T07:17:34
---

# Image Attachment in Dashboard Input + Voice Recording

**Submitted:** 2026-04-04T07:17:34  
**Scope:** Two surfaces — text input (`MessageInputRow`/`ComposeBar`) and voice recording (`VoicePage`)  
**Touches:** relay server (new endpoint), `MessageInputRow`, `VoicePage`, `QuickReplyBar`, agent convention

---

## Why This Matters

The CEO often spots a bug, error screen, or UI state on their phone. Today they describe it in words. With image attachment, they paste a screenshot and the description becomes instant and unambiguous. Claude agents already support vision natively — the only missing piece is the pipeline to get the image from CEO's device to the agent's Claude call.

---

## Architecture Decision: Upload to Relay Server

Three options were evaluated:

| Option | Pros | Cons |
|--------|------|------|
| Base64 in message body | No server changes | Screenshots are 500KB–3MB. As base64: 700KB–4MB of text in one message. Bloats relay storage, breaks localStorage history, unreadable by humans. |
| Save to filesystem path | Simple on desktop | Doesn't work on mobile. Requires agent and relay on same machine with shared path. |
| **Upload to relay server → serve as URL** | Works on mobile + desktop. Message stays small. Agents pass URL directly to Claude vision. | Requires 2 new relay endpoints. Files need cleanup TTL. |

**Decision: Upload to relay server.**

The relay already serves HTTP. Adding file upload and static serving is minimal. The URL-based approach is also more robust — agents can download and re-encode as base64 if their Claude integration requires it, but they're not forced to.

---

## Relay Server Changes (system-lead territory — flagged for coordination)

Three additions to the relay server:

### 1. `POST /attachments`
Accepts `multipart/form-data` with a single `file` field.  
Saves to `./attachments/` directory (or `/tmp/relay-attachments/`).  
Returns:
```json
{
  "id": "abc123",
  "url": "http://localhost:8765/attachments/abc123.png",
  "expires_at": "2026-04-05T07:17:34Z"
}
```
Max file size: 10MB. Accepted types: `image/*`. Reject non-images with 415.

### 2. `GET /attachments/:id`
Serves the file with correct Content-Type header.  
Returns 404 after expiry.

### 3. Cleanup task
On server startup and every hour: delete files older than 24 hours from `./attachments/`.

> **Note for system-lead:** This is a new relay endpoint. Needs coordination to ensure mobile (Capacitor) can reach it — same port/host as the relay. The `getRelayUrl()` call in `VoicePage` can derive the attachments URL using the same base URL. No new origin required.

---

## Message Format — `[ATTACHMENT: url]` Convention

The relay message `body` field remains plain text (backward compatible). Image references are appended as:

```
[CEO message text here]

[ATTACHMENT: http://localhost:8765/attachments/abc123.png]
```

Multiple attachments:
```
Here's two screenshots:

[ATTACHMENT: http://localhost:8765/attachments/img1.png]
[ATTACHMENT: http://localhost:8765/attachments/img2.png]
```

Agents that understand vision: extract URLs via regex `/\[ATTACHMENT:\s*(https?:\/\/[^\]]+)\]/g`, download or pass URL to Claude's vision API.  
Agents that don't: message body is still readable — the URL is present but harmless.

**Agent update required:** Each agent that handles CEO messages should be updated to check for `[ATTACHMENT: ...]` lines and pass them to Claude as vision content. This is an agent instruction update, not a code change.

---

## Desktop UX — `MessageInputRow` Changes

The `MessageInputRow` component (`src/features/dashboard/components/MessageInputRow.tsx`) gets:

### New button: Attach (📎)
Added between mic and send in the `btnRow`.  
Same 32×32px button dimensions as mic/send.  
Hidden `<input type="file" accept="image/*" multiple>` triggered on click.

### Paste (Cmd+V) detection
`onPaste` on the `<textarea>`:
```ts
function handlePaste(e: React.ClipboardEvent) {
  for (const item of Array.from(e.clipboardData.items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) addAttachment(file);
    }
  }
}
```

### Drag-and-drop
`onDrop` on the root `<div>`:
```ts
function handleDrop(e: React.DragEvent) {
  e.preventDefault();
  for (const file of Array.from(e.dataTransfer.files)) {
    if (file.type.startsWith('image/')) addAttachment(file);
  }
}
```

Visual feedback: root div gets a dashed border highlight on `onDragOver`.

### Attachment strip (thumbnail row)
Appears between textarea and btnRow when attachments are pending:

```
┌─────────────────────────────────────┐
│  [textarea text content...        ] │
└─────────────────────────────────────┘
┌──────────┐ ┌──────────┐             
│ [img]  ✕ │ │ [img]  ✕ │  ← strip   
└──────────┘ └──────────┘             
                          [ 📎 ][ 🎤 ][ ↑ ]
```

Each thumbnail: 48×48px, `object-fit: cover`, border-radius 4px, with a ✕ button to remove.  
While uploading: thumbnail shows a spinner overlay (`opacity: 0.5` + spinning ring).  
Upload failure: thumbnail gets a red border and "!" overlay. Does not block send — CEO can retry or remove.

### Props change to `MessageInputRow`

```ts
interface MessageInputRowProps {
  // existing ...
  attachments?: AttachmentState[];          // pending attachments
  onAttachmentsChange?: (a: AttachmentState[]) => void;  // parent manages state
}
```

Or: attachment state is internal to `MessageInputRow` (simpler for most call sites).  
Recommend: internal state with `onSend` receiving the final attachment URL list.

```ts
interface AttachmentState {
  localId: string;          // client-side ID for key/removal
  file: File;
  status: 'uploading' | 'ready' | 'error';
  url?: string;             // set when status === 'ready'
  previewUrl: string;       // object URL for thumbnail display
}
```

### Send behavior with attachments

When `onSend` is called:
1. Wait for all in-flight uploads to complete (disable send button while any are `uploading`)
2. Append `[ATTACHMENT: url]` lines to message body for each `ready` attachment
3. Send message as normal
4. Revoke object URLs, clear attachment state

If any attachment is in `error` state: warn via subtle red indicator on send button, but allow send without that attachment. CEO can decide.

---

## Mobile UX — `VoicePage` Changes

The `VoicePage` (`src/features/mobile/VoicePage.tsx`) is the primary CEO interface on phone.

### Image attach for text messages
The manual text input row already exists. Add a camera/attach icon button next to the send button:

```
[  Type a message…          ] [ 📎 ] [ ↑ ]
```

Tapping 📎 → `<input type="file" accept="image/*">` file picker.  
On iOS this presents the standard share sheet: Camera, Photo Library, Files.

After attachment selected: small thumbnail appears above the text row:

```
┌──────────────────────────┐
│ [48×48 thumbnail]  ✕     │
└──────────────────────────┘
[  Type a message…         ] [ 📎 ] [ ↑ ]
```

Send: text + attachment URL sent together.

### Image attach for voice messages
Below the agent selector and above the big record button, add an image attach row:

```
┌─────────────────────────┐
│  [thumbnail 80×80]  ✕   │   ← shown when image is attached
└─────────────────────────┘
       [ Tap to record ]
```

When no image: the row is hidden (no empty space).  
A small camera icon lives in the controls section (near the status text) as the entry point:

```
Sent to "command" ✓     📷
```

Tapping 📷 opens the file picker. After attachment: thumbnail appears above record button.

### Voice + image send flow

1. CEO attaches image (optional)
2. CEO taps big record button → records voice
3. Releases button → transcription runs (`/transcribe`)
4. If image was attached: `POST /attachments` runs simultaneously with transcription (or sequentially if bandwidth is a concern)
5. Final message: `${transcript}\n\n[ATTACHMENT: ${url}]`
6. Message sent to relay via existing `postVoice` / `sendText` path

The `transcribeAndSend` function in `VoicePage.tsx` needs an `attachmentUrl?: string` parameter. The voice-bridge `/transcribe` endpoint could accept an `attachment_url` form field, or the dashboard can handle the message composition itself and call both APIs in sequence.

**Recommendation:** Handle in dashboard (`VoicePage.tsx`). Upload attachment → get URL → transcribe audio → compose body with URL → send. Keeps voice-bridge simple.

### Mobile clipboard paste (bonus)
iOS 16.1+ supports `navigator.clipboard.read()` in secure contexts. The attach button handler can first check clipboard for an image:

```ts
async function handleAttachClick() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.some(t => t.startsWith('image/'))) {
        const blob = await item.getType(item.types.find(t => t.startsWith('image/'))!);
        addAttachment(new File([blob], 'clipboard.png', { type: blob.type }));
        return;  // prefer clipboard over file picker if image found
      }
    }
  } catch { /* clipboard API not available or denied */ }
  // Fall back to file picker
  fileInputRef.current?.click();
}
```

This means CEO can take a screenshot in iOS, switch to dashboard, tap 📎, and the clipboard image attaches automatically without going through the photo library.

---

## QuickReplyBar (Inbox inline reply)

`QuickReplyBar` uses `MessageInputRow` internally. Since we're adding attachment support to `MessageInputRow`, QuickReplyBar gets it for free once the underlying component supports it. No specific changes needed here — just ensure the attachment upload uses the relay URL from store/config so it works from the inbox context.

---

## ProposalsPanel Voice "Do this" — Image Attach

The `ProposalsPanel` has its own recording flow (separate from `MessageInputRow`). If CEO wants to record voice + attach image for a proposal response, the proposal card's recording UI would need a similar camera icon. This is a lower priority — the core proposal response is voice text, and images are more useful in freeform CEO messages. Recommend leaving this out of scope for v1 and revisiting after the core feature ships.

---

## Implementation Phases

### Phase 1 (relay server — system-lead or productivitesse backend)
- `POST /attachments` endpoint
- `GET /attachments/:id` static serving
- 24h cleanup task

### Phase 2 (desktop input — productivitesse frontend)
- `MessageInputRow`: paste detection, drag-drop, attach button, thumbnail strip
- `ComposeBar`/`QuickReplyBar`: inherit automatically via `MessageInputRow`
- Upload on select, URL in send body

### Phase 3 (mobile VoicePage)
- Attach icon in controls area
- File picker integration
- Thumbnail preview above record button
- Voice + image combined send

### Phase 4 (agent instructions — COMMAND/consul)
- Update agent CLAUDE.md files to document `[ATTACHMENT: url]` parsing
- Update system prompt or agent knowledge to extract and pass vision URLs to Claude

---

## Risk Flags

1. **iOS security**: `navigator.clipboard.read()` requires user gesture + permission prompt. Graceful fallback to file picker is essential.
2. **Large images**: 10MB limit on relay. CEO phone camera images can be 8–12MB HEIC. Recommend client-side compression before upload (canvas resize to max 2048px) to avoid timeout on slow connections.
3. **Relay URL on mobile**: VoicePage derives voice-bridge URL by replacing the relay port. Attachment URL needs the same pattern — `getRelayUrl()` is the right source. Ensure no hardcoded ports.
4. **Attachment expiry during conversation**: If CEO attaches an image, closes the app, returns 25 hours later, and sends — the URL is gone. Client should check attachment status before send and re-upload if expired. Simple check: attempt `HEAD /attachments/:id`, re-upload on 404.
5. **Windows**: `<input type="file">` and `onPaste` both work on Windows Chrome. Drag-drop also works. No platform-specific concerns here.
