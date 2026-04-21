# Installs this project's Claude Code hooks into the global ~\.claude\settings.json,
# using absolute paths so hooks work regardless of current working directory.
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Resolve the project root from this script's location so the script can be
# invoked from any directory and still produce correct absolute paths.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$GlobalSettings = Join-Path $env:USERPROFILE '.claude\settings.json'

# Absolute paths to the hook scripts. These are what gets written into the
# global settings — relative paths would break when Claude runs the hook
# outside this project's directory.
$NotifyCmd  = Join-Path $ScriptDir 'claude-alerts\notify.ps1'
$FormatCmd  = Join-Path $ScriptDir '.claude\hooks\post-edit-format.ps1'

# Fail early if a hook script is missing rather than writing a broken config.
foreach ($cmd in @($NotifyCmd, $FormatCmd)) {
    if (-not (Test-Path $cmd -PathType Leaf)) {
        Write-Error "Hook script not found: $cmd"
        exit 1
    }
}

# Create the global settings file if this is a fresh Claude install.
$SettingsDir = Split-Path -Parent $GlobalSettings
if (-not (Test-Path $SettingsDir)) {
    New-Item -ItemType Directory -Path $SettingsDir | Out-Null
}
if (-not (Test-Path $GlobalSettings)) {
    '{}' | Set-Content -Path $GlobalSettings -Encoding UTF8
}

# Load existing settings, defaulting to an empty object.
$raw = Get-Content -Path $GlobalSettings -Raw -Encoding UTF8
$settings = $raw | ConvertFrom-Json

# Ensure the top-level hooks object exists.
if (-not (Get-Member -InputObject $settings -Name 'hooks' -MemberType NoteProperty)) {
    $settings | Add-Member -MemberType NoteProperty -Name 'hooks' -Value ([PSCustomObject]@{})
}

# Helper: remove hook entries whose command matches any of the provided paths.
# Each top-level entry can contain multiple hooks; we drop the whole entry if
# any of its hook commands match, then re-add the canonical definition below.
function Remove-ProjectHooks {
    param(
        [object[]] $Entries,
        [string[]] $Commands
    )
    if (-not $Entries) { return @() }
    return @($Entries | Where-Object {
        $entry = $_
        $match = $false
        foreach ($h in $entry.hooks) {
            if ($h.command -and ($Commands -contains $h.command)) {
                $match = $true
                break
            }
        }
        -not $match
    })
}

$h = $settings.hooks

# Stop — play an audio alert when Claude finishes a task
$stopEntries  = Remove-ProjectHooks -Entries $h.Stop -Commands @($NotifyCmd)
$stopEntries += [PSCustomObject]@{
    hooks = @([PSCustomObject]@{ type = 'command'; command = $NotifyCmd })
}

# Notification — play an audio alert on permission/elicitation prompts
$notifEntries  = Remove-ProjectHooks -Entries $h.Notification -Commands @($NotifyCmd)
$notifEntries += [PSCustomObject]@{
    matcher = 'permission_prompt|elicitation_dialog'
    hooks   = @([PSCustomObject]@{ type = 'command'; command = $NotifyCmd })
}

# PostToolUse — auto-format files after Write/Edit
$postEntries  = Remove-ProjectHooks -Entries $h.PostToolUse -Commands @($FormatCmd)
$postEntries += [PSCustomObject]@{
    matcher = 'Write|Edit'
    hooks   = @([PSCustomObject]@{ type = 'command'; command = $FormatCmd })
}

# Write the three hook lists back, creating the properties if absent.
foreach ($prop in @('Stop', 'Notification', 'PostToolUse')) {
    if (Get-Member -InputObject $h -Name $prop -MemberType NoteProperty) {
        $h.$prop = switch ($prop) {
            'Stop'         { $stopEntries }
            'Notification' { $notifEntries }
            'PostToolUse'  { $postEntries }
        }
    } else {
        $h | Add-Member -MemberType NoteProperty -Name $prop -Value (switch ($prop) {
            'Stop'         { $stopEntries }
            'Notification' { $notifEntries }
            'PostToolUse'  { $postEntries }
        })
    }
}

# Serialize with enough depth to capture nested arrays/objects.
$settings | ConvertTo-Json -Depth 10 | Set-Content -Path $GlobalSettings -Encoding UTF8

Write-Host "Hooks installed to $GlobalSettings"
Write-Host "  Stop             -> $NotifyCmd"
Write-Host "  Notification     -> $NotifyCmd"
Write-Host "  PostToolUse      -> $FormatCmd"
