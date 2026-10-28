#!/usr/bin/env bash
# Usage: ./bootstrap.sh <target-dir> [--no-install]
# Copies this kit into <target-dir>, initialises git, installs dependencies, runs the Phase 0 spike,
# and prints the harness table. Safe to re-run on an empty or kit-only directory.
set -euo pipefail

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-}"
INSTALL=1; [[ "${2:-}" == "--no-install" ]] && INSTALL=0
[[ -z "$TARGET" ]] && { echo "usage: $0 <target-dir> [--no-install]"; exit 2; }

command -v node >/dev/null || { echo "Node 20+ required"; exit 1; }
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
(( NODE_MAJOR >= 20 )) || { echo "Node 20+ required, found $(node -v)"; exit 1; }

mkdir -p "$TARGET"
if [[ -n "$(ls -A "$TARGET" 2>/dev/null)" && ! -f "$TARGET/CLAUDE.md" ]]; then
  echo "Refusing: $TARGET is not empty and is not a previous kit install."; exit 1
fi

echo "==> Copying kit to $TARGET"
(cd "$KIT" && tar --exclude=node_modules --exclude=out --exclude=bootstrap.sh -cf - .) | (cd "$TARGET" && tar -xf -)
mkdir -p "$TARGET/docs/reference" "$TARGET/harness/corpus" "$TARGET/harness/results"
echo "Put the Aaj Tak / Free Press reference screenshots and any past issues in docs/reference and harness/corpus." > "$TARGET/docs/reference/README.txt"

cd "$TARGET"
[[ -d .git ]] || { git init -q && git add -A && git commit -qm "Kit: product prompt, phases, harness, Phase 0 spike" || true; }

# npm ci when a lockfile is committed (reproducible), npm install otherwise
inst() { if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund || npm install --no-audit --no-fund; else npm install --no-audit --no-fund; fi; }

if (( INSTALL )); then
  echo "==> Installing root dependencies"
  inst
  npx playwright install chromium
  echo "==> Installing spike dependencies and fonts (Devanagari + Latin subsets)"
  (cd spike && inst && node add-fonts.mjs)
  echo "==> Unit tests"
  npm test || echo "!! npm test failed: read the output above before doing anything else"
  echo "==> Phase 0 spike (minutes)"
  npm run spike || echo "!! spike failed: see the message above (usually missing fonts or samples)"
  echo "==> Harness (phase 0)"
  npm run harness -- --phase 0 || true
else
  echo "==> Skipped install. Next: cd $TARGET && npm install && npx playwright install chromium && (cd spike && npm install && node add-fonts.mjs) && npm test && npm run harness -- --phase 0"
fi

cat <<MSG

Done. Next:
  1. cd $TARGET
  2. Add 40+ real Janshakti paragraphs to spike/samples/*.txt
  3. claude --model opusplan   (Shift+Tab to plan mode) and paste docs/PLAN_ENHANCEMENT_PROMPT.md
  4. After the plan is approved, start Phase 0:
       Read CLAUDE.md and docs/PRODUCT_PROMPT.md, then execute docs/phases/phase0-engine.md.
MSG
