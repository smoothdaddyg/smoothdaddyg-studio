#!/bin/bash
# stamp-assets.sh [version]
# Version-stamps every css/js URL in every HTML file, IN the source tree.
# Git deploys serve files exactly as committed, so this is how browsers are
# forced to fetch fresh CSS/JS after a deploy: the URL itself changes.
# Run this before committing/pushing any deploy that changes css, js, or
# game code. Version defaults to the current timestamp.
set -euo pipefail
VER="${1:-$(date +%Y%m%d%H%M)}"
cd "$(dirname "$0")/.."
find . -name '*.html' -not -path './node_modules/*' -print0 \
  | xargs -0 sed -i -E "s/(href|src)=\"([^\"]+\\.(css|js))(\\?v=[^\"]*)?\"/\1=\"\2?v=$VER\"/g"
echo "Stamped asset URLs with ?v=$VER"
grep -rhoE '(href|src)="[^"]+\.(css|js)\?v=[^"]+"' --include="*.html" . | sort -u | head -8
