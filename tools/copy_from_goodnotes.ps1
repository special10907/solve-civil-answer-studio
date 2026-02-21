param(
    [string]$SourceDir = "H:\내 드라이브\GoodNotes\토목구조기술사 기출문제",
    [string]$DestDir = "C:\Users\BonMaker ENG\Desktop\사진공유\프로그래밍\solve",
    [switch]$OpenHtml
)

Write-Host "Copying PDF files from:`n  $SourceDir`nto`n  $DestDir`n" -ForegroundColor Cyan

if (-Not (Test-Path $SourceDir)) {
    Write-Host "Source directory not found: $SourceDir" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $DestDir -Force | Out-Null

$files = Get-ChildItem -Path $SourceDir -Include *.pdf -File -Recurse -ErrorAction SilentlyContinue
if (-Not $files) {
    Write-Host "No PDF files found under $SourceDir" -ForegroundColor Yellow
    exit 0
}

foreach ($f in $files) {
    $target = Join-Path $DestDir $f.Name
    Copy-Item -Path $f.FullName -Destination $target -Force
    Write-Host "Copied: $($f.Name)" -ForegroundColor Green
}

if ($OpenHtml) {
    $html = Join-Path $DestDir 'solve_120.html'
    if (Test-Path $html) {
        Start-Process $html
        Write-Host "Opened $html" -ForegroundColor Cyan
    } else {
        Write-Host "Cannot find solve_120.html in $DestDir" -ForegroundColor Red
    }
}

Write-Host "Done. You can now open solve_120.html and use the OCR UI to process the copied PDFs." -ForegroundColor Cyan
