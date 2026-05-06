#!/bin/bash
# Usage: log-activity.sh "action description" "category"
# Categories: fix, check, outbound, memory, infra, research, docs, reminder, content, deploy

LOG_FILE="$(dirname "$0")/activity-log.json"
ACTION="$1"
CATEGORY="${2:-other}"
TS=$(TZ="America/New_York" date +"%Y-%m-%dT%H:%M:%S%z" | sed 's/\([0-9][0-9]\)$/:\1/')

# Escape quotes in action
ACTION=$(echo "$ACTION" | sed 's/"/\\"/g')

python3 -c "
import json
log = json.load(open('$LOG_FILE'))
log.append({'ts': '$TS', 'action': '$ACTION', 'category': '$CATEGORY'})
# Keep last 100 entries
log = sorted(log, key=lambda x: x['ts'], reverse=True)[:100]
json.dump(log, open('$LOG_FILE', 'w'), indent=2)
print('Logged: $ACTION')
"
