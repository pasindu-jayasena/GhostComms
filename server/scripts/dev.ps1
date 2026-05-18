# Free port 3001 and start GhostComms server (Node 22.5+)
$conn = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($conn) {
  $conn | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
}
Set-Location $PSScriptRoot\..
node --watch src/app.js
