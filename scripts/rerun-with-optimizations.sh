#!/usr/bin/env bash
#
# Funderra — Optimized Pipeline Re-run
#
# Key optimization: EXTRACTION_PROVIDER=openai (avoids Gemini 429 rate limits)
#
# Runs:
#   1. Israeli Tech/Political Donors (phases 28-31) — ~50 new individuals
#   2. Wave 5 Enrichment (phases 26-27) — re-enrich low-quality donors
#
# Usage:
#   bash scripts/rerun-with-optimizations.sh 2>&1 | tee logs/rerun-optimized.log &
#   tail -f logs/rerun-optimized.log
#
# Expected runtime: ~5-7 hours
#

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOCK_FILE="$PROJECT_DIR/.optimized-rerun.lock"
MAX_RETRIES=3

# Key optimization: use OpenAI instead of Gemini for extraction
export EXTRACTION_PROVIDER=openai

# ─── Lock file ──────────────────────────────────────────────────

if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "ERROR: Another optimized rerun is running (PID: $LOCK_PID)"
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

    local log_file="$LOG_DIR/optimized_$(echo "$desc" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')_attempt${attempt}_$(date '+%Y%m%d_%H%M%S').log"

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

separator "OPTIMIZED RE-RUN — STARTING"
log "Extraction provider: $EXTRACTION_PROVIDER"

PRE_COUNT=$(npx tsx --env-file=.env -e "
import 'tsconfig-paths/register';
import { prisma } from '@/lib/prisma';
prisma.donor.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('?'); process.exit(0); });
" 2>/dev/null || echo "?")
log "Pre-run donor count: $PRE_COUNT"

INDIVIDUAL_COUNT=$(npx tsx --env-file=.env -e "
import 'tsconfig-paths/register';
import { prisma } from '@/lib/prisma';
prisma.donor.count({ where: { type: 'INDIVIDUAL' } }).then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('?'); process.exit(0); });
" 2>/dev/null || echo "?")
log "Pre-run individual count: $INDIVIDUAL_COUNT"

WAVE_RESULTS=()

# ═══════════════════════════════════════════════════════════════
# Wave A: Israeli Tech/Political Donors (phases 28-31)
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Israeli Tech/Political Donors (phases 28-31)" \
  npx tsx --env-file=.env scripts/israeli-tech-political-donors.ts; then
  WAVE_RESULTS+=("Tech/Political Donors: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Tech/Political Donors: ✗ FAILED")
fi

# ═══════════════════════════════════════════════════════════════
# Wave B: Deep Enrichment + Website Verification
# ═══════════════════════════════════════════════════════════════

if run_with_retry "Deep Enrichment + Website Verification" \
  npx tsx --env-file=.env scripts/overnight-wave5-enrichment.ts; then
  WAVE_RESULTS+=("Deep Enrichment: ✓ SUCCESS")
else
  WAVE_RESULTS+=("Deep Enrichment: ✗ FAILED")
fi

# ─── Final Summary ──────────────────────────────────────────────

POST_COUNT=$(npx tsx --env-file=.env -e "
import 'tsconfig-paths/register';
import { prisma } from '@/lib/prisma';
prisma.donor.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('?'); process.exit(0); });
" 2>/dev/null || echo "?")

POST_INDIVIDUAL=$(npx tsx --env-file=.env -e "
import 'tsconfig-paths/register';
import { prisma } from '@/lib/prisma';
prisma.donor.count({ where: { type: 'INDIVIDUAL' } }).then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('?'); process.exit(0); });
" 2>/dev/null || echo "?")

separator "OPTIMIZED RE-RUN — COMPLETE"
log ""
log "Extraction provider:    $EXTRACTION_PROVIDER"
log "Pre-run donor count:    $PRE_COUNT"
log "Post-run donor count:   $POST_COUNT"
log "Pre-run individuals:    $INDIVIDUAL_COUNT"
log "Post-run individuals:   $POST_INDIVIDUAL"
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
log "Optimized re-run completed at $(timestamp)"
