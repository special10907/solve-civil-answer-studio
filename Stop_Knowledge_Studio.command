#!/bin/bash
# Knowledge Studio: Stark Edition - Stop Script
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "--------------------------------------------------"
echo "   Knowledge Studio: Stark Edition v27.3"
echo "   Stopping all systems... Please wait."
echo "--------------------------------------------------"

chmod +x ./run-local.command
./run-local.command stop

echo ""
echo "--------------------------------------------------"
echo "   ALL SYSTEMS STOPPED. Glory to Stark."
echo "   You can now close this terminal window."
echo "--------------------------------------------------"
sleep 3
exit 0
