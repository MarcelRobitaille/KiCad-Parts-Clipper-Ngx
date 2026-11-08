#!/usr/bin/env bash
# Build the extension into a stable XPI path so the same file can be reloaded
# from about:debugging instead of selecting a new versioned file each time.
set -euo pipefail

cd "$(dirname "$0")"

VERSION="$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')"
OUT="./kicad_parts_clipper_ngx_v${VERSION//./_}.xpi"

rm -f "$OUT"
zip -r -X -q "$OUT" \
  manifest.json \
  popup.html popup.js compat.js \
  settings.js options.html options.js \
  content-scripts icons

echo "Built $OUT (version $VERSION)"
sha256sum "$OUT"
