#!/usr/bin/env bash
set -euo pipefail

echo "=== AI Article Summarizer - Build ==="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required (v18+). Install from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js v18+ required, found $(node -v)"
    exit 1
fi

echo "Node.js $(node -v)"
echo "npm $(npm -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Build
echo ""
echo "Building extension..."
npm run build

echo ""
echo "Build complete. Extension files are in dist/"
echo "Load in Firefox: about:debugging > Load Temporary Add-on > dist/manifest.json"
