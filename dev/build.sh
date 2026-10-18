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
# the recogniser on the phone: worker and filterbank (the model and onnxruntime-web are kept in asr/ as they are)
cp dev/app/asr/worker.js dev/app/asr/fbank.js asr/
grep -o "APP_VERSION = '[^']*'" index.html
