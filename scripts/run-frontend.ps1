Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$lanAddress = & node -p "(require('os').networkInterfaces()['Wi-Fi'] || []).find(x => x.family === 'IPv4' && !x.internal)?.address || ''"
if ($lanAddress) {
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanAddress.Trim()
}
# Keep the terminal interactive so Expo displays its QR code and keyboard controls.
& rtk proxy npm start -- --offline --go --port 8081 --max-workers 2
exit $LASTEXITCODE
