#!/bin/bash

# =============================================================================
# FormaNova Frontend - Status Script (with Fallbacks)
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/.formanova-config"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load config
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    SERVICE_NAME="formanova-frontend"
    PORT=8010
    LOG_DIR="$PROJECT_DIR/logs"
fi

echo ""
echo -e "${BLUE}=============================================="
echo "  FormaNova Frontend Status"
echo -e "==============================================${NC}"
echo ""

RUNNING=false
MANAGER="none"

# Check systemd
if command -v systemctl &> /dev/null; then
    if sudo systemctl list-unit-files 2>/dev/null | grep -q "${SERVICE_NAME}.service"; then
        if sudo systemctl is-active --quiet ${SERVICE_NAME}.service 2>/dev/null; then
            echo -e "Systemd:    ${GREEN}● Running${NC}"
            RUNNING=true
            MANAGER="systemd"
        else
            echo -e "Systemd:    ${RED}○ Stopped${NC}"
        fi
        
        if sudo systemctl is-enabled --quiet ${SERVICE_NAME}.service 2>/dev/null; then
            echo -e "Auto-start: ${GREEN}Enabled${NC}"
        else
            echo -e "Auto-start: ${YELLOW}Disabled${NC}"
        fi
    fi
fi

# Check PM2
if command -v pm2 &> /dev/null || [ -f "$PROJECT_DIR/node_modules/.bin/pm2" ]; then
    PM2_CMD="pm2"
    if ! command -v pm2 &> /dev/null; then
        PM2_CMD="$PROJECT_DIR/node_modules/.bin/pm2"
    fi
    
    if $PM2_CMD list 2>/dev/null | grep -q "$SERVICE_NAME"; then
        STATUS=$($PM2_CMD jlist 2>/dev/null | grep -o "\"status\":\"[^\"]*\"" | head -1 | cut -d'"' -f4)
        if [ "$STATUS" = "online" ]; then
            echo -e "PM2:        ${GREEN}● Running${NC}"
            RUNNING=true
            MANAGER="pm2"
        else
            echo -e "PM2:        ${RED}○ $STATUS${NC}"
        fi
    fi
fi

# Check if port is in use
if command -v lsof &> /dev/null; then
    if lsof -i:$PORT &> /dev/null; then
        if [ "$RUNNING" = false ]; then
            echo -e "Port $PORT: ${GREEN}● In use (unknown process)${NC}"
            RUNNING=true
        fi
    else
        if [ "$RUNNING" = false ]; then
            echo -e "Port $PORT: ${RED}○ Not in use${NC}"
        fi
    fi
fi

# URLs
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo ""
echo -e "URL:        ${GREEN}http://0.0.0.0:$PORT${NC}"
echo -e "            ${GREEN}http://$IP_ADDR:$PORT${NC}"

# Log files
echo ""
echo -e "Logs:       ${YELLOW}$LOG_DIR/formanova.log${NC}"
echo -e "Errors:     ${YELLOW}$LOG_DIR/formanova-error.log${NC}"

# Recent logs
echo ""
echo -e "${BLUE}Recent logs:${NC}"
if [ -f "$LOG_DIR/formanova.log" ]; then
    tail -5 "$LOG_DIR/formanova.log" 2>/dev/null || echo "  (empty)"
else
    echo "  (no logs yet)"
fi

echo ""

# Overall status
if [ "$RUNNING" = true ]; then
    echo -e "Overall:    ${GREEN}● RUNNING ($MANAGER)${NC}"
else
    echo -e "Overall:    ${RED}○ STOPPED${NC}"
fi

echo ""
