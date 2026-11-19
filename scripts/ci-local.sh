#!/usr/bin/env bash
# The merge gate, as Jenkins runs it and as a developer runs it on the Mac (npm run ci):
# lint every HTML file, then the tests (the README and the pages agree with the decks,
# and every deck plays to its last slide in headless Chrome without an uncaught error).
# There is no build step: the decks ship as the HTML in this repository. No dependencies
# are installed; everything runs on Node's standard library and a local Chrome
# (CHROME_PATH, or found on the usual paths).
set -euo pipefail
cd "$(dirname "$0")/.."
node --version
echo "== shell scripts parse"
bash -n scripts/ci-local.sh
echo "== lint"
npm run --silent lint
echo "== tests"
npm test
