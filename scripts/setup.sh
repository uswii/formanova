#!/bin/bash

# =============================================================================
# FormaNova Frontend - Complete Setup Script (with Fallbacks)
# =============================================================================
# Run this ONCE after cloning the repo:
#   chmod +x scripts/setup.sh && ./scripts/setup.sh
#
# Features:
#   - Multiple fallback options for each step
#   - Works with systemd OR PM2
#   - Auto-detects best installation method
#   - Comprehensive error handling
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
SERVICE_NAME="formanova-frontend"
LOG_DIR="$PROJECT_DIR/logs"
PORT=8010

# Make all scripts executable at the start
chmod +x "$SCRIPTS_DIR"/*.sh 2>/dev/null || true

# Track which method we're using
USE_SYSTEMD=true
USE_PM2=false

echo ""
echo -e "${BLUE}=============================================="
echo "  FormaNova Frontend - Complete Setup"
echo -e "==============================================${NC}"
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

# =============================================================================
# Helper Functions
# =============================================================================

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}$1${NC}"
}

# =============================================================================
# Step 1: Check/Install Node.js (Multiple Fallbacks)
# =============================================================================
echo -e "${YELLOW}[1/8] Checking Node.js...${NC}"

install_node_nodesource() {
    echo "  Trying NodeSource..."
    if command -v apt &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - 2>/dev/null
        sudo apt install -y nodejs 2>/dev/null
        return $?
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - 2>/dev/null
        sudo yum install -y nodejs 2>/dev/null
        return $?
    fi
    return 1
}

install_node_nvm() {
    echo "  Trying NVM..."
    export NVM_DIR="$HOME/.nvm"
    
    # Install nvm if not present
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash 2>/dev/null
    fi
    
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    if command -v nvm &> /dev/null; then
        nvm install 18 2>/dev/null
        nvm use 18 2>/dev/null
        return $?
    fi
    return 1
}

install_node_snap() {
    echo "  Trying Snap..."
    if command -v snap &> /dev/null; then
        sudo snap install node --classic --channel=18 2>/dev/null
        return $?
    fi
    return 1
}

install_node_brew() {
    echo "  Trying Homebrew..."
    if command -v brew &> /dev/null; then
        brew install node@18 2>/dev/null
        return $?
    fi
    return 1
}

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log_success "Node.js $NODE_VERSION already installed"
else
    log_warning "Node.js not found. Installing..."
    
    # Try multiple methods
    if install_node_nodesource; then
        log_success "Installed via NodeSource"
    elif install_node_nvm; then
        log_success "Installed via NVM"
    elif install_node_snap; then
        log_success "Installed via Snap"
    elif install_node_brew; then
        log_success "Installed via Homebrew"
    else
        log_error "Failed to install Node.js. Please install manually:"
        echo "  https://nodejs.org/en/download/"
        exit 1
    fi
fi

# Verify node works
if ! command -v node &> /dev/null; then
    log_error "Node.js installation failed. Please install manually."
    exit 1
fi

NODE_VERSION=$(node -v)
log_success "Using Node.js $NODE_VERSION"

# =============================================================================
# Step 2: Install npm dependencies
# =============================================================================
echo ""
echo -e "${YELLOW}[2/8] Installing npm dependencies...${NC}"

cd "$PROJECT_DIR"

if npm install; then
    log_success "Dependencies installed"
else
    log_warning "npm install failed, trying with --legacy-peer-deps..."
    if npm install --legacy-peer-deps; then
        log_success "Dependencies installed (with legacy peer deps)"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
fi

# =============================================================================
# Step 3: Install serve (local install - most reliable)
# =============================================================================
echo ""
echo -e "${YELLOW}[3/8] Installing serve for production...${NC}"

# Check if serve already exists anywhere
if command -v serve &> /dev/null; then
    SERVE_PATH=$(which serve)
    log_success "Serve found: $SERVE_PATH"
elif [ -f "$PROJECT_DIR/node_modules/.bin/serve" ]; then
    SERVE_PATH="$PROJECT_DIR/node_modules/.bin/serve"
    log_success "Serve found locally: $SERVE_PATH"
else
    # Install locally (most reliable - no permission issues)
    log_info "Installing serve locally..."
    npm install serve --save-dev || npm install serve
    SERVE_PATH="$PROJECT_DIR/node_modules/.bin/serve"
    
    if [ -f "$SERVE_PATH" ]; then
        log_success "Serve installed: $SERVE_PATH"
    else
        log_error "Serve installation failed!"
        echo "  Try manually: npm install serve --save-dev"
        exit 1
    fi
fi

# =============================================================================
# Step 4: Create .env file
# =============================================================================
echo ""
echo -e "${YELLOW}[4/8] Creating environment file...${NC}"

if [ -f "$PROJECT_DIR/.env" ]; then
    log_success ".env file already exists"
else
    cat > "$PROJECT_DIR/.env" << 'EOF'
# FormaNova Frontend Environment Variables
# These connect to Lovable Cloud (Supabase)

VITE_SUPABASE_URL=https://volhgtspbvgxavqgueqc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvbGhndHNwYnZneGF2cWd1ZXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjE5NDAsImV4cCI6MjA4MTMzNzk0MH0.Hc87OH2ipq4XgNXesDB7plggk2hk-azhaIgOpVJyaaY
VITE_SUPABASE_PROJECT_ID=volhgtspbvgxavqgueqc
EOF
    log_success ".env file created"
fi

# =============================================================================
# Step 5: Build the project
# =============================================================================
echo ""
echo -e "${YELLOW}[5/8] Building production bundle...${NC}"

if npm run build; then
    log_success "Build complete (files in dist/)"
else
    log_error "Build failed. Check for errors above."
    exit 1
fi

# =============================================================================
# Step 6: Create logs directory
# =============================================================================
echo ""
echo -e "${YELLOW}[6/8] Creating logs directory...${NC}"

mkdir -p "$LOG_DIR"
log_success "Logs directory: $LOG_DIR"

# =============================================================================
# Step 7: Setup Process Manager (systemd with PM2 fallback)
# =============================================================================
echo ""
echo -e "${YELLOW}[7/8] Setting up process manager...${NC}"

setup_systemd() {
    echo "  Trying systemd..."
    
    # Check if systemd is available
    if ! command -v systemctl &> /dev/null; then
        return 1
    fi
    
    # Check if we have sudo access
    if ! sudo -n true 2>/dev/null; then
        echo "  (Need sudo for systemd)"
        if ! sudo true; then
            return 1
        fi
    fi
    
    # Create systemd service file
    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=FormaNova Frontend Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$SERVE_PATH -s dist -l tcp://0.0.0.0:$PORT
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/formanova.log
StandardError=append:$LOG_DIR/formanova-error.log
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/v18/bin

[Install]
WantedBy=multi-user.target
EOF

    # Reload and enable for auto-start on boot
    sudo systemctl daemon-reload
    sudo systemctl enable ${SERVICE_NAME}.service
    
    # Ensure the service persists after logout
    echo "  Enabling lingering for $USER..."
    sudo loginctl enable-linger $USER 2>/dev/null || true
    
    return 0
}

setup_pm2() {
    echo "  Trying PM2..."
    
    # Install PM2 if not present
    if ! command -v pm2 &> /dev/null; then
        if ! npm install -g pm2 2>/dev/null; then
            if ! sudo npm install -g pm2 2>/dev/null; then
                npm install pm2
            fi
        fi
    fi
    
    # Find PM2
    if command -v pm2 &> /dev/null; then
        PM2_PATH=$(which pm2)
    else
        PM2_PATH="$PROJECT_DIR/node_modules/.bin/pm2"
    fi
    
    if [ ! -f "$PM2_PATH" ] && ! command -v pm2 &> /dev/null; then
        return 1
    fi
    
    # Create PM2 ecosystem file
    cat > "$PROJECT_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: '${SERVICE_NAME}',
    script: '${SERVE_PATH}',
    args: '-s dist -l tcp://0.0.0.0:${PORT}',
    cwd: '${PROJECT_DIR}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    out_file: '${LOG_DIR}/formanova.log',
    error_file: '${LOG_DIR}/formanova-error.log',
    merge_logs: true
  }]
};
EOF

    # Setup PM2 startup (auto-start on boot)
    pm2 startup 2>/dev/null || sudo env PATH=$PATH:$(dirname $(which node)) $(which pm2) startup systemd -u $USER --hp $HOME 2>/dev/null || true
    
    return 0
}

# Try systemd first, fallback to PM2
if setup_systemd; then
    USE_SYSTEMD=true
    USE_PM2=false
    log_success "Using systemd for process management"
elif setup_pm2; then
    USE_SYSTEMD=false
    USE_PM2=true
    log_success "Using PM2 for process management (systemd fallback)"
else
    log_warning "No process manager available. Will run in foreground."
    USE_SYSTEMD=false
    USE_PM2=false
fi

# Save config for other scripts
cat > "$PROJECT_DIR/.formanova-config" << EOF
USE_SYSTEMD=$USE_SYSTEMD
USE_PM2=$USE_PM2
SERVICE_NAME=$SERVICE_NAME
PORT=$PORT
LOG_DIR=$LOG_DIR
SERVE_PATH=$SERVE_PATH
PROJECT_DIR=$PROJECT_DIR
EOF

# =============================================================================
# Step 8: Start the service
# =============================================================================
echo ""
echo -e "${YELLOW}[8/8] Starting FormaNova service...${NC}"

if [ "$USE_SYSTEMD" = true ]; then
    # Stop any existing instance first
    sudo systemctl stop ${SERVICE_NAME}.service 2>/dev/null || true
    
    # Start fresh
    sudo systemctl start ${SERVICE_NAME}.service
    sleep 2
    
    if sudo systemctl is-active --quiet ${SERVICE_NAME}.service; then
        # Verify it's enabled for boot
        sudo systemctl enable ${SERVICE_NAME}.service 2>/dev/null || true
        log_success "Service started via systemd (auto-starts on boot)"
    else
        log_error "Systemd start failed. Checking logs..."
        sudo journalctl -u ${SERVICE_NAME}.service -n 5 --no-pager 2>/dev/null || true
        echo ""
        log_warning "Trying PM2 as fallback..."
        setup_pm2
        USE_SYSTEMD=false
        USE_PM2=true
    fi
fi

if [ "$USE_PM2" = true ]; then
    cd "$PROJECT_DIR"
    pm2 start ecosystem.config.js 2>/dev/null || $PROJECT_DIR/node_modules/.bin/pm2 start ecosystem.config.js
    pm2 save 2>/dev/null || true
    sleep 2
    log_success "Service started via PM2"
fi

if [ "$USE_SYSTEMD" = false ] && [ "$USE_PM2" = false ]; then
    log_warning "Starting in foreground mode..."
    echo "Run this command to start manually:"
    echo "  $SERVE_PATH -s dist -l tcp://0.0.0.0:$PORT"
fi

# =============================================================================
# Done!
# =============================================================================
echo ""
echo -e "${BLUE}=============================================="
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# Get IP address
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo -e "Frontend URL:      ${GREEN}http://0.0.0.0:$PORT${NC}"
echo -e "                   ${GREEN}http://$IP_ADDR:$PORT${NC}"
echo ""
echo -e "Logs:              ${YELLOW}$LOG_DIR/formanova.log${NC}"
echo -e "Error logs:        ${YELLOW}$LOG_DIR/formanova-error.log${NC}"
echo ""

if [ "$USE_SYSTEMD" = true ]; then
    echo -e "Process Manager:   ${GREEN}systemd${NC}"
    echo ""
    echo -e "Commands:"
    echo -e "  Start:           ${BLUE}./scripts/start.sh${NC}"
    echo -e "  Stop:            ${BLUE}./scripts/stop.sh${NC}"
    echo -e "  Status:          ${BLUE}./scripts/status.sh${NC}"
    echo -e "  Logs:            ${BLUE}tail -f $LOG_DIR/formanova.log${NC}"
    echo ""
    echo -e "${GREEN}Auto-starts on system boot!${NC}"
elif [ "$USE_PM2" = true ]; then
    echo -e "Process Manager:   ${GREEN}PM2${NC}"
    echo ""
    echo -e "Commands:"
    echo -e "  Start:           ${BLUE}./scripts/start.sh${NC}"
    echo -e "  Stop:            ${BLUE}./scripts/stop.sh${NC}"
    echo -e "  Status:          ${BLUE}pm2 status${NC}"
    echo -e "  Logs:            ${BLUE}pm2 logs ${SERVICE_NAME}${NC}"
    echo ""
    echo -e "${GREEN}Auto-starts on system boot (if pm2 startup was configured)${NC}"
else
    echo -e "Process Manager:   ${YELLOW}None (manual mode)${NC}"
    echo ""
    echo -e "To start manually:"
    echo -e "  ${BLUE}$SERVE_PATH -s dist -l tcp://0.0.0.0:$PORT${NC}"
fi

echo ""
