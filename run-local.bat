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

echo [2/4] 백엔드 서버 시작...
start "Civil Answer Backend" cmd /k "cd /d "%~dp0backend" && npm start"

echo [3/4] 웹 서버 시작...
start "Civil Answer Web" cmd /k "cd /d "%~dp0" && py -3 -m http.server 8000"

echo [4/4] 브라우저 열기...
timeout /t 2 >nul
start "" "http://localhost:8000/solve_120.html"

echo.
echo 실행 완료:
echo - 백엔드: http://localhost:8787
echo - 웹앱:   http://localhost:8000/solve_120.html
echo.
echo 종료하려면 새로 열린 두 개의 cmd 창을 닫으세요.

exit /b 0