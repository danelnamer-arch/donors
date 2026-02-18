#!/usr/bin/env bash
#
# Funderra — Re-run Failed Waves (3a through 5c)
#
# These waves failed during the overnight run due to a Neon DB outage.
# The DB is back online — this script re-runs them with the same
# retry + resume logic.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOCK_FILE="$PROJECT_DIR/.overnight-supervisor.lock"
MAX_RETRIES=3

# ─── Lock file ──────────────────────────────────────────────────

if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "ERROR: Another supervisor is running (PID: $LOCK_PID)"
    exit 1
  else
    rm -f "$LOCK_FILE"
  fi
fi

echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(timestamp)] $1"; }

separator() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║  $1"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo ""
}

run_with_retry() {
  local desc="$1"
  shift
  local cmd=("$@")
  local attempt=0
  local exit_code=0

  separator "$desc"
  log "Starting: $desc"
  log "Command: ${cmd[*]}"

  while [ $attempt -lt $MAX_RETRIES ]; do
    attempt=$((attempt + 1))
    log "Attempt $attempt/$MAX_RETRIES for: $desc"

    local log_file="$LOG_DIR/rerun_$(echo "$desc" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')_attempt${attempt}_$(date '+%Y%m%d_%H%M%S').log"

    set +e
    "${cmd[@]}" 2>&1 | tee "$log_file"
    exit_code=${PIPESTATUS[0]}
    set -e

    if [ $exit_code -eq 0 ]; then
      log "✓ SUCCESS: $desc (attempt $attempt)"
      return 0
    fi

    log "✗ FAILED: $desc (attempt $attempt, exit code: $exit_code)"

    if [ $attempt -lt $MAX_RETRIES ]; then
      log "Retrying with --resume in 30 seconds..."
      sleep 30

      local has_resume=false
      for arg in "${cmd[@]}"; do
        if [ "$arg" = "--resume" ]; then has_resume=true; break; fi
      done
      if [ "$has_resume" = false ]; then cmd+=("--resume"); fi
    fi
  done

  log "✗✗ GIVING UP: $desc after $MAX_RETRIES attempts — continuing to next wave"
  return 1
}

# ─── Pre-run snapshot ───────────────────────────────────────────

separator "RE-RUN FAILED WAVES — STARTING"

PRE_COUNT=$(npx tsx --env-file=.env -e "
import 'tsconfig-paths/register';
import { prisma } from '@/lib/prisma';
prisma.donor.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('?'); process.exit(0); });
" 2>/dev/null || echo "?")
log "Pre-run donor count: $PRE_COUNT"

WAVE_RESULTS=()

# ═══════════════════════════════════════════════════════════════
# Wave 3a: Israeli Private Donors (phases 8-14)
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 3a: Israeli Private Donors (120+ individuals)" \
  npx tsx --env-file=.env scripts/israeli-private-donors.ts --resume; then
  WAVE_RESULTS+=("Wave 3a: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 3a: ✗ FAILED")
fi

# ═══════════════════════════════════════════════════════════════
# Wave 3b: Board Member Cross-Reference
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 3b: Board Member Cross-Reference" \
  npx tsx --env-file=.env scripts/board-member-xref.ts --limit 30; then
  WAVE_RESULTS+=("Wave 3b: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 3b: ✗ FAILED")
fi

# ═══════════════════════════════════════════════════════════════
# Wave 4a: EU Jewish + Tech/Political (phases 21-25)
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 4a: EU Jewish + Tech/Political Expansion" \
  npx tsx --env-file=.env scripts/overnight-wave4-expansion.ts; then
  WAVE_RESULTS+=("Wave 4a: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 4a: ✗ FAILED")
fi

# ═══════════════════════════════════════════════════════════════
# Wave 4b: Similar Org Backfill
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 4b: Similar Org Backfill" \
  npx tsx --env-file=.env scripts/backfill-similar-orgs.ts; then
  WAVE_RESULTS+=("Wave 4b: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 4b: ✗ FAILED")
fi

# ═══════════════════════════════════════════════════════════════
# Wave 5a: Deep Enrichment + Website Verification
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 5a: Deep Enrichment + Website Verification" \
  npx tsx --env-file=.env scripts/overnight-wave5-enrichment.ts; then
  WAVE_RESULTS+=("Wave 5a: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 5a: ✗ FAILED")
fi

# ═══════════════════════════════════════════════════════════════
# Wave 5b: Political Embeddings Backfill
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 5b: Political Embeddings Backfill" \
  npx tsx --env-file=.env scripts/backfill-political-embeddings.ts; then
  WAVE_RESULTS+=("Wave 5b: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 5b: ✗ FAILED")
fi

# ═══════════════════════════════════════════════════════════════
# Wave 5c: Data Normalization
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 5c: Data Normalization" \
  npx tsx --env-file=.env scripts/normalize-existing-data.ts; then
  WAVE_RESULTS+=("Wave 5c: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 5c: ✗ FAILED")
fi

# ─── Final Summary ──────────────────────────────────────────────

POST_COUNT=$(npx tsx --env-file=.env -e "
import 'tsconfig-paths/register';
import { prisma } from '@/lib/prisma';
prisma.donor.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('?'); process.exit(0); });
" 2>/dev/null || echo "?")

separator "RE-RUN FAILED WAVES — COMPLETE"
log ""
log "Pre-run donor count:  $PRE_COUNT"
log "Post-run donor count: $POST_COUNT"
log ""
log "Wave Results:"
for result in "${WAVE_RESULTS[@]}"; do
  log "  $result"
done

SUCCESS_COUNT=0
FAIL_COUNT=0
for result in "${WAVE_RESULTS[@]}"; do
  if [[ "$result" == *"SUCCESS"* ]]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

log ""
log "Summary: $SUCCESS_COUNT succeeded, $FAIL_COUNT failed out of ${#WAVE_RESULTS[@]} waves"
log ""
log "Re-run completed at $(timestamp)"
