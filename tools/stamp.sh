#!/bin/bash
# stamp.sh <source-dir> <dest-dir>
# Copies the site, stamps ?v=YYYYMMDDHHMM into css/js links in every HTML file,
# and builds the deploy zip. Never stamps the source tree.
set -euo pipefail
SRC="${1:?usage: stamp.sh <source-dir> <dest-dir>}"
DEST="${2:?usage: stamp.sh <source-dir> <dest-dir>}"
STAMP="$(date +%Y%m%d%H%M)"
rm -rf "$DEST"
cp -r "$SRC" "$DEST"
# Stamp version into css/js references in all HTML files
find "$DEST" -name '*.html' -print0 | xargs -0 sed -i -E "s/(href|src)=\"([^\"]+\.(css|js))\"/\1=\"\2?v=$STAMP\"/g"
# Build zip excluding README.md
rm -f "$DEST/../smoothdaddyg-studio.zip"
(cd "$DEST" && zip -qr "$DEST/../smoothdaddyg-studio.zip" . -x README.md)
echo "Built $DEST/../smoothdaddyg-studio.zip (stamp $STAMP)"
