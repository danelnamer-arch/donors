#!/bin/bash
# Wait for both background tasks to finish, then launch israeli-private-donors.ts

echo "[$(date)] Waiting for marathon enrichment and Israeli expansion to complete..."

while true; do
  # Check marathon progress
  MARATHON_STATUS=$(cat /Users/user/Desktop/donors/scripts/.marathon-progress.json 2>/dev/null | grep -o '"status": "[^"]*"' | head -1 | cut -d'"' -f4)
  # Check expansion progress  
  EXPANSION_STATUS=$(cat /Users/user/Desktop/donors/scripts/.expansion-progress.json 2>/dev/null | grep -o '"status": "[^"]*"' | head -1 | cut -d'"' -f4)
  
  echo "[$(date)] Marathon: $MARATHON_STATUS | Expansion: $EXPANSION_STATUS"
  
  # Both must be non-running (completed, interrupted, or failed)
  if [ "$MARATHON_STATUS" != "running" ] && [ "$EXPANSION_STATUS" != "running" ]; then
    echo "[$(date)] Both tasks finished! Launching Israeli Private Donor Discovery in 10 seconds..."
    sleep 10
    cd /Users/user/Desktop/donors
    exec npx tsx --env-file=.env scripts/israeli-private-donors.ts
  fi
  
  # Check every 60 seconds
  sleep 60
done
