param([ValidateSet('both', 'backend', 'frontend')][string]$Service = 'both')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
foreach ($launcher in @('start-backend.cmd', 'start-frontend.cmd')) {
    if ($Service -ne 'both' -and $launcher -ne "start-$Service.cmd") { continue }
    Start-Process -FilePath cmd.exe -ArgumentList '/k', "scripts\$launcher" `
        -WorkingDirectory $workspace -WindowStyle Normal
}
