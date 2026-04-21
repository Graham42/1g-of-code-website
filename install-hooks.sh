#!/bin/bash
# Installs this project's Claude Code hooks into the global ~/.claude/settings.json,
# using absolute paths so hooks work regardless of current working directory.
set -euo pipefail

# Resolve the project root from this script's location so the script can be
# invoked from any directory and still produce correct absolute paths.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL_SETTINGS="$HOME/.claude/settings.json"

# Absolute paths to the hook scripts. These are what gets written into the
# global settings — relative paths would break when Claude runs the hook
# outside this project's directory.
NOTIFY_CMD="$SCRIPT_DIR/claude-alerts/notify.sh"
FORMAT_CMD="$SCRIPT_DIR/.claude/hooks/post-edit-format.sh"

# Fail early if a hook script is missing rather than writing a broken config.
for cmd in "$NOTIFY_CMD" "$FORMAT_CMD"; do
    if [ ! -f "$cmd" ]; then
        echo "ERROR: Hook script not found: $cmd" >&2
        exit 1
    fi
done

# Create the global settings file if this is a fresh Claude install.
if [ ! -f "$GLOBAL_SETTINGS" ]; then
    echo "{}" > "$GLOBAL_SETTINGS"
fi

# Merge hooks into global settings using jq.
#
# Strategy: strip any existing entries whose commands match our absolute paths
# (idempotency — safe to re-run), then append the current definitions.
# Other hooks already in the global file are left untouched.
#
# Hook purposes:
#   Stop          — play an audio alert when Claude finishes a task
#   Notification  — play an audio alert on permission/elicitation prompts
#   PostToolUse   — auto-format files after Write/Edit (reads cwd from hook
#                   input, so it works correctly for any project)
UPDATED=$(jq \
    --arg notify "$NOTIFY_CMD" \
    --arg format "$FORMAT_CMD" \
    '
    # Remove entries whose hook commands overlap with the provided list.
    # Each top-level entry can contain multiple hooks; we drop the whole entry
    # if any of its hook commands match, then re-add the canonical definition.
    def remove_project_hooks(cmds):
        map(select(
            [ .hooks[]?.command | IN(cmds[]) ] | any | not
        ));

    . as $root |
    ($root.hooks // {}) as $h |

    $root |
    .hooks.Stop = (($h.Stop // []) | remove_project_hooks([$notify])) + [
        {"hooks": [{"type": "command", "command": $notify}]}
    ] |
    .hooks.Notification = (($h.Notification // []) | remove_project_hooks([$notify])) + [
        {"matcher": "permission_prompt|elicitation_dialog", "hooks": [{"type": "command", "command": $notify}]}
    ] |
    .hooks.PostToolUse = (($h.PostToolUse // []) | remove_project_hooks([$format])) + [
        {"matcher": "Write|Edit", "hooks": [{"type": "command", "command": $format}]}
    ]
    ' \
    "$GLOBAL_SETTINGS")

echo "$UPDATED" > "$GLOBAL_SETTINGS"
echo "Hooks installed to $GLOBAL_SETTINGS"
echo "  Stop             -> $NOTIFY_CMD"
echo "  Notification     -> $NOTIFY_CMD"
echo "  PostToolUse      -> $FORMAT_CMD"
