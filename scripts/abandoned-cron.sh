#!/bin/bash
# BriefIntel Abandoned Cart Recovery Cron
# Runs at 10:00 UTC and 18:00 UTC daily
# Sends recovery emails to briefs abandoned >2h and <48h

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/../logs/abandoned-recovery.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG_FILE"
}

# Load secrets from vault
CREDENTIALS_VAULT="${HOME}/.openclaw/workspace/.credentials_vault"
if [[ -f "$CREDENTIALS_VAULT" ]]; then
  source "$CREDENTIALS_VAULT" 2>/dev/null || true
fi

# API endpoint
API_BASE="${BRIEFINTEL_API_URL:-https://getbriefintel.com}"
ADMIN_SECRET="${BRIEFINTEL_ADMIN_SECRET}"

if [[ -z "$ADMIN_SECRET" ]]; then
  log "ERROR: BRIEFINTEL_ADMIN_SECRET not set"
  exit 1
fi

log "Starting abandoned cart recovery scan..."

# Get abandoned briefs
RESPONSE=$(curl -s "${API_BASE}/api/abandoned-recovery?secret=${ADMIN_SECRET}")

if ! echo "$RESPONSE" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
  log "ERROR: Invalid JSON response from API"
  exit 1
fi

TOTAL=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('total', 0))")
PENDING=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('pending', 0))")

log "Found $TOTAL abandoned briefs ($PENDING pending recovery)"

if [[ "$PENDING" -eq 0 ]]; then
  log "No pending recovery emails to send"
  exit 0
fi

# Extract brief IDs that need recovery (not yet sent)
BRIEF_IDS=$(echo "$RESPONSE" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for b in d.get('abandoned', []):
    if not b.get('recovery_sent'):
        print(b.get('id'))
")

SENT_COUNT=0
FAILED_COUNT=0

for BRIEF_ID in $BRIEF_IDS; do
  log "Sending recovery email for brief: $BRIEF_ID"
  
  SEND_RESPONSE=$(curl -s -X POST "${API_BASE}/api/abandoned-recovery?secret=${ADMIN_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{\"brief_id\": \"$BRIEF_ID\"}")
  
  OK=$(echo "$SEND_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d.get('ok') else 'false')" 2>/dev/null || echo "false")
  
  if [[ "$OK" == "true" ]]; then
    EMAIL=$(echo "$SEND_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('to', 'unknown'))" 2>/dev/null)
    EMPRESA=$(echo "$SEND_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('empresa', 'unknown'))" 2>/dev/null)
    log "✓ Sent to $EMAIL ($EMPRESA)"
    ((SENT_COUNT++)) || true
  else
    ERROR=$(echo "$SEND_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error', 'unknown'))" 2>/dev/null || echo "unknown")
    log "✗ Failed: $ERROR"
    ((FAILED_COUNT++)) || true
  fi
  
  # Rate limit: 1 email per second
  sleep 1
done

log "Completed: $SENT_COUNT sent, $FAILED_COUNT failed"
