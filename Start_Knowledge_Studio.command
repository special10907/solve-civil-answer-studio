#!/bin/bash
# Knowledge Studio: Stark Edition - Start Script
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "--------------------------------------------------"
echo "   Knowledge Studio: Stark Edition v27.3"
echo "   Starting all systems... Please wait."
echo "--------------------------------------------------"

# 실행 권한 확인 및 부여
chmod +x ./run-local.command

# 기존 서비스 정지 후 재시작
./run-local.command stop > /dev/null 2>&1 || true
./run-local.command

echo ""
echo "--------------------------------------------------"
echo "   ALL SYSTEMS OPERATIONAL. Glory to Stark."
echo "   You can now close this terminal window."
echo "--------------------------------------------------"
sleep 3
exit 0
