#!/usr/bin/env bash
cd "$(dirname "$0")"

echo "====================================================================="
echo "  e-CASEVAULT - Maharashtra Police Digital Evidence Management"
echo "====================================================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is NOT installed on this Mac!"
    echo ""
    echo "Please download and install Node.js (LTS version) from:"
    echo "  https://nodejs.org/"
    echo ""
    echo "After installing Node.js, double-click this file again."
    read -p "Press Enter to exit..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[INFO] First time setup: Installing dependencies..."
    echo "This may take 1-2 minutes. Please wait..."
    echo ""
    npm install
fi

echo ""
echo "[INFO] Starting e-CASEVAULT Application..."
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:5001"
echo ""
echo "Opening browser in 3 seconds..."
(sleep 3 && open "http://localhost:3000") &

npm start
