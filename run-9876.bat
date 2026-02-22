@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

cd /d "%~dp0"

echo [1/4] 실행 환경 확인 중...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 가 설치되어 있지 않습니다.
  pause
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher 가 설치되어 있지 않습니다.
  pause
  exit /b 1
)

echo [2/4] 서버 시작 (Port: 9876, 8787)...
for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory '%~dp0backend' -WindowStyle Hidden -PassThru; $p.Id"`) do set "BACKEND_PID=%%p"
for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath py -ArgumentList '-3','-m','http.server','9876' -WorkingDirectory '%~dp0' -WindowStyle Hidden -PassThru; $p.Id"`) do set "WEB_PID=%%p"

echo [3/4] 브라우저 열기...
timeout /t 2 >nul
start "" "http://localhost:9876/solve_120.html"

echo [4/4] 완료
echo.
echo 실행 완료:
echo - 백엔드: http://localhost:8787 (PID: %BACKEND_PID%) 
echo - 웹앱:   http://localhost:9876/solve_120.html (PID: %WEB_PID%) 
echo.
pause
