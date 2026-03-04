#!/bin/bash

# =============================================================================
# FormaNova Frontend - Start Script (with Fallbacks & Auto-Install)
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/.formanova-config"
LOG_DIR="$PROJECT_DIR/logs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load config
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    # Defaults
    SERVICE_NAME="formanova-frontend"
    PORT=8010
    LOG_DIR="$PROJECT_DIR/logs"
    USE_SYSTEMD=false
    USE_PM2=false
fi

# Ensure log directory exists
mkdir -p "$LOG_DIR"
# Fix ownership if log files were created by root (e.g. via sudo systemctl)
if [ -d "$LOG_DIR" ]; then
    touch "$LOG_DIR/formanova.log" "$LOG_DIR/formanova-error.log" 2>/dev/null
    if [ ! -w "$LOG_DIR/formanova.log" ]; then
        sudo chown "$(whoami)" "$LOG_DIR/formanova.log" "$LOG_DIR/formanova-error.log" 2>/dev/null || \
        chmod a+w "$LOG_DIR/formanova.log" "$LOG_DIR/formanova-error.log" 2>/dev/null || true
    fi
fi

echo ""
echo -e "${YELLOW}Starting FormaNova...${NC}"

# Check if dist folder exists, if not build first
if [ ! -d "$PROJECT_DIR/dist" ]; then
    echo -e "${YELLOW}No dist folder found, building...${NC}"
    cd "$PROJECT_DIR"
    if command -v bun &> /dev/null; then
        bun install && bun run build
    elif command -v npm &> /dev/null; then
        npm install --legacy-peer-deps && npm run build
    fi
fi

# Try systemd (system-level service)
if command -v systemctl &> /dev/null; then
    # Check for system service (formanova or formanova-frontend)
    for svc in "${SERVICE_NAME}" "formanova"; do
        if sudo systemctl list-unit-files 2>/dev/null | grep -q "${svc}.service"; then
            sudo systemctl start ${svc}.service
            sleep 2
            if sudo systemctl is-active --quiet ${svc}.service; then
                echo -e "${GREEN}✓ Started via systemd (${svc})${NC}"
                echo ""
                echo -e "URL: ${GREEN}http://0.0.0.0:$PORT${NC}"
                echo -e "     ${GREEN}http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT${NC}"
                echo ""
                echo -e "Logs: ${YELLOW}sudo journalctl -u ${svc} -f${NC}"
                echo -e "      ${YELLOW}tail -f $LOG_DIR/formanova.log${NC}"
                exit 0
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
    
    if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
        cd "$PROJECT_DIR"
        $PM2_CMD start ecosystem.config.js 2>/dev/null
        $PM2_CMD save 2>/dev/null || true
        echo -e "${GREEN}✓ Started via PM2${NC}"
        echo ""
        echo -e "URL: ${GREEN}http://0.0.0.0:$PORT${NC}"
        echo ""
        echo -e "Logs: ${YELLOW}$PM2_CMD logs $SERVICE_NAME${NC}"
        exit 0
    fi
fi

# Check for serve, auto-install if missing
SERVE_PATH=$(which serve 2>/dev/null || echo "$PROJECT_DIR/node_modules/.bin/serve")
if [ ! -f "$SERVE_PATH" ] && ! command -v serve &> /dev/null; then
    echo -e "${YELLOW}Installing serve...${NC}"
    cd "$PROJECT_DIR"
    if command -v bun &> /dev/null; then
        bun add serve
    elif command -v npm &> /dev/null; then
        npm install serve --save-dev
    fi
    SERVE_PATH="$PROJECT_DIR/node_modules/.bin/serve"
fi

# Fallback: Direct serve (background mode)
if [ -f "$SERVE_PATH" ] || command -v serve &> /dev/null; then
    SERVE_CMD=$(command -v serve 2>/dev/null || echo "$SERVE_PATH")
    
    # Run in background with nohup
    echo -e "${YELLOW}Starting serve in background...${NC}"
    cd "$PROJECT_DIR"
    nohup $SERVE_CMD -s dist -l tcp://0.0.0.0:$PORT >> "$LOG_DIR/formanova.log" 2>> "$LOG_DIR/formanova-error.log" &
    SERVE_PID=$!
    echo $SERVE_PID > "$PROJECT_DIR/.formanova.pid"
    
    sleep 2
    if kill -0 "$SERVE_PID" 2>/dev/null; then
        echo -e "${GREEN}✓ Started via serve (PID: $SERVE_PID)${NC}"
        echo ""
        echo -e "URL: ${GREEN}http://0.0.0.0:$PORT${NC}"
        echo -e "     ${GREEN}http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT${NC}"
        echo ""
        echo -e "Logs: ${YELLOW}tail -f $LOG_DIR/formanova.log${NC}"
        exit 0
    else
        echo -e "${RED}Error: serve failed to start${NC}"
        exit 1
    fi
else
    echo -e "${RED}Error: Failed to install serve.${NC}"
    echo "Try running: npm install -g serve"
    exit 1
fi
