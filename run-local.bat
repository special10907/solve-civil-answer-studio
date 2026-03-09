@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

cd /d "%~dp0"

set "BACKEND_PORT="
set "BACKEND_PORT_CANDIDATES=8787 8788 8789 8790 8791 8792 8793 8794 8795 8796 8797 8798 8799"
set "WEB_PORT="
set "WEB_PORT_CANDIDATES=18000 18001 18002 18003 18004 18005 8000"
set "WEB_URL="

if /I "%~1"=="stop" goto stop_services

echo [1/4] 실행 환경 확인 중...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 를 찾을 수 없습니다. 설치 후 다시 실행하세요.
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  echo Python Launcher ^(py^) 를 찾을 수 없습니다. 설치 후 다시 실행하세요.
  exit /b 1
)

if not exist "%~dp0server\index.js" (
  echo server\index.js 파일을 찾을 수 없습니다.
  exit /b 1
)

for /f "usebackq delims=" %%s in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports='%WEB_PORT_CANDIDATES%'.Split(' ',[System.StringSplitOptions]::RemoveEmptyEntries); $running=$false; foreach($port in $ports){ $a=Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue; if($a){$running=$true; break} }; if($running){'RUNNING'} else {'STOPPED'}"`) do set "RUN_STATE=%%s"
if /I "!RUN_STATE!"=="RUNNING" goto stop_services

for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$candidates='%BACKEND_PORT_CANDIDATES%'.Split(' ',[System.StringSplitOptions]::RemoveEmptyEntries); foreach($port in $candidates){ $used=Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue; if(-not $used){ [int]$port; break } }"`) do set "BACKEND_PORT=%%p"

if "%BACKEND_PORT%"=="" (
  for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0); $listener.Start(); $port=($listener.LocalEndpoint.Port); $listener.Stop(); $port"`) do set "BACKEND_PORT=%%p"
)

if "%BACKEND_PORT%"=="" (
  echo 사용 가능한 백엔드 포트를 찾지 못했습니다. 후보: %BACKEND_PORT_CANDIDATES%
  exit /b 1
)

for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$candidates='%WEB_PORT_CANDIDATES%'.Split(' ',[System.StringSplitOptions]::RemoveEmptyEntries); foreach($port in $candidates){ $used=Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue; if(-not $used){ [int]$port; break } }"`) do set "WEB_PORT=%%p"

if "%WEB_PORT%"=="" (
  echo 사용 가능한 웹 포트를 찾지 못했습니다. 후보: %WEB_PORT_CANDIDATES%
  exit /b 1
)

set "WEB_URL=http://localhost:%WEB_PORT%/solve_120.html"

echo [2/4] 서버 시작 중... ^(backend:%BACKEND_PORT%, web:%WEB_PORT%^)
for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:PORT='%BACKEND_PORT%'; $p=Start-Process -FilePath node -ArgumentList 'server/index.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden -PassThru; $p.Id"`) do set "BACKEND_PID=%%p"
for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath py -ArgumentList '-3','-m','http.server','%WEB_PORT%' -WorkingDirectory '%~dp0' -WindowStyle Hidden -PassThru; $p.Id"`) do set "WEB_PID=%%p"

echo [3/4] 브라우저 열기...
timeout /t 2 >nul
start "" "%WEB_URL%"

echo [4/4] 완료
echo.
echo 실행 정보:
echo - 백엔드: http://localhost:%BACKEND_PORT% ^(PID: !BACKEND_PID!^)
echo - 웹앱:   %WEB_URL% ^(PID: !WEB_PID!^)
echo.
echo 다시 run-local.bat 를 실행하면 자동 종료됩니다.
exit /b 0

:stop_services
echo [2/2] 실행 중인 서버 종료...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports='%BACKEND_PORT_CANDIDATES%'.Split(' ',[System.StringSplitOptions]::RemoveEmptyEntries); foreach($port in $ports){ $p=(Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess); if($p){Stop-Process -Id $p -Force} }" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports='%WEB_PORT_CANDIDATES%'.Split(' ',[System.StringSplitOptions]::RemoveEmptyEntries); foreach($port in $ports){ $p=(Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess); if($p){Stop-Process -Id $p -Force} }" >nul 2>nul
echo 종료 완료 ^(backend:%BACKEND_PORT_CANDIDATES%, web:%WEB_PORT_CANDIDATES%^)
exit /b 0