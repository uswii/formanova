#!/bin/bash

# =============================================================================
# FormaNova Frontend - Update Script (Pull & Rebuild)
# =============================================================================
# Run this to pull latest code and rebuild:
#   ./scripts/update.sh
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get absolute path to project
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$PROJECT_DIR/scripts"

echo ""
echo -e "${BLUE}=============================================="
echo "  FormaNova Frontend - Update & Rebuild"
echo -e "==============================================${NC}"
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

cd "$PROJECT_DIR" || exit 1

# =============================================================================
# Step 1: Stop the service
# =============================================================================
echo -e "${YELLOW}[1/6] Stopping service...${NC}"

if [ -f "$SCRIPTS_DIR/stop.sh" ]; then
    "$SCRIPTS_DIR/stop.sh" 2>/dev/null || true
else
    sudo systemctl stop formanova-frontend.service 2>/dev/null || true
    sudo systemctl stop formanova.service 2>/dev/null || true
    pm2 stop formanova-frontend 2>/dev/null || true
fi
echo -e "${GREEN}✓ Service stopped${NC}"

# =============================================================================
# Step 2: Backup .env files (preserve local config)
# =============================================================================
echo -e "${YELLOW}[2/7] Backing up .env files...${NC}"

ENV_BACKUP_DIR="$PROJECT_DIR/.env-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ENV_BACKUP_DIR"

# Backup all .env files
if [ -f "$PROJECT_DIR/.env" ]; then
    cp "$PROJECT_DIR/.env" "$ENV_BACKUP_DIR/.env"
    echo "  Backed up .env"
fi
if [ -f "$PROJECT_DIR/temporal-backend/.env" ]; then
    cp "$PROJECT_DIR/temporal-backend/.env" "$ENV_BACKUP_DIR/temporal-backend.env"
    echo "  Backed up temporal-backend/.env"
fi
echo -e "${GREEN}✓ Environment files backed up to $ENV_BACKUP_DIR${NC}"

# =============================================================================
# Step 3: Stash local changes (if any)
# =============================================================================
echo -e "${YELLOW}[3/7] Checking for local changes...${NC}"

if git diff --quiet 2>/dev/null; then
    echo -e "${GREEN}✓ No local changes${NC}"
else
    echo "  Stashing local changes..."
    git stash push -m "Auto-stash before update $(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✓ Local changes stashed${NC}"
fi

# =============================================================================
# Step 4: Pull latest code
# =============================================================================
echo -e "${YELLOW}[4/7] Pulling latest code...${NC}"

git fetch origin
CURRENT_BRANCH=$(git branch --show-current)
git checkout "$CURRENT_BRANCH"
git pull origin "$CURRENT_BRANCH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Code updated from origin/$CURRENT_BRANCH${NC}"
    # Restore execute permissions on scripts (git doesn't always preserve them)
    chmod +x "$SCRIPTS_DIR"/*.sh 2>/dev/null || true
    echo -e "${GREEN}✓ Script permissions restored${NC}"
else
    echo -e "${RED}✗ Git pull failed${NC}"
    exit 1
fi

# =============================================================================
# Step 5: Restore .env files
# =============================================================================
echo -e "${YELLOW}[5/7] Restoring .env files...${NC}"

if [ -f "$ENV_BACKUP_DIR/.env" ]; then
    cp "$ENV_BACKUP_DIR/.env" "$PROJECT_DIR/.env"
    echo "  Restored .env"
fi
if [ -f "$ENV_BACKUP_DIR/temporal-backend.env" ]; then
    mkdir -p "$PROJECT_DIR/temporal-backend"
    cp "$ENV_BACKUP_DIR/temporal-backend.env" "$PROJECT_DIR/temporal-backend/.env"
    echo "  Restored temporal-backend/.env"
fi
rm -rf "$ENV_BACKUP_DIR"
echo -e "${GREEN}✓ Environment files restored${NC}"

# =============================================================================
# Step 6: Install dependencies
# =============================================================================
echo -e "${YELLOW}[6/7] Installing dependencies...${NC}"

if command -v bun &> /dev/null; then
    bun install
elif command -v npm &> /dev/null; then
    npm install --legacy-peer-deps
else
    echo -e "${RED}✗ Neither bun nor npm found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Ensure sharp & svgo are installed (needed by vite-plugin-image-optimizer)
echo "  Checking image optimizer deps (sharp, svgo)..."
if command -v bun &> /dev/null; then
    bun add -D sharp svgo 2>/dev/null || true
elif command -v npm &> /dev/null; then
    npm install -D sharp svgo --legacy-peer-deps 2>/dev/null || true
fi
echo -e "${GREEN}✓ Image optimizer deps ready${NC}"

# =============================================================================
# Step 7: Build the project
# =============================================================================
echo -e "${YELLOW}[7/7] Building project...${NC}"

if command -v bun &> /dev/null; then
    bun run build
elif command -v npm &> /dev/null; then
    npm run build
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build completed${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# =============================================================================
# Step 8: Restart auth service (if available)
# =============================================================================
echo -e "${YELLOW}[8/9] Restarting auth service...${NC}"

if systemctl --user list-unit-files 2>/dev/null | grep -q "formanova-auth.service"; then
    systemctl --user restart formanova-auth.service 2>/dev/null && \
        echo -e "${GREEN}✓ Auth service restarted${NC}" || \
        echo -e "${YELLOW}⚠ Auth service restart skipped (not running as user service)${NC}"
else
    echo -e "${YELLOW}⚠ Auth service not found (skipping)${NC}"
fi

# =============================================================================
# Step 9: Start the frontend service
# =============================================================================
echo -e "${YELLOW}[9/9] Starting frontend service...${NC}"

if [ -f "$SCRIPTS_DIR/start.sh" ]; then
    "$SCRIPTS_DIR/start.sh"
else
    sudo systemctl start formanova-frontend.service 2>/dev/null || pm2 start formanova-frontend 2>/dev/null
fi

echo ""
echo -e "${GREEN}=============================================="
echo "  Update Complete!"
echo -e "==============================================${NC}"
echo ""
echo "  Your .env files were preserved during update."
echo "  Run './scripts/status.sh' to verify"
echo ""
