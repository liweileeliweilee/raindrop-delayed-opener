// popup.js (IIFE to avoid polluting global scope)
(function() {
  // DOM
  const tokenInput = document.getElementById("tokenInput");
  const passwordInput = document.getElementById("passwordInput");
  const saveEncryptedBtn = document.getElementById("saveEncrypted");
  const savePlainBtn = document.getElementById("savePlain");
  const clearTokenBtn = document.getElementById("clearToken");
  const loadBtn = document.getElementById("loadBtn");
  const tagFilterInput = document.getElementById("tagFilter");
  const bookmarkList = document.getElementById("bookmarkList");
  const progressEl = document.getElementById("progress");
  const delayInput = document.getElementById("delay");
  const startBtn = document.getElementById("start");
  const pauseBtn = document.getElementById("pause");
  const stopBtn = document.getElementById("stop");
  const statusEl = document.getElementById("status");

  // state
  let raindropBookmarks = []; // { title, url, tags:[] }
  let selectedIndexes = new Set();

  // storage keys
  const KEY_ENC = "raindrop_encrypted_token";
  const KEY_PLAIN = "raindrop_plain_token";

  // ========== storage helpers ==========
  function storageGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, res => resolve(res)));
  }
  function storageSet(obj) {
    return new Promise(resolve => chrome.storage.local.set(obj, () => resolve()));
  }
  function storageRemove(keys) {
    return new Promise(resolve => chrome.storage.local.remove(keys, () => resolve()));
  }

  // ========== token save/load ==========
  async function savePlainToken(token) {
    await storageSet({ [KEY_PLAIN]: token });
    statusEl.textContent = "已以明文儲存";
    setTimeout(()=> statusEl.textContent = "", 2500);
  }

  async function saveEncryptedToken(token, password) {
    try {
      const enc = await encryptTokenWithPassword(token, password);
      await storageSet({ [KEY_ENC]: enc });
      // remove plain token if exists
      await storageRemove([KEY_PLAIN]);
      statusEl.textContent = "Token 已加密儲存";
      setTimeout(()=> statusEl.textContent = "", 2500);
    } catch (e) {
      console.error(e);
      alert("加密儲存失敗，請檢查密碼或瀏覽器是否支援 Web Crypto");
    }
  }

  async function clearToken() {
    await storageRemove([KEY_ENC, KEY_PLAIN]);
    tokenInput.value = "";
    passwordInput.value = "";
    statusEl.textContent = "Token 已移除";
    setTimeout(()=> statusEl.textContent = "", 2500);
  }

  async function loadTokenDecrypted(password) {
    const data = await storageGet([KEY_ENC, KEY_PLAIN]);
    if (data[KEY_ENC]) {
      if (!password) throw new Error("請輸入密碼以解密 Token");
      const token = await decryptTokenWithPassword(data[KEY_ENC], password);
      return token;
    } else if (data[KEY_PLAIN]) {
      return data[KEY_PLAIN];
    } else {
      return null;
    }
  }

  // ========== fetch bookmarks (paginated) ==========
  async function fetchAllRaindrops(token) {
    const perPage = 50;
    let page = 0;
    let all = [];
    while (true) {
      const url = `https://api.raindrop.io/rest/v1/raindrops/0?perpage=${perPage}&page=${page}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
      if (!resp.ok) throw new Error(`API: ${resp.status} ${resp.statusText}`);
      const data = await resp.json();
      if (!data.items || data.items.length === 0) break;
      // normalize
      data.items.forEach(it => {
        all.push({
          title: it.title || it.link,
          url: it.link,
          tags: Array.isArray(it.tags) ? it.tags : []
        });
      });
      page++;
      // safety: if API returns count, can break early (but current loop will stop anyway)
      if (data.count && all.length >= data.count) break;
    }
    return all;
  }

  // ========== render / filter ==========
  function renderList(bookmarks, filterTags) {
    bookmarkList.innerHTML = "";
    selectedIndexes.clear();

    const normalizedFilter = (filterTags || []).map(t => t.trim().toLowerCase()).filter(Boolean);

    bookmarks.forEach((b, idx) => {
      // filter logic: if no filter -> show all
      // if filter exists -> show if any tag matches any filterTerm
      let show = true;
      if (normalizedFilter.length > 0) {
        const btags = (b.tags || []).map(t => t.toLowerCase());
        show = normalizedFilter.some(ft => btags.some(bt => bt.includes(ft)));
      }
      if (!show) return;

      const li = document.createElement("li");
      li.classList.add("bookmark");
      li.dataset.index = idx;
      li.dataset.url = b.url;

      const titleDiv = document.createElement("div");
      titleDiv.textContent = b.title || b.url;
      li.appendChild(titleDiv);

      const tagDiv = document.createElement("div");
      tagDiv.className = "tags";
      if (b.tags && b.tags.length) {
        tagDiv.textContent = b.tags.join(", ");
      } else {
        tagDiv.textContent = "(無標籤)";
      }
      li.appendChild(tagDiv);

      li.addEventListener("click", (e) => {
        // click handler supports ctrl/meta/shift selection
        handleListSelection(e, li);
      });

      bookmarkList.appendChild(li);
    });

    progressEl.textContent = `進度：0 / ${bookmarkList.querySelectorAll("li").length}`;
  }

  function handleListSelection(e, li) {
    const allLis = Array.from(bookmarkList.querySelectorAll("li"));
    if (e.ctrlKey || e.metaKey) {
      li.classList.toggle("selected");
    } else if (e.shiftKey) {
      const currentIndex = allLis.indexOf(li);
      const lastSelectedIndex = allLis.findIndex(el => el.classList.contains("selected"));
      if (lastSelectedIndex === -1) {
        li.classList.add("selected");
      } else {
        const [start, end] = [lastSelectedIndex, currentIndex].sort((a,b)=>a-b);
        allLis.slice(start, end+1).forEach(el => el.classList.add("selected"));
      }
    } else {
      allLis.forEach(el => el.classList.remove("selected"));
      li.classList.add("selected");
    }
  }

  // ========== Start / Pause / Stop ==========
  function sendStartToBackground(urls, delaySec) {
    // try to get current window id from active tab
    chrome.tabs.query({active:true, currentWindow:true}, (tabs) => {
      const windowId = (tabs && tabs[0] && tabs[0].windowId) || undefined;
      try {
        chrome.runtime.sendMessage({ command: "openSelectedBookmarks", urls, delay: delaySec, windowId }, (resp) => {
          // ignore response; background has safeSendMessage
          if (chrome.runtime.lastError) {
            // ignore
          }
        });
      } catch (e) {
        // ignore
      }
    });
  }

  function sendPause() {
    try { chrome.runtime.sendMessage({ command: "pause" }); } catch(e) {}
  }
  function sendStop() {
    try { chrome.runtime.sendMessage({ command: "stop" }); } catch(e) {}
  }

  // ========== UI events ==========
  saveEncryptedBtn.addEventListener("click", async () => {
    const token = tokenInput.value.trim();
    const password = passwordInput.value;
    if (!token || !password) return alert("請輸入 Token 與加密密碼");
    saveEncryptedBtn.disabled = true;
    try {
      const enc = await encryptTokenWithPassword(token, password);
      await storageSet({ [KEY_ENC]: enc });
      // remove plain token if existed
      await storageRemove([KEY_PLAIN]);
      statusEl.textContent = "已以加密方式儲存 Token";
      setTimeout(()=> statusEl.textContent = "", 2500);
    } catch (e) {
      console.error(e);
      alert("儲存失敗：" + e.message);
    } finally {
      saveEncryptedBtn.disabled = false;
    }
  });

  savePlainBtn.addEventListener("click", async () => {
    const token = tokenInput.value.trim();
    if (!token) return alert("請輸入 Token");
    await storageSet({ [KEY_PLAIN]: token });
    await storageRemove([KEY_ENC]);
    statusEl.textContent = "已以明文方式儲存 Token";
    setTimeout(()=> statusEl.textContent = "", 2500);
  });

  clearTokenBtn.addEventListener("click", async () => {
    await clearToken();
    bookmarkList.innerHTML = "";
    progressEl.textContent = "進度：0 / 0";
  });

  loadBtn.addEventListener("click", async () => {
    // load: prefer encrypted (requires password input), else plain
    try {
      const store = await storageGet([KEY_ENC, KEY_PLAIN]);
      let token = null;
      if (store[KEY_ENC]) {
        const pw = passwordInput.value;
        if (!pw) return alert("此帳號使用加密 Token，請輸入加密密碼後載入");
        try {
          token = await decryptTokenWithPassword(store[KEY_ENC], pw);
        } catch (e) {
          return alert("解密失敗：密碼錯誤或資料損壞");
        }
      } else if (store[KEY_PLAIN]) {
        token = store[KEY_PLAIN];
      } else {
        return alert("尚未儲存 Token，請先貼上並儲存");
      }

      tokenInput.value = token; // fill token input (convenience)
      // fetch bookmarks
      progressEl.textContent = "正在載入書籤...";
      raindropBookmarks = await fetchAllRaindrops(token);
      // show all (no filter)
      renderList(raindropBookmarks, []);
    } catch (e) {
      console.error(e);
      alert("載入失敗：" + (e && e.message));
    }
  });

  startBtn.addEventListener("click", async () => {
    const selected = Array.from(bookmarkList.querySelectorAll("li.selected"));
    if (selected.length === 0) return alert("請先選取一或多個書籤");
    const urls = selected.map(li => li.dataset.url);
    const delaySec = Math.min(Math.max(parseInt(delayInput.value || 2), 0), 3600);
    sendStartToBackground(urls, delaySec);
  });

  pauseBtn.addEventListener("click", () => sendPause());
  stopBtn.addEventListener("click", () => sendStop());

  // Tag filter on input
  tagFilterInput.addEventListener("input", (e) => {
    const raw = e.target.value.trim();
    const terms = raw === "" ? [] : raw.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!raindropBookmarks || raindropBookmarks.length === 0) return;
    if (terms.length === 0) {
      renderList(raindropBookmarks, []);
    } else {
      renderList(raindropBookmarks, terms);
    }
  });

  // receive progress/done from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.command) return;
    if (message.command === "progress") {
      progressEl.textContent = `進度：${(message.index || 0) + 1} / ${message.total || 0}`;
    } else if (message.command === "done") {
      progressEl.textContent = `完成，共 ${message.total || 0} 項`;
    }
    return true;
  });

  // auto-load token presence on open: (but require user to click "載入書籤" to decrypt)
  (async function init() {
    const store = await storageGet([KEY_ENC, KEY_PLAIN]);
    if (store[KEY_PLAIN]) tokenInput.value = store[KEY_PLAIN];
    if (store[KEY_ENC]) {
      // show hint to user to enter password and click 載入書籤
      statusEl.textContent = "偵測到已加密 Token，請輸入密碼後按「載入書籤」";
    }
    // register popupReady (optional)
    try { chrome.runtime.sendMessage({ command: "popupReady" }); } catch(e) {}
  })();

})(); // end IIFE

