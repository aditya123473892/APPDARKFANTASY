$workspace = Split-Path -Parent $PSScriptRoot
Start-Process -FilePath cmd.exe -ArgumentList '/k', 'title DARKFANTASY Connection Check & rtk proxy node scripts\check-local.cjs' `
    -WorkingDirectory $workspace -WindowStyle Normal
