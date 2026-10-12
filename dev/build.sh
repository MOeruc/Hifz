#!/bin/sh
# Rebuild the served app (repository root) from the sources in dev/.
set -e
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
python3 -I dev/tools/build_app.py dev/app . dev/fonts/uthmanic-hafs1-ver14.woff2 "$OUT"
for f in "$OUT"/pwa/*; do
  case "$(basename "$f")" in
    LIESMICH.txt) ;;
    *) cp "$f" . ;;
  esac
done
rm -rf "$OUT"
grep -o "APP_VERSION = '[^']*'" index.html
