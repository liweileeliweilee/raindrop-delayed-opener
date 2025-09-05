#!/bin/bash
set -e

SRC_DIR="$(pwd)"
BUILD_DIR="$SRC_DIR/build"
CHROME_DIR="$BUILD_DIR/chrome"
FIREFOX_DIR="$BUILD_DIR/firefox"
XPI_FILE="$FIREFOX_DIR/raindrop-delayed-opener.xpi"

rm -rf "$BUILD_DIR"
mkdir -p "$CHROME_DIR" "$FIREFOX_DIR"

# 複製共同檔案
cp popup.html popup.js crypto.js background.js icon1024.png "$CHROME_DIR/"
cp popup.html popup.js crypto.js background.js icon1024.png "$FIREFOX_DIR/"

# 產生不同尺寸圖示
for size in 16 32 48 128; do
    convert icon1024.png -resize ${size}x${size} "$CHROME_DIR/icon${size}.png"
    convert icon1024.png -resize ${size}x${size} "$FIREFOX_DIR/icon${size}.png"
done

# 產生 Chrome manifest.json (MV3)
cat > "$CHROME_DIR/manifest.json" <<'EOF'
{
  "manifest_version": 3,
  "name": "Raindrop.io Delayed Opener",
  "version": "1.1.0",
  "description": "從 Raindrop.io 讀取書籤並延遲依序開啟（支援標籤、Shift/Ctrl 多選、暫停/停止）",
  "permissions": [
    "tabs",
    "storage"
  ],
  "host_permissions": [
    "https://api.raindrop.io/*"
  ],
  "icons": {
    "16": "icon16.png",
    "32": "icon32.png",
    "48": "icon48.png",
    "128": "icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "32": "icon32.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  }
}
EOF

# 產生 Firefox manifest.json (MV2)
cat > "$FIREFOX_DIR/manifest.json" <<'EOF'
{
  "manifest_version": 2,
  "name": "Raindrop.io Delayed Opener",
  "version": "1.1.0",
  "description": "從 Raindrop.io 讀取書籤並延遲依序開啟（支援標籤、Shift/Ctrl 多選、暫停/停止）",
  "permissions": [
    "tabs",
    "storage",
    "https://api.raindrop.io/*"
  ],
  "icons": {
    "16": "icon16.png",
    "32": "icon32.png",
    "48": "icon48.png",
    "128": "icon128.png"
  },
  "browser_action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "32": "icon32.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "background": {
    "scripts": ["background.js"]
  }
}
EOF

# 重新壓縮 Firefox 擴充功能
# 切換到目標目錄
cd "$FIREFOX_DIR"
# 打包所有檔案為 .xpi
zip -r "$XPI_FILE" *

echo "擴充功能已成功建置於 $FIREFOX_DIR"
