#!/usr/bin/env bash
set -euo pipefail

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('manifest.json','utf8')).version")"
OUT="dist/Flow-Prompt-Typer-v${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"
zip -q -j "$OUT" \
  manifest.json background.js content.js popup.html popup.css popup.js INSTALL-ME.txt README.md
zip -q "$OUT" icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png

echo "Built $OUT"
unzip -t "$OUT"
