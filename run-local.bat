@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

cd /d "%~dp0"

echo [1/4] 실행 환경 확인 중...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 설치 후 다시 실행하세요.
  pause
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher 가 설치되어 있지 않습니다. Python 설치 후 다시 실행하세요.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%s in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$a=Get-NetTCPConnection -LocalPort 8787,8000 -State Listen -ErrorAction SilentlyContinue; if($a){'RUNNING'} else {'STOPPED'}"`) do set "RUN_STATE=%%s"

if /I "%~1"=="stop" goto stop_services
if /I "%RUN_STATE%"=="RUNNING" goto stop_services

echo [2/4] 서버 시작...
for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory '%~dp0backend' -WindowStyle Hidden -PassThru; $p.Id"`) do set "BACKEND_PID=%%p"
for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath py -ArgumentList '-3','-m','http.server','8000' -WorkingDirectory '%~dp0' -WindowStyle Hidden -PassThru; $p.Id"`) do set "WEB_PID=%%p"

echo [3/4] 브라우저 열기...
timeout /t 2 >nul
start "" "http://localhost:8000/solve_120.html"

echo [4/4] 완료
echo.
echo 실행 완료:
echo - 백엔드: http://localhost:8787 ^(PID: %BACKEND_PID%^) 
echo - 웹앱:   http://localhost:8000/solve_120.html ^(PID: %WEB_PID%^) 
echo.
echo 다시 run-local.bat 를 실행하면 서버가 자동 종료됩니다.
exit /b 0

:stop_services
echo [2/2] 실행 중인 서버 종료...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=(Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess); if($p){Stop-Process -Id $p -Force}" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=(Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess); if($p){Stop-Process -Id $p -Force}" >nul 2>nul
echo 서버 종료 완료 ^(8787 / 8000^)
exit /b 0

exit /b 0