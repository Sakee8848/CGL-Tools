#!/bin/bash

# Define directories
EXTENSION_DIR=$(pwd)
ICONS_DIR="$EXTENSION_DIR/icons"
RELEASE_DIR="$EXTENSION_DIR/release"
MANIFEST_FILE="$EXTENSION_DIR/manifest.json"

echo "🔧 Preparing CGL Extension for Distribution..."

# 1. Create Icons
echo "🎨 Generating icons..."
mkdir -p "$ICONS_DIR"

if [ -f "icon.png" ]; then
    sips -z 16 16   icon.png --out "$ICONS_DIR/icon-16.png" > /dev/null
    sips -z 32 32   icon.png --out "$ICONS_DIR/icon-32.png" > /dev/null
    sips -z 48 48   icon.png --out "$ICONS_DIR/icon-48.png" > /dev/null
    sips -z 128 128 icon.png --out "$ICONS_DIR/icon-128.png" > /dev/null
    echo "✅ Icons generated in ./icons/"
else
    echo "❌ Error: icon.png not found in current directory."
    exit 1
fi

# 2. Package for Chrome/Edge
echo "📦 Packaging for Chrome and Edge..."
mkdir -p "$RELEASE_DIR"

# Read version from manifest (simple grep/cut, assuming standard formatting)
VERSION=$(grep '"version":' manifest.json | cut -d '"' -f 4)
ZIP_NAME="cgl-extension-v$VERSION.zip"

# Zip files, excluding unnecessary ones
# -x excludes files from the zip
zip -r "$RELEASE_DIR/$ZIP_NAME" . -x "*.git*" -x ".DS_Store" -x "release/*" -x "Chrome商店发布指南.md" -x "安装说明.md" -x "prepare_distribution.sh" -x "convert_to_safari.sh" > /dev/null

echo "✅ Extension packaged: ./release/$ZIP_NAME"
echo ""
echo "📝 Next Steps:"
echo "1. Upload './release/$ZIP_NAME' to Chrome Web Store and Microsoft Edge Editor."
echo "2. For Safari, run './convert_to_safari.sh'."
