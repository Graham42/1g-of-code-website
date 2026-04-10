#!/usr/bin/env bash
# Claude Code hook — forward hook JSON to the alert overlay server
# Called by .claude/settings.json on Stop and Notification events
input=$(cat)

# For Notification events, only forward permission_prompt and elicitation_dialog.
# The settings.json matcher should already filter this, but guard here too.
event=$(echo "$input" | grep -o '"hook_event_name":"[^"]*"' | cut -d'"' -f4)
if [ "$event" = "Notification" ]; then
  notif_type=$(echo "$input" | grep -o '"notification_type":"[^"]*"' | cut -d'"' -f4)
  case "$notif_type" in
    permission_prompt|elicitation_dialog) ;;
    *) exit 0 ;;
  esac
fi

curl -s -X POST http://localhost:3001/claude/notify \
  -H 'Content-Type: application/json' \
  -d "$input" \
  >/dev/null 2>&1 || true
