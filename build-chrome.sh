#!/usr/bin/env bash
# Build a Chrome Web Store ZIP and an unpacked copy for local testing.
set -euo pipefail

cd "$(dirname "$0")"

VERSION="$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')"
OUT_ZIP="${1:-./kicad_parts_clipper_ngx_chrome_v${VERSION//./_}.zip}"
OUT_DIR="${2:-./kicad_parts_clipper_ngx_chrome_unpacked}"

# Resolve to absolute paths so the zip step can run from the staging directory.
OUT_ZIP="$(python3 -c 'import os, sys; print(os.path.abspath(sys.argv[1]))' "$OUT_ZIP")"
OUT_DIR="$(python3 -c 'import os, sys; print(os.path.abspath(sys.argv[1]))' "$OUT_DIR")"

if [ "$OUT_DIR" = "/" ] || [ "$OUT_DIR" = "$HOME" ]; then
  echo "Refusing to use $OUT_DIR as the build directory" >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

cp manifest.json popup.html popup.js settings.js options.html options.js LICENSE "$OUT_DIR"/
cp -r content-scripts icons "$OUT_DIR"/

# Chrome does not understand Firefox's browser_specific_settings key.
python3 - "$OUT_DIR/manifest.json" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    manifest = json.load(f)

manifest.pop("browser_specific_settings", None)

with open(path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY

rm -f "$OUT_ZIP"
( cd "$OUT_DIR" && zip -r -X -q "$OUT_ZIP" . )

echo "Built $OUT_ZIP (version $VERSION)"
echo "Unpacked extension: $OUT_DIR"
sha256sum "$OUT_ZIP"
