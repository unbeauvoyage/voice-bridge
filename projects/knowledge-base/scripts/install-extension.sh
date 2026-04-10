#!/bin/bash
EXTENSION_PATH="$(cd "$(dirname "$0")/.." && pwd)/extension"

# Try Chrome first, then Edge
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
EDGE="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"

if [ -f "$CHROME" ]; then
  BROWSER="$CHROME"
elif [ -f "$EDGE" ]; then
  BROWSER="$EDGE"
else
  echo "Neither Chrome nor Edge found."
  exit 1
fi

echo "Loading extension from: $EXTENSION_PATH"
echo "Launching browser with extension pre-loaded..."

# --load-extension works on launch; if browser already open this opens a new window with it loaded
"$BROWSER" --load-extension="$EXTENSION_PATH" --no-first-run 2>/dev/null &

echo "Done. Extension loaded in new browser window."
echo "Note: if Chrome/Edge was already open, the extension is only active in the new window."
echo "To make it permanent: chrome://extensions → Developer mode → Load unpacked → select extension/"
