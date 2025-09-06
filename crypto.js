// crypto.js - 瀏覽器端輕量 AES-GCM 加解密 (PBKDF2 derivation)
async function _getKeyFromPassword(password, salt = "raindrop_salt_v1") {
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    pwKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  return key;
}

function _bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function _base64ToBuf(b64) {
  const str = atob(b64);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf;
}

async function encryptTokenWithPassword(token, password) {
  const key = await _getKeyFromPassword(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(token));
  // combine iv + cipher
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return _bufToBase64(combined.buffer);
}

async function decryptTokenWithPassword(encryptedBase64, password) {
  const combined = _base64ToBuf(encryptedBase64);
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12).buffer;
  const key = await _getKeyFromPassword(password);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

