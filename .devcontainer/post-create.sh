#!/bin/bash
# Post-create script for MeshMonitor DevContainer
# Runs once when the container is first created

# Don't use set -e - we want to handle errors gracefully
# set -e

echo "=========================================="
echo "  MeshMonitor DevContainer Setup"
echo "=========================================="
echo ""

# Track if there are non-critical warnings
HAS_WARNINGS=0

# Step 0: Configure Git (no .gitconfig mounted to avoid Windows locking issues)
echo "0. Configuring Git..."

# Configure safe.directory (required for mounted volumes from Windows)
git config --global --add safe.directory /workspace 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Git safe.directory configured"
else
    EXIT_CODE=$?
    echo "   ⚠ Failed to configure Git safe.directory (exit code: $EXIT_CODE)"
fi

# Set basic git config if not already set (user can override later)
if ! git config --global user.name >/dev/null 2>&1; then
    git config --global user.name "Developer" 2>&1
    echo "   ℹ Set default git user.name (override with: git config --global user.name 'Your Name')"
fi

if ! git config --global user.email >/dev/null 2>&1; then
    git config --global user.email "developer@localhost" 2>&1
    echo "   ℹ Set default git user.email (override with: git config --global user.email 'you@example.com')"
fi

echo ""

# Step 1: Initialize git submodules (needed for protobuf definitions)
echo "1. Initializing git submodules..."

# Check if protobufs are already present (e.g., from host mount)
if [ -f "protobufs/meshtastic/mesh.proto" ]; then
    echo "   ✓ Protobuf files already present (skipping submodule init)"
else
    # Try to initialize submodules with retry logic
    SUBMODULE_INIT_SUCCESS=0
    for attempt in 1 2 3; do
        echo "   Attempt $attempt/3: Fetching submodules..."
        if git submodule update --init --recursive 2>&1; then
            SUBMODULE_INIT_SUCCESS=1
            echo "   ✓ Git submodules initialized successfully"
            break
        else
            echo "   ⚠ Attempt $attempt failed"
            if [ $attempt -lt 3 ]; then
                echo "   Waiting 5 seconds before retry..."
                sleep 5
            fi
        fi
    done

    if [ $SUBMODULE_INIT_SUCCESS -eq 0 ]; then
        echo "   ⚠ Failed to initialize git submodules (network issue?)"
        echo "   This is likely due to DNS resolution issues inside the container."
        echo "   You can manually run later: git submodule update --init --recursive"
        HAS_WARNINGS=1
    fi
fi

# Step 2: Verify protobufs exist
echo ""
echo "2. Verifying Meshtastic protobuf definitions..."
if [ -f "protobufs/meshtastic/mesh.proto" ]; then
    echo "   ✓ Protobuf files found"
else
    echo "   ⚠ Protobuf files not found!"
    echo "   The protobufs submodule could not be initialized."
    echo "   Run manually when network is available: git submodule update --init --recursive"
    echo "   Note: Some features may not work without protobufs."
    HAS_WARNINGS=1
fi

# Step 2.5: Fix node_modules permissions (volume created by root)
echo ""
echo "2.5. Fixing node_modules volume permissions..."
if [ -d "/workspace/node_modules" ]; then
    if sudo chown -R node:node /workspace/node_modules 2>&1; then
        echo "   ✓ node_modules ownership fixed"
    else
        echo "   ⚠ Failed to fix node_modules ownership (continuing anyway)"
        HAS_WARNINGS=1
    fi
else
    echo "   ℹ node_modules doesn't exist yet (will be created by npm install)"
fi

# Step 3: Install npm dependencies
echo ""
echo "3. Installing npm dependencies (this may take a few minutes)..."

# Ensure cache directory exists with correct permissions
mkdir -p /home/node/.cache/puppeteer 2>&1 || true
mkdir -p /home/node/.npm 2>&1 || true

# Skip Puppeteer browser downloads (not needed for development)
export PUPPETEER_SKIP_DOWNLOAD=true
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
echo "   ℹ Skipping Puppeteer browser downloads"

if npm install 2>&1; then
    echo "   ✓ Dependencies installed successfully"
else
    echo "   ⚠ npm install failed (network issue?)"
    echo "   You can run 'npm install' manually when network is available"
    HAS_WARNINGS=1
fi

# Step 4: Auto-setup .env file if it doesn't exist
echo ""
echo "4. Setting up environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "   ✓ Created .env from .env.example"
        echo "   ℹ Configure MESHTASTIC_NODE_IP in .env to connect to your node"
    else
        echo "   ⚠ .env.example not found, skipping .env creation"
    fi
else
    echo "   ℹ .env already exists, skipping"
fi

# Step 5: Set up git hooks (if any)
echo ""
echo "5. Checking for git hooks..."
if [ -d ".git/hooks" ]; then
    echo "   ✓ Git hooks directory exists"
else
    echo "   ⚠ No git hooks configured"
fi

# Step 6: Install Claude Code CLI (always, for in-container usage)
echo ""
echo "6. Installing Claude Code CLI..."
echo "   Installing @anthropic-ai/claude-code globally..."
# Install globally for convenience (npx requires network on each run)
# Safe because this is a containerized environment, no system conflicts
# Alternative: Use 'npx @anthropic-ai/claude-code' if preferred
if npm install -g @anthropic-ai/claude-code 2>/dev/null; then
    echo "   ✓ Claude Code CLI installed: $(claude --version 2>/dev/null || echo 'installed')"
    echo "   ℹ Run 'claude' to start - you'll be prompted to authenticate"
    echo "   Authentication options: OAuth (recommended) or API key"
else
    echo "   ⚠ Claude Code CLI installation failed (network issue?)"
    echo "   Install manually: npm install -g @anthropic-ai/claude-code"
    HAS_WARNINGS=1
fi

# Step 7: Playwright browsers (SKIPPED - install manually if needed)
# Playwright installation takes ~5-10 minutes and installs many system dependencies
# To install later: npx playwright install --with-deps

# Step 8: Display environment information
echo ""
echo "8. Environment information:"
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"
echo "   TypeScript: $(npx tsc --version 2>/dev/null || echo 'Not installed')"
echo "   Docker: $(docker --version 2>/dev/null || echo 'Installing...')"
echo "   Claude CLI: $(claude --version 2>/dev/null || echo 'Not installed (optional)')"

echo ""
if [ $HAS_WARNINGS -eq 1 ]; then
    echo "=========================================="
    echo "  Setup Complete (with warnings)"
    echo "=========================================="
    echo ""
    echo "⚠ Some steps failed (likely due to network issues)."
    echo "  When network is available, run these commands:"
    echo ""
    echo "  # If protobufs missing:"
    echo "  git submodule update --init --recursive"
    echo ""
    echo "  # If npm dependencies missing:"
    echo "  npm install"
    echo ""
else
    echo "=========================================="
    echo "  Setup Complete!"
    echo "=========================================="
fi
echo ""
echo "Next steps:"
echo "  1. Run: npm run test:run    # Verify tests pass"
echo "  2. Run: npm run dev:full    # Start dev servers"
echo "  3. Open: http://localhost:5173"
echo ""

# Always exit 0 to allow devcontainer to complete setup
# Warnings are informational, not blocking
exit 0
