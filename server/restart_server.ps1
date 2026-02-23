try {
  $conn = Get-NetTCPConnection -LocalPort 8787 -ErrorAction Stop
} catch {
  $conn = $null
}
if ($conn) {
  try { Stop-Process -Id $conn.OwningProcess -Force } catch {}
}
Set-Location 'c:\Users\BonMaker ENG\Desktop\사진공유\프로그래밍\solve\server'
Start-Process -FilePath node -ArgumentList 'index.js' -WindowStyle Hidden
Write-Output "Started node index.js (background)."
