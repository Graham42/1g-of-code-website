# Claude Code hook — auto-format a file after Write/Edit tool use
$hookJson = [Console]::In.ReadToEnd()

$payload  = $hookJson | ConvertFrom-Json
$filePath = $payload.tool_input.file_path
$cwd      = $payload.cwd

bun run format -- $filePath 2>&1
exit 0
