#!/bin/bash

# Safari Extension Conversion Script

EXTENSION_DIR=$(pwd)
OUTPUT_DIR="$EXTENSION_DIR/release/safari"

echo "🍏 Preparing to convert Extension for Safari..."

# Check if Xcode command line tools are available
if ! command -v xcrun &> /dev/null; then
    echo "❌ Error: Xcode (xcrun) is not detected."
    echo "   Please install Xcode from the Mac App Store to build Safari extensions."
    exit 1
fi

echo "⚠️  NOTE: This process will launch Xcode."
echo "   It will create a native Mac App that wraps your extension."
echo "   When Xcode opens, simply press 'Run' (Play button) to test it in Safari."
echo ""
read -p "Press [Enter] to start the conversion (or Ctrl+C to cancel)..."

# Run the Apple converter
# We use the current directory (.) as the source
# --force overwrites if it exists
# --app-name sets the name
# --bundle-identifier sets a unique ID (you can change this in Xcode later)
xcrun safari-web-extension-converter "$EXTENSION_DIR" \
    --project-location "$OUTPUT_DIR" \
    --app-name "CGL Tool" \
    --bundle-identifier "com.cybreturn.cgltool" \
    --force

echo ""
echo "✅ Conversion command executed."
echo "   If successful, Xcode should now be open with your project."
echo "   Location: $OUTPUT_DIR/CGL Tool"
