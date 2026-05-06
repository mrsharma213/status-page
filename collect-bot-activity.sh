#!/bin/bash
# Collects recent activity from all bot workspaces and merges into activity-log.json

STATUS_DIR="$(dirname "$0")"
LOG_FILE="$STATUS_DIR/activity-log.json"
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)

python3 << PYEOF
import json, os, re, glob

log_file = "$LOG_FILE"
today = "$TODAY"
yesterday = "$YESTERDAY"

workspaces = {
    'crm': '/Users/jetdamon/.openclaw/workspace-crm',
    'macra': '/Users/jetdamon/.openclaw/workspace-macra',
    'macra-app': '/Users/jetdamon/.openclaw/workspace-macra-app',
    'printingpress': '/Users/jetdamon/.openclaw/workspace-printingpress',
    'writer': '/Users/jetdamon/.openclaw/workspace-writer',
    'gemma': '/Users/jetdamon/.openclaw/workspace-gemma',
    'grok': '/Users/jetdamon/.openclaw/workspace-grok',
    'health': '/Users/jetdamon/.openclaw/workspace-health'
}

try:
    with open(log_file) as f:
        log = json.load(f)
except:
    log = []

# Index existing by action hash to prevent dupes
existing = set()
for entry in log:
    key = f"{entry.get('bot','')}-{entry.get('action','')[:60]}"
    existing.add(key)

new_entries = 0

for bot_id, workspace in workspaces.items():
    for date_str in [today, yesterday]:
        mem_file = os.path.join(workspace, 'memory', f'{date_str}.md')
        if not os.path.exists(mem_file):
            continue
        
        with open(mem_file) as f:
            content = f.read()
        
        lines = content.split('\n')
        current_time = '12:00'
        current_section = ''
        
        for line in lines:
            stripped = line.strip()
            
            # Match section headers with times
            time_match = re.match(r'^##\s*(?:(\d{1,2}:\d{2})\s*(?:ET|EDT|EST|AM|PM)\s*[-—]?\s*)?(.*)', stripped)
            if time_match:
                if time_match.group(1):
                    current_time = time_match.group(1)
                current_section = time_match.group(2).strip() if time_match.group(2) else ''
                
                # Section headers themselves can be activities
                if current_section and len(current_section) > 5 and not current_section.startswith('#'):
                    action = re.sub(r'\*\*([^*]+)\*\*', r'\\1', current_section)
                    key = f"{bot_id}-{action[:60]}"
                    if key not in existing:
                        cat = guess_cat(action) if 'guess_cat' in dir() else 'other'
                        log.append({'ts': f'{date_str}T{current_time}:00-04:00', 'action': action, 'category': cat, 'bot': bot_id})
                        existing.add(key)
                        new_entries += 1
                continue
            
            # Match key bullet points (skip sub-bullets and short lines)
            if stripped.startswith('- **') and len(stripped) > 15:
                # Extract bold part as action summary
                bold_match = re.match(r'- \*\*([^*]+)\*\*\s*[-—:]?\s*(.*)', stripped)
                if bold_match:
                    action = bold_match.group(1)
                    detail = bold_match.group(2)[:80] if bold_match.group(2) else ''
                    if detail:
                        action = f"{action} — {detail}"
                    
                    key = f"{bot_id}-{action[:60]}"
                    if key not in existing:
                        # Guess category
                        lower = action.lower()
                        cat = 'other'
                        if any(w in lower for w in ['email', 'sent', 'messaged', 'replied', 'forward']): cat = 'outbound'
                        elif any(w in lower for w in ['check', 'scan', 'heartbeat', 'monitor', 'verified']): cat = 'check'
                        elif any(w in lower for w in ['fix', 'resolved', 'patched', 'updated', 'removed', 'integrated']): cat = 'fix'
                        elif any(w in lower for w in ['remind', 'alert', 'flag']): cat = 'reminder'
                        elif any(w in lower for w in ['draft', 'wrote', 'content', 'tweet', 'newsletter', 'built', 'created', 'prototype']): cat = 'content'
                        elif any(w in lower for w in ['deploy', 'push', 'launch', 'ship', 'running']): cat = 'deploy'
                        elif any(w in lower for w in ['research', 'search', 'found', 'pulled', 'brief']): cat = 'research'
                        elif any(w in lower for w in ['memory', 'logged', 'saved', 'noted']): cat = 'memory'
                        elif any(w in lower for w in ['twilio', 'sms', 'api', 'config', 'setup']): cat = 'infra'
                        
                        log.append({'ts': f'{date_str}T{current_time}:00-04:00', 'action': action, 'category': cat, 'bot': bot_id})
                        existing.add(key)
                        new_entries += 1

# Sort and cap at 200
log.sort(key=lambda x: x['ts'], reverse=True)
log = log[:200]

with open(log_file, 'w') as f:
    json.dump(log, f, indent=2)

print(f'Collected activity: {new_entries} new entries from bot workspaces')
PYEOF
