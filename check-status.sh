#!/bin/bash
# Jet Damon — Status Page Checker
# Runs periodically to update status.json

STATUS_DIR="$(dirname "$0")"
STATUS_FILE="$STATUS_DIR/status.json"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NOW_DISPLAY=$(TZ="America/New_York" date +"%B %d, %Y at %I:%M %p ET")

# Helper: check if a command succeeds within timeout
check() {
  timeout 15 bash -c "$1" >/dev/null 2>&1 && echo "operational" || echo "down"
}

# Gateway
GATEWAY=$(openclaw gateway status 2>&1 | grep -q "running" && echo "operational" || echo "down")

# Google Auth — jet@nik.co
GMAIL_JET_OUT=$(timeout 20 gog gmail search 'newer_than:24h' --max 1 --account jet@nik.co 2>&1)
echo "$GMAIL_JET_OUT" | grep -qi "error\|timed out\|ECONNREFUSED\|invalid_grant" && GMAIL_JET="down" || GMAIL_JET="operational"

# Google Auth — nik@nik.co
GMAIL_NIK_OUT=$(timeout 20 gog gmail search 'newer_than:24h' --max 1 --account nik@nik.co 2>&1)
echo "$GMAIL_NIK_OUT" | grep -qi "error\|timed out\|ECONNREFUSED\|invalid_grant" && GMAIL_NIK="down" || GMAIL_NIK="operational"

# Slack
SLACK_STATUS="unknown"
if command -v curl &>/dev/null; then
  SLACK_TOKEN=$(grep SLACK_USER_TOKEN ~/.openclaw/.env 2>/dev/null | cut -d= -f2)
  if [ -n "$SLACK_TOKEN" ]; then
    SLACK_CHECK=$(curl -s -m 10 -H "Authorization: Bearer $SLACK_TOKEN" "https://slack.com/api/auth.test" 2>/dev/null)
    echo "$SLACK_CHECK" | grep -q '"ok":true' && SLACK_STATUS="operational" || SLACK_STATUS="down"
  fi
fi

# Anthropic API — check if gateway can reach it (key is in keychain, not .env)
# We infer from gateway status + recent cron success
ANTHROPIC_STATUS="operational"
if openclaw gateway status 2>&1 | grep -q "running"; then
  ANTHROPIC_STATUS="operational"
else
  ANTHROPIC_STATUS="down"
fi

# Bot checks via Telegram getMe
check_bot() {
  local token="$1"
  local result=$(curl -s -m 10 "https://api.telegram.org/bot${token}/getMe" 2>/dev/null)
  echo "$result" | grep -q '"ok":true' && echo "operational" || echo "down"
}

# Read all bot tokens from openclaw config (accounts is a dict)
CONFIG="$HOME/.openclaw/openclaw.json"
get_token() {
  python3 -c "import json; d=json.load(open('$CONFIG')); print(d['channels']['telegram']['accounts']['$1']['botToken'])" 2>/dev/null
}

JET_TOKEN=$(get_token "default")
CRM_TOKEN=$(get_token "crm")
MACRA_TOKEN=$(get_token "macra")
PRESS_TOKEN=$(get_token "printingpress")
WRITER_TOKEN=$(get_token "writer")
MACRA_APP_TOKEN=$(get_token "macra-app")
CHIP_TOKEN=$(get_token "gemma")
GROK_TOKEN=$(get_token "grok")
HEALTH_TOKEN=$(get_token "health")

BOT_JET=$([ -n "$JET_TOKEN" ] && check_bot "$JET_TOKEN" || echo "unknown")
BOT_CRM=$([ -n "$CRM_TOKEN" ] && check_bot "$CRM_TOKEN" || echo "unknown")
BOT_MACRA=$([ -n "$MACRA_TOKEN" ] && check_bot "$MACRA_TOKEN" || echo "unknown")
BOT_PRESS=$([ -n "$PRESS_TOKEN" ] && check_bot "$PRESS_TOKEN" || echo "unknown")
BOT_WRITER=$([ -n "$WRITER_TOKEN" ] && check_bot "$WRITER_TOKEN" || echo "unknown")
BOT_MACRA_APP=$([ -n "$MACRA_APP_TOKEN" ] && check_bot "$MACRA_APP_TOKEN" || echo "unknown")
BOT_CHIP=$([ -n "$CHIP_TOKEN" ] && check_bot "$CHIP_TOKEN" || echo "unknown")
BOT_GROK=$([ -n "$GROK_TOKEN" ] && check_bot "$GROK_TOKEN" || echo "unknown")
BOT_HEALTH=$([ -n "$HEALTH_TOKEN" ] && check_bot "$HEALTH_TOKEN" || echo "unknown")

# Overall status
OVERALL="operational"
for s in "$GATEWAY" "$GMAIL_JET" "$GMAIL_NIK" "$ANTHROPIC_STATUS"; do
  [ "$s" = "down" ] && OVERALL="down" && break
  [ "$s" = "degraded" ] && OVERALL="degraded"
done

# Read existing incidents
EXISTING_INCIDENTS="[]"
if [ -f "$STATUS_DIR/incidents.json" ]; then
  EXISTING_INCIDENTS=$(cat "$STATUS_DIR/incidents.json")
fi

# Generate JSON
cat > "$STATUS_FILE" << JSONEOF
{
  "overall": "$OVERALL",
  "updatedAt": "$NOW_DISPLAY",
  "updatedAtUTC": "$NOW",
  "infrastructure": [
    {"name": "Gateway", "emoji": "🖥️", "status": "$GATEWAY"},
    {"name": "Anthropic API", "emoji": "🧠", "status": "$ANTHROPIC_STATUS"},
    {"name": "Exec Engine", "emoji": "⚙️", "status": "$GATEWAY"}
  ],
  "bots": [
    {"name": "Jet (Main)", "emoji": "⚡", "status": "$BOT_JET"},
    {"name": "CRM", "emoji": "📇", "status": "$BOT_CRM"},
    {"name": "Macra Supps", "emoji": "💊", "status": "$BOT_MACRA"},
    {"name": "Macra App", "emoji": "📱", "status": "$BOT_MACRA_APP"},
    {"name": "Printing Press", "emoji": "🖨️", "status": "$BOT_PRESS"},
    {"name": "Josiah (Writer)", "emoji": "✍️", "status": "$BOT_WRITER"},
    {"name": "Chip (Gemma)", "emoji": "🤓", "status": "$BOT_CHIP"},
    {"name": "Grok Research", "emoji": "🔍", "status": "$BOT_GROK"},
    {"name": "Health & Fitness", "emoji": "💪", "status": "$BOT_HEALTH"}
  ],
  "integrations": [
    {"name": "Gmail (jet@nik.co)", "emoji": "📧", "status": "$GMAIL_JET"},
    {"name": "Gmail (nik@nik.co)", "emoji": "📧", "status": "$GMAIL_NIK"},
    {"name": "Slack", "emoji": "💬", "status": "$SLACK_STATUS"},
    {"name": "Fireflies", "emoji": "🔥", "status": "unknown"}
  ],
  "incidents": $EXISTING_INCIDENTS
}
JSONEOF

echo "Status updated at $NOW_DISPLAY — Overall: $OVERALL"
