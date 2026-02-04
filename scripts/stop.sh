#!/bin/bash

# =============================================================================
# FormaNova Frontend - Stop Script (with Fallbacks)
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/.formanova-config"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load config
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    SERVICE_NAME="formanova"
    PORT=8010
fi

echo ""
echo -e "${YELLOW}Stopping FormaNova...${NC}"

STOPPED=false

# Try systemd (system-level services)
if command -v systemctl &> /dev/null; then
    for svc in "${SERVICE_NAME}" "formanova-frontend"; do
        if sudo systemctl list-unit-files 2>/dev/null | grep -q "${svc}.service"; then
            sudo systemctl stop ${svc}.service 2>/dev/null
            if ! sudo systemctl is-active --quiet ${svc}.service 2>/dev/null; then
                echo -e "${GREEN}✓ Stopped systemd service (${svc})${NC}"
                STOPPED=true
            fi
        fi
    done
fi

# Try PM2
if command -v pm2 &> /dev/null || [ -f "$PROJECT_DIR/node_modules/.bin/pm2" ]; then
    PM2_CMD="pm2"
    if ! command -v pm2 &> /dev/null; then
        PM2_CMD="$PROJECT_DIR/node_modules/.bin/pm2"
    fi
    
    if $PM2_CMD list 2>/dev/null | grep -q "$SERVICE_NAME"; then
        $PM2_CMD stop $SERVICE_NAME 2>/dev/null
        $PM2_CMD delete $SERVICE_NAME 2>/dev/null
        echo -e "${GREEN}✓ Stopped PM2 process${NC}"
        STOPPED=true
    fi
fi

# Check for PID file from serve background process
PID_FILE="$PROJECT_DIR/.formanova.pid"
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        echo -e "${GREEN}✓ Stopped serve process (PID: $PID)${NC}"
        STOPPED=true
    fi
    rm -f "$PID_FILE"
fi

# Kill any remaining serve processes on our port
if command -v lsof &> /dev/null; then
    PID=$(lsof -t -i:${PORT:-8010} 2>/dev/null)
    if [ -n "$PID" ]; then
        kill $PID 2>/dev/null
        echo -e "${GREEN}✓ Killed process on port ${PORT:-8010}${NC}"
        STOPPED=true
    fi
elif command -v fuser &> /dev/null; then
    fuser -k ${PORT:-8010}/tcp 2>/dev/null
    STOPPED=true
fi

if [ "$STOPPED" = true ]; then
    echo -e "${GREEN}✓ FormaNova stopped${NC}"
else
    echo -e "${YELLOW}No running instance found${NC}"
fi
