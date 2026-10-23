Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
New-Item -ItemType Directory -Force -Path '.expo' | Out-Null
& rtk proxy npm start -- --lan --offline --port 8081 --max-workers 2 2>&1 |
    Tee-Object -FilePath '.expo/frontend.log'
exit $LASTEXITCODE
