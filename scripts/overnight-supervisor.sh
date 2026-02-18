#!/usr/bin/env bash
#
# Funderra — Overnight Database Enrichment Supervisor
#
# Chains all discovery + enrichment waves with crash recovery.
# Each script retries up to 3 times with --resume on failure.
# If a wave fails after all retries, the supervisor continues to the next wave.
#
# Usage:
#   bash scripts/overnight-supervisor.sh 2>&1 | tee logs/overnight-full.log &
#   tail -f logs/overnight-full.log
#
# Expected total runtime: ~15-19 hours
# Expected total new donors: ~1,345+
#

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOCK_FILE="$PROJECT_DIR/.overnight-supervisor.lock"
MAX_RETRIES=3

# ─── Lock file (prevent double-execution) ───────────────────────

if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "ERROR: Overnight supervisor is already running (PID: $LOCK_PID)"
    echo "If this is stale, remove $LOCK_FILE and try again."
    exit 1
  else
    echo "WARNING: Stale lock file found (PID $LOCK_PID not running). Removing..."
    rm -f "$LOCK_FILE"
  fi
fi

echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ─── Setup ──────────────────────────────────────────────────────

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

# ─── Helpers ────────────────────────────────────────────────────

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  echo "[$(timestamp)] $1"
}

separator() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║  $1"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo ""
}

# Run a script with retry logic
# Args: $1 = description, $2+ = command
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

    local log_file="$LOG_DIR/$(echo "$desc" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')_attempt${attempt}_$(date '+%Y%m%d_%H%M%S').log"

    # Run the command, capturing output to both console and log file
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

      # On retry, add --resume flag if not already present
      local has_resume=false
      for arg in "${cmd[@]}"; do
        if [ "$arg" = "--resume" ]; then
          has_resume=true
          break
        fi
      done

      if [ "$has_resume" = false ]; then
        cmd+=("--resume")
      fi
    fi
  done

  log "✗✗ GIVING UP: $desc after $MAX_RETRIES attempts — continuing to next wave"
  return 1
}

# ─── Pre-run snapshot ───────────────────────────────────────────

separator "OVERNIGHT SUPERVISOR — STARTING"
log "Project: $PROJECT_DIR"
log "Logs:    $LOG_DIR"
log "Lock:    $LOCK_FILE (PID $$)"
log ""

# Get pre-run donor count
PRE_COUNT=$(npx tsx --env-file=.env -e "
import 'tsconfig-paths/register';
import { prisma } from '@/lib/prisma';
prisma.donor.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('?'); process.exit(0); });
" 2>/dev/null || echo "?")
log "Pre-run donor count: $PRE_COUNT"
log ""

# ─── Track wave results ─────────────────────────────────────────

WAVE_RESULTS=()

# ═══════════════════════════════════════════════════════════════
# WAVE 1: Core Marathon Discovery (phases 1-5)
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 1: Core Marathon Discovery" \
  npx tsx --env-file=.env scripts/marathon-discovery.ts; then
  WAVE_RESULTS+=("Wave 1: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 1: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 2a: Israeli Expansion (phases 6-7)
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 2a: Israeli Foundation Expansion" \
  npx tsx --env-file=.env scripts/israeli-expansion.ts; then
  WAVE_RESULTS+=("Wave 2a: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 2a: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 2b: Israeli Data Expansion (phases 15-20)
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 2b: Israeli Data Expansion" \
  npx tsx --env-file=.env scripts/israeli-data-expansion.ts; then
  WAVE_RESULTS+=("Wave 2b: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 2b: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 3a: Israeli Private Donors (phases 8-14)
# 120+ private donor direct-name research
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 3a: Israeli Private Donors (120+ individuals)" \
  npx tsx --env-file=.env scripts/israeli-private-donors.ts; then
  WAVE_RESULTS+=("Wave 3a: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 3a: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 3b: Board Member Cross-Reference
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 3b: Board Member Cross-Reference" \
  npx tsx --env-file=.env scripts/board-member-xref.ts --limit 30; then
  WAVE_RESULTS+=("Wave 3b: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 3b: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 4a: EU Jewish + Tech/Political Expansion (phases 21-25)
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 4a: EU Jewish + Tech/Political Expansion" \
  npx tsx --env-file=.env scripts/overnight-wave4-expansion.ts; then
  WAVE_RESULTS+=("Wave 4a: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 4a: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 4b: Similar Org Backfill
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 4b: Similar Org Backfill" \
  npx tsx --env-file=.env scripts/backfill-similar-orgs.ts; then
  WAVE_RESULTS+=("Wave 4b: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 4b: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 5a: Deep Enrichment + Website Verification (phases 26-27)
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 5a: Deep Enrichment + Website Verification" \
  npx tsx --env-file=.env scripts/overnight-wave5-enrichment.ts; then
  WAVE_RESULTS+=("Wave 5a: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 5a: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 5b: Political Embeddings Backfill
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 5b: Political Embeddings Backfill" \
  npx tsx --env-file=.env scripts/backfill-political-embeddings.ts; then
  WAVE_RESULTS+=("Wave 5b: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 5b: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 5c: Data Normalization
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 5c: Data Normalization" \
  npx tsx --env-file=.env scripts/normalize-existing-data.ts; then
  WAVE_RESULTS+=("Wave 5c: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 5c: ✗ FAILED (continued)")
fi

# ═══════════════════════════════════════════════════════════════
# WAVE 5d: Data Quality Report
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Wave 5d: Data Quality Report" \
  npx tsx --env-file=.env scripts/data-quality-report.ts; then
  WAVE_RESULTS+=("Wave 5d: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Wave 5d: ✗ FAILED (continued)")
fi

# ─── Post-run snapshot ──────────────────────────────────────────

POST_COUNT=$(npx tsx --env-file=.env -e "
import 'tsconfig-paths/register';
import { prisma } from '@/lib/prisma';
prisma.donor.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('?'); process.exit(0); });
" 2>/dev/null || echo "?")

# ─── Final Summary ──────────────────────────────────────────────

separator "OVERNIGHT SUPERVISOR — COMPLETE"
log ""
log "Pre-run donor count:  $PRE_COUNT"
log "Post-run donor count: $POST_COUNT"
log ""
log "Wave Results:"
for result in "${WAVE_RESULTS[@]}"; do
  log "  $result"
done
log ""
log "Logs directory: $LOG_DIR"
log "Full log: logs/overnight-full.log"
log ""

# Count successes and failures
SUCCESS_COUNT=0
FAIL_COUNT=0
for result in "${WAVE_RESULTS[@]}"; do
  if [[ "$result" == *"SUCCESS"* ]]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

log "Summary: $SUCCESS_COUNT succeeded, $FAIL_COUNT failed out of ${#WAVE_RESULTS[@]} waves"
log ""

if [ $FAIL_COUNT -eq 0 ]; then
  log "ALL WAVES COMPLETED SUCCESSFULLY"
else
  log "WARNING: $FAIL_COUNT wave(s) failed — check individual logs for details"
fi

log ""
log "Overnight enrichment supervisor finished at $(timestamp)"
