#!/bin/bash

# =============================================================================
# FormaNova Frontend - Restart Script (with Fallbacks)
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "Restarting FormaNova..."
echo ""

# Stop frontend first
"$PROJECT_DIR/scripts/stop.sh"

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

# Then start frontend
"$PROJECT_DIR/scripts/start.sh"
