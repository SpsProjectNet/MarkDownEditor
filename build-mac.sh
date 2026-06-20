#!/usr/bin/env bash
# ============================================================
#  Build per macOS (.dmg, x64 + arm64)
#  Eseguire su macOS con Node.js installato.
# ============================================================
set -e

echo "[1/2] Installazione dipendenze..."
npm install

echo "[2/2] Compilazione installer macOS..."
npm run dist:mac

echo ""
echo "Fatto! Trovi il .dmg nella cartella \"dist\"."
