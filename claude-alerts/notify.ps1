# Claude Code hook — forward hook JSON to the alert overlay server
# Called by ~/.claude/settings.json on Stop and Notification events
$hookJson = [Console]::In.ReadToEnd()

# For Notification events, only forward permission_prompt and elicitation_dialog.
# The settings.json matcher should already filter this, but guard here too.
try {
    $payload = $hookJson | ConvertFrom-Json
} catch {
    exit 0
}

if ($payload.hook_event_name -eq 'Notification') {
    $notifType = $payload.notification_type
    if ($notifType -ne 'permission_prompt' -and $notifType -ne 'elicitation_dialog') {
        exit 0
    }
}

try {
    Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/claude/notify' `
        -ContentType 'application/json' -Body $hookJson | Out-Null
} catch {
    # Server not running — silently ignore so Claude is never blocked
}
