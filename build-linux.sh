#!/usr/bin/env bash
# ============================================================
#  Build for Linux (AppImage + .deb, x64 / arm64 / armv7l).
#
#  This script is self-contained: on Debian/Ubuntu it installs
#  every missing prerequisite (Node.js, npm, packaging tools)
#  before building. When it runs from a shared folder (where
#  symlinks are not allowed and packaging fails), it copies the
#  project into the home directory, builds there, and copies the
#  resulting packages back. Run it from the project folder:
#      chmod +x build-linux.sh
#      ./build-linux.sh
# ============================================================
set -e

# Remember where the project lives so we can return artifacts here.
ORIGINAL_DIR="$(pwd)"

# Use sudo only when the script is not already running as root.
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

# This installer path supports Debian/Ubuntu (apt-get) only.
if ! command -v apt-get >/dev/null 2>&1; then
  echo "Automatic setup supports Debian/Ubuntu (apt-get) only."
  echo "Install Node.js and npm manually, then run: npm install && npm run dist:linux"
  exit 1
fi

# [1/5] Ensure the base tools used by this script are present.
echo "[1/5] Checking base tools (curl, ca-certificates, rsync)..."
if ! command -v curl >/dev/null 2>&1 || ! command -v rsync >/dev/null 2>&1; then
  $SUDO apt-get update
  $SUDO apt-get install -y curl ca-certificates rsync
fi

# [2/5] Install Node.js and npm if either one is missing.
echo "[2/5] Checking Node.js and npm..."
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm not found. Installing Node.js 20 LTS from NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
else
  echo "Node.js $(node -v) and npm $(npm -v) already installed."
fi

# [3/5] Install the tools required to build a .deb package, plus the FUSE
# runtime needed to launch the resulting AppImage.
echo "[3/5] Checking packaging tools (dpkg, fakeroot) and AppImage runtime (libfuse2)..."
if ! command -v dpkg >/dev/null 2>&1 || ! command -v fakeroot >/dev/null 2>&1; then
  $SUDO apt-get update
  $SUDO apt-get install -y dpkg fakeroot
fi
# AppImage needs libfuse.so.2 at runtime. The package is "libfuse2" on older
# releases and "libfuse2t64" on newer ones (Ubuntu 24.04+); try both.
if ! ldconfig -p | grep -q 'libfuse\.so\.2'; then
  $SUDO apt-get install -y libfuse2 || $SUDO apt-get install -y libfuse2t64 || true
fi

# Detect shared folders, where symlink creation is not permitted and would
# make AppImage/deb packaging fail.
IS_SHARED_FOLDER=false
case "$ORIGINAL_DIR" in
  /media/sf_*|/mnt/hgfs/*) IS_SHARED_FOLDER=true ;;
esac

# Choose the working directory for the actual build.
if [ "$IS_SHARED_FOLDER" = true ]; then
  WORK_DIR="$HOME/markdown-editor-build"
  echo "[4/5] Shared folder detected. Copying project to $WORK_DIR..."
  mkdir -p "$WORK_DIR"
  # Copy sources only; node_modules and dist are rebuilt in the work dir.
  rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude .git \
    "$ORIGINAL_DIR"/ "$WORK_DIR"/
else
  WORK_DIR="$ORIGINAL_DIR"
  echo "[4/5] Building in place ($WORK_DIR)..."
fi

# [5/5] Install dependencies and build the Linux packages.
echo "[5/5] Installing dependencies and building..."
cd "$WORK_DIR"
npm install
npm run dist:linux

# When built in the home directory, copy the final packages back to the
# original dist folder. Only plain files are copied, never the temporary
# build directories that contain symlinks.
if [ "$IS_SHARED_FOLDER" = true ]; then
  echo "Copying packages back to $ORIGINAL_DIR/dist..."
  mkdir -p "$ORIGINAL_DIR/dist"
  find "$WORK_DIR/dist" -maxdepth 1 -type f \
    \( -name '*.AppImage' -o -name '*.deb' \) \
    -exec cp -f {} "$ORIGINAL_DIR/dist/" \;
fi

echo ""
echo "Done. The packages are in \"$ORIGINAL_DIR/dist\"."
