#!/bin/sh
# Engine tests. The full-Quran test takes one to two minutes: sh dev/test.sh full
set -e
cd "$(dirname "$0")/.."
node dev/app/tests/scenarios.test.js quran.json dev/testdata/simple-clean.json
node dev/app/tests/noise.test.js quran.json dev/testdata/simple-clean.json
if [ "$1" = "full" ]; then node dev/app/tests/fullquran.test.js quran.json dev/testdata/simple-clean.json; fi
