#!/bin/bash

# =============================================================================
# FormaNova Frontend - Restart Script (Build & Restart)
# Run after a manual `git pull` to rebuild and restart the frontend service.
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "Restarting FormaNova..."
echo ""

# Stop frontend first
"$PROJECT_DIR/scripts/stop.sh"

echo ""

# Build latest code
echo -e "${YELLOW}Building project...${NC}"
cd "$PROJECT_DIR"
if command -v bun &> /dev/null; then
    bun install && bun run build
elif command -v npm &> /dev/null; then
    npm install --legacy-peer-deps && npm run build
else
    echo -e "${RED}✗ Neither bun nor npm found${NC}"
    exit 1
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed — service not restarted${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build complete${NC}"

echo ""

# Restart auth service if available (system-level)
echo -e "${YELLOW}Restarting auth service...${NC}"
if sudo systemctl list-unit-files 2>/dev/null | grep -q "formanova-auth.service"; then
    sudo systemctl restart formanova-auth.service 2>/dev/null && \
        echo -e "${GREEN}✓ Auth service restarted${NC}" || \
        echo -e "${YELLOW}⚠ Auth service restart skipped${NC}"
else
    echo -e "${YELLOW}⚠ Auth service not found (skipping)${NC}"
fi

echo ""

# Restart frontend via systemd (preferred) or fallback to start.sh
echo -e "${YELLOW}Restarting frontend service...${NC}"
if sudo systemctl list-unit-files 2>/dev/null | grep -q "formanova-frontend.service"; then
    sudo systemctl restart formanova-frontend.service
    sleep 2
    if sudo systemctl is-active --quiet formanova-frontend.service; then
        echo -e "${GREEN}✓ formanova-frontend.service restarted${NC}"
    else
        echo -e "${RED}✗ Service failed to start — check: sudo journalctl -u formanova-frontend -n 50${NC}"
        exit 1
    fi
else
    "$PROJECT_DIR/scripts/start.sh"
fi

echo ""
echo -e "${GREEN}Done. Frontend is live.${NC}"
echo ""
