// background.js (for Manifest V3)
// 所有狀態都透過 chrome.storage 來管理
const STATE_KEY = 'raindrop_state';

// 初始狀態
const defaultState = {
  currentIndex: 0,
  urls: [],
  delayMs: 2000,
  isPaused: false,
  targetWindowId: null,
};

// 取得當前狀態
async function getState() {
  const result = await chrome.storage.local.get(STATE_KEY);
  return result[STATE_KEY] || defaultState;
}

// 設定新狀態
async function setState(newState) {
  const currentState = await getState();
  const updatedState = { ...currentState, ...newState };
  return chrome.storage.local.set({ [STATE_KEY]: updatedState });
}

// 清除狀態
async function clearState() {
  return chrome.storage.local.remove(STATE_KEY);
}

// 主要開分頁的邏輯
async function openNext() {
  const state = await getState();

  if (state.isPaused) {
    setTimeout(openNext, state.delayMs);
    return;
  }

  if (state.currentIndex >= state.urls.length) {
    safeSendMessage({ command: "done", total: state.urls.length });
    await clearState();
    return;
  }

  const url = state.urls[state.currentIndex];
  
  try {
    // 嘗試建立新分頁
    await chrome.tabs.create({ url, windowId: state.targetWindowId, active: false });

    // 如果成功，就更新進度並繼續
    await setState({ currentIndex: state.currentIndex + 1 });
    safeSendMessage({ command: "progress", index: state.currentIndex, total: state.urls.length });

    setTimeout(openNext, state.delayMs);

  } catch (e) {
    // 捕捉錯誤並檢查是不是因為使用者操作造成
    if (e.message.includes("Tabs cannot be edited")) {
      console.warn("Tabs are currently locked. Retrying in 1 second...");
      // 延遲 1 秒後再次嘗試
      setTimeout(openNext, 1000);
    } else {
      // 如果是其他非預期的錯誤，就直接拋出
      console.error("An unexpected error occurred:", e);
      throw e;
    }
  }
}

// 安全發訊 (避免 "Receiving end does not exist")
function safeSendMessage(msg) {
  try {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) {
        // 忽略 popup 可能沒開或沒 listener 的錯誤
      }
    });
  } catch (e) {
    // 忽略
  }
}

// 監聽來自 popup.js 的指令
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "openSelectedBookmarks") {
    const urls = Array.isArray(message.urls) ? message.urls.slice() : [];
    const delayMs = (message.delay || 2) * 1000;
    const targetWindowId = message.windowId || undefined;

    if (urls.length > 0) {
      setState({
        currentIndex: 0,
        urls,
        delayMs,
        isPaused: false,
        targetWindowId,
      }).then(() => {
        openNext();
      });
    } else {
      safeSendMessage({ command: "done", total: 0 });
    }
    return true; // Keep the message channel open for async response
  }

  if (message.command === "pause") {
    setState({ isPaused: true });
    return true;
  }

  if (message.command === "stop") {
    clearState().then(() => {
      safeSendMessage({ command: "done", total: 0 });
    });
    return true;
  }

  // 支援 popup ready
  if (message.command === "popupReady") {
    // 載入當前狀態並傳送給 popup
    getState().then(state => {
      safeSendMessage({
        command: "progress",
        index: state.currentIndex,
        total: state.urls.length
      });
    });
    return true;
  }
});
