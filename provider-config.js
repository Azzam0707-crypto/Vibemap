const fs = require('fs');
const path = require('path');

const FILE = 'provider.json';

function defaultStorage() {
  try {
    const electron = require('electron');
    return electron && electron.safeStorage ? electron.safeStorage : null;
  } catch {
    return null;
  }
}

function tryEncrypt(storage, apiKey) {
  const st = storage || defaultStorage();
  if (!st) return null;
  try {
    if (st.isEncryptionAvailable() && typeof apiKey === 'string' && apiKey) {
      return st.encryptString(apiKey).toString('base64');
    }
  } catch { /* fall through to plaintext fallback below */ }
  return null;
}

async function saveProviderConfig(dir, cfg, storage) {
  await fs.promises.mkdir(dir, { recursive: true });
  const { apiKey, ...rest } = cfg || {};
  const out = { ...rest };
  const enc = apiKey ? tryEncrypt(storage, apiKey) : null;
  if (enc) { out.apiKeyEnc = enc; }
  else if (apiKey) {
    out.apiKey = apiKey;
    console.warn('VibeMap: OS keychain unavailable, API key stored in plaintext');
  }
  await fs.promises.writeFile(path.join(dir, FILE), JSON.stringify(out), 'utf8');
  return { ...(cfg || {}), encrypted: apiKey ? !!enc : true };
}

async function loadProviderConfig(dir, storage) {
  let raw;
  try {
    raw = JSON.parse(await fs.promises.readFile(path.join(dir, FILE), 'utf8'));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const st = storage || defaultStorage();
  if (typeof raw.apiKeyEnc === 'string' && st) {
    try {
      const dec = st.decryptString(Buffer.from(raw.apiKeyEnc, 'base64'));
      const { apiKeyEnc, ...rest } = raw;
      return { ...rest, apiKey: String(dec) };
    } catch { /* fall through to legacy/plaintext handling */ }
  }
  if (typeof raw.apiKey === 'string') return raw;
  const { apiKeyEnc, ...rest } = raw;
  return { ...rest, apiKey: '' };
}

module.exports = { saveProviderConfig, loadProviderConfig };
