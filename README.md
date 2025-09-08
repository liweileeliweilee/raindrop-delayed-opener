# Raindrop.io Delayed Opener

這是一個為 Raindrop.io 設計的瀏覽器擴充功能，讓使用者可以從自己的收藏中，依序自動打開多個書籤。

**支援功能：**
- **載入所有書籤**：一次性載入你在 Raindrop.io 中的所有書籤，不受 25 筆的限制。
- **自動選擇**：載入書籤或使用標籤篩選後，會自動選取所有可見的書籤，省去手動全選的步驟。
- **延遲開啟**：設定每個分頁之間的開啟時間間隔。
- **標籤篩選**：根據一個或多個標籤來篩選書籤。
- **多選功能**：支援使用 Shift 和 Ctrl 鍵來選取多個書籤，以調整自動選擇的範圍。
- **任務控制**：可以在過程中暫停或停止開啟任務。
- **Token 安全儲存**：可選擇使用密碼加密來保存你的 Raindrop.io Personal Token，或者以明文方式儲存。

## 如何使用 (開發者模式)

### 1. 克隆專案

首先，將本專案克隆到你的本機電腦。

```bash
git clone https://github.com/liweileeliweilee/raindrop-delayed-opener.git
cd raindrop-delayed-opener
```
### 2. 執行建置腳本

執行 build-extension.sh 腳本，它會自動為 Chrome 和 Firefox 建立各自的擴充功能建置檔。

```bash
chmod +x build-extension.sh
./build-extension.sh
```

執行完成後，build 資料夾會被建立，其中包含 chrome 和 firefox 兩個子目錄。

### 3. 在瀏覽器中載入擴充功能

Chrome

    開啟 Chrome 瀏覽器，在網址列輸入 chrome://extensions。

    開啟右上角的「開發人員模式」（Developer mode）。

    點擊「載入未封裝項目」（Load unpacked）。

    選擇 build/chrome 資料夾。

Firefox

    開啟 Firefox 瀏覽器，在網址列輸入 about:debugging#/runtime/this-firefox。

    點擊「載入臨時附加元件...」（Load Temporary Add-on...）。

    選擇 build/firefox/manifest.json 檔案。

### 4. 首次設定

開啟擴充功能彈窗，貼上你的 Raindrop.io Personal Token。為了安全，強烈建議你設定一個密碼，選擇「儲存 (加密)」來儲存你的 Token。

完成後，你就可以開始使用了。

專案結構
├── background.js
├── build-extension.sh
├── crypto.js
├── icon1024.png
├── popup.html
├── popup.js
└── README.md

    background.js：處理所有分頁開啟、計時和狀態管理的核心邏輯。

    build-extension.sh：自動化腳本，用於為不同瀏覽器建立建置檔。

    crypto.js：用於加密和解密 Raindrop.io Token 的函式庫。

    icon1024.png：用於產生所有尺寸圖示的原始檔。

    popup.html：擴充功能的彈出視窗介面。

    popup.js：處理使用者互動、載入書籤和與背景腳本通訊的主要邏輯。

    README.md：說明文件。

