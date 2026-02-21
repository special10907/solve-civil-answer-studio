$api='https://api.github.com/repos/aquasecurity/trivy/releases/latest'
$r=Invoke-RestMethod -UseBasicParsing -Uri $api
Write-Host "Found release: $($r.tag_name)"
Write-Host "Available assets:"
$r.assets | ForEach-Object { Write-Host " - $($_.name)" }

# Choose an asset that targets Windows amd64/x64
$asset = $r.assets | Where-Object { $_.name -match 'windows' -and ($_.name -match 'amd64|x64|x86_64|win64|windows-amd64|windows_amd64|64bit|64-bit') } | Select-Object -First 1
if(-not $asset){ Write-Error 'No suitable windows amd64 asset found'; exit 2 }
$url = $asset.browser_download_url
Write-Host "Downloading $url"
Invoke-WebRequest -Uri $url -OutFile trivy.zip -UseBasicParsing
if(Test-Path trivy.zip){ Expand-Archive trivy.zip -DestinationPath trivy_dist -Force }
Write-Host "Contents:"
Get-ChildItem -Recurse trivy_dist | Select-Object FullName,Length | Format-Table -AutoSize
$trivyExe = Get-ChildItem -Recurse trivy_dist -Filter 'trivy.exe' | Select-Object -First 1
if(-not $trivyExe){ Write-Error 'trivy exe not found' ; exit 3 }
$exePath = $trivyExe.FullName
Write-Host "Using $exePath"
& $exePath fs . --security-checks vuln --format json -o trivy_report.json
Write-Host "Scan completed."
