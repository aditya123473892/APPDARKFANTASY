Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$lan = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } |
    Select-Object -First 1
if ($lan) {
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = ($lan.IPv4Address | Select-Object -First 1).IPAddress
}
# Keep the terminal interactive so Expo displays its QR code and keyboard controls.
& rtk proxy npm start -- --lan --go --port 8081 --max-workers 2
exit $LASTEXITCODE
