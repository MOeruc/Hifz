#!/bin/sh
# Engine tests. Slow extras (a few minutes): sh dev/test.sh full  (whole Quran, and the surah-finding benchmark)
set -e
cd "$(dirname "$0")/.."
node dev/app/tests/scenarios.test.js quran.json dev/testdata/simple-clean.json
node dev/app/tests/noise.test.js quran.json dev/testdata/simple-clean.json
node dev/app/tests/sessions.test.js quran.json dev/testdata/simple-clean.json
node dev/app/tests/memorise.test.js quran.json dev/testdata/simple-clean.json
node dev/app/tests/neutral.test.js quran.json dev/testdata/simple-clean.json
node dev/app/tests/android.test.js quran.json dev/testdata/simple-clean.json
node dev/app/tests/starts.test.js quran.json dev/testdata/simple-clean.json
if [ "$1" = "full" ]; then
  node dev/app/tests/fullquran.test.js quran.json dev/testdata/simple-clean.json
  node dev/app/tests/bench_find.js quran.json dev/testdata/simple-clean.json
fi
