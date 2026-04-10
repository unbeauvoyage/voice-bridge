#!/usr/bin/env python3
"""Voice relay server — receives plain-text POST /message from iOS Shortcut
and appends it to the inbox queue for the watcher to inject into cmux."""

import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = 8765
INBOX = Path.home() / "environment" / "voice-relay" / "inbox.txt"
RESPONSE_FILE = Path.home() / "environment" / "voice-relay" / "last_response.txt"


def queue_message(text: str) -> None:
    """Append message to inbox.txt as a single line (newlines replaced with space)."""
    line = text.replace("\n", " ").replace("\r", " ")
    with open(INBOX, "a") as f:
        f.write(line + "\n")


class VoiceRelayHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Override to suppress default access log; we do our own logging.
        pass

    def do_GET(self):
        if self.path == "/health":
            body = b"OK"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/response":
            # Return the contents of last_response.txt (empty string if not found or empty)
            try:
                if RESPONSE_FILE.exists():
                    body = RESPONSE_FILE.read_text().encode("utf-8")
                else:
                    body = b""
            except Exception:
                body = b""
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/message":
            self.send_response(404)
            self.end_headers()
            return

        import json
        from urllib.parse import parse_qs
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8").strip() if length else ""
        content_type = self.headers.get("Content-Type", "")
        if "application/json" in content_type:
            try:
                text = json.loads(raw).get("message", raw)
            except Exception:
                text = raw
        elif "application/x-www-form-urlencoded" in content_type:
            try:
                text = parse_qs(raw).get("message", [raw])[0]
            except Exception:
                text = raw
        else:
            text = raw

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        preview = text[:80].replace("\n", " ")
        print(f"[{timestamp}] queued: {preview}", flush=True)

        queue_message(text)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        body = b"OK"
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    # Ensure inbox file exists
    INBOX.touch(exist_ok=True)
    server = HTTPServer(("0.0.0.0", PORT), VoiceRelayHandler)
    print(f"Voice relay listening on port {PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Shutting down.", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    main()
