// background.js
let currentIndex = 0;
let urls = [];
let delayMs = 2000;
let timerId = null;
let isPaused = false;
let targetWindowId = null;

// 安全發訊 (避免 "Receiving end does not exist")
function safeSendMessage(msg) {
  try {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) {
        // popup 可能沒開或沒 listener，忽略錯誤
        // console.debug("safeSendMessage: no receiver:", chrome.runtime.lastError && chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
    // 忽略（Firefox fallback 不常用）
  }
}

function resetState() {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  currentIndex = 0;
  urls = [];
  delayMs = 2000;
  isPaused = false;
  targetWindowId = null;
}

function openNext() {
  if (isPaused) {
    timerId = setTimeout(openNext, delayMs);
    return;
  }

  if (currentIndex >= urls.length) {
    safeSendMessage({ command: "done", total: urls.length });
    resetState();
    return;
  }

  const url = urls[currentIndex];
  chrome.tabs.create({ url, windowId: targetWindowId, active: false }, (tab) => {
    // 盡量在 callback 裡發進度（確保 tab 已建立）
    safeSendMessage({ command: "progress", index: currentIndex, total: urls.length });
    currentIndex++;
    timerId = setTimeout(openNext, delayMs);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "openSelectedBookmarks") {
    // 開始新任務前先重置
    resetState();
    urls = Array.isArray(message.urls) ? message.urls.slice() : [];
    delayMs = (message.delay || 2) * 1000;
    targetWindowId = message.windowId || undefined;
    if (urls.length > 0) {
      currentIndex = 0;
      isPaused = false;
      openNext();
    } else {
      safeSendMessage({ command: "done", total: 0 });
    }
    return true;
  }

  if (message.command === "pause") {
    isPaused = true;
    return true;
  }

  if (message.command === "stop") {
    resetState();
    safeSendMessage({ command: "done", total: urls.length });
    return true;
  }

  // 支援 popup ready 如果需要
  if (message.command === "popupReady") {
    // no-op
    return true;
  }
});

