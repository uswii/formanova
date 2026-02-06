#!/bin/bash
# =============================================================================
# FormaNova Admin Dashboard Launcher
# Opens the admin dashboard in your default browser
# =============================================================================

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Determine the frontend URL
# Check if config file exists with custom URL
CONFIG_FILE="$(dirname "$0")/../.formanova-config"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Default to localhost, override with env or config
FRONTEND_URL="${FORMANOVA_URL:-http://localhost:8010}"

# Build admin URL (new route — requires Google sign-in + admin secret)
ADMIN_URL="${FRONTEND_URL}/admin"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         FormaNova Admin Dashboard                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Opening: ${YELLOW}${ADMIN_URL}${NC}"
echo -e "You will need to sign in with Google and enter the admin secret."
echo ""

# Detect OS and open browser
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open "$ADMIN_URL" 2>/dev/null &
    elif command -v gnome-open &> /dev/null; then
        gnome-open "$ADMIN_URL" 2>/dev/null &
    else
        echo "Could not detect browser. Open manually:"
        echo "$ADMIN_URL"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open "$ADMIN_URL"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    start "$ADMIN_URL"
else
    echo "Unknown OS. Open manually:"
    echo "$ADMIN_URL"
fi

echo -e "${GREEN}Admin dashboard opened in browser${NC}"
