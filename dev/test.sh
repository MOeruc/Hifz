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
node dev/app/tests/fbank.test.js dev/testdata/fbank-ref.json
node dev/app/tests/phon.test.js quran.json asr/model/words.json asr/model/tokens.txt dev/testdata/phon-ref.json
if [ "$1" = "full" ]; then
  node dev/app/tests/fullquran.test.js quran.json dev/testdata/simple-clean.json
  node dev/app/tests/bench_find.js quran.json dev/testdata/simple-clean.json
fi
