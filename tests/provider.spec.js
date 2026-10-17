const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { saveProviderConfig, loadProviderConfig } = require('../provider-config');

test('round-trips config through temp dir', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-cfg-'));
  const cfg = { type: 'ollama', endpoint: 'http://localhost:11434', apiKey: '', model: 'llama3' };
  await saveProviderConfig(dir, cfg);
  expect(await loadProviderConfig(dir)).toEqual(cfg);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('save B overwrites A completely, no leftover fields', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-cfg-'));
  try {
    await saveProviderConfig(dir, { type: 'cloud', endpoint: 'https://a.test', apiKey: 'k1', model: 'm1', extra: 'stale' });
    await saveProviderConfig(dir, { type: 'ollama', endpoint: 'http://localhost:11434' });
    expect(await loadProviderConfig(dir)).toEqual({ type: 'ollama', endpoint: 'http://localhost:11434', apiKey: '' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing file loads null, no throw', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-cfg-'));
  expect(await loadProviderConfig(dir)).toBeNull();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('analyze without config returns ai-error', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-nocfg-'));
  fs.writeFileSync(path.join(tmp, 'a.js'), 'function a() {}\n');
  const { analyzeFolder } = require('../analyze');
  const r = await analyzeFolder(tmp, null);
  expect(r.status).toBe('ai-error');
  fs.rmSync(tmp, { recursive: true, force: true });
});

const fakeStorage = () => ({
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from('enc:' + s, 'utf8'),
  decryptString: (b) => Buffer.from(b).toString('utf8').replace(/^enc:/, ''),
});

test('apiKey encrypted on disk, decrypted on load', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-cfg-'));
  try {
    const cfg = { type: 'cloud', endpoint: 'https://e.test', apiKey: 'sk-secret', model: 'm' };
    await saveProviderConfig(dir, cfg, fakeStorage());
    const raw = fs.readFileSync(path.join(dir, 'provider.json'), 'utf8');
    expect(raw).not.toContain('sk-secret');
    expect(raw).toContain('https://e.test');
    expect(await loadProviderConfig(dir, fakeStorage())).toEqual(cfg);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy plaintext file still loads', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-cfg-'));
  try {
    fs.writeFileSync(path.join(dir, 'provider.json'), JSON.stringify({ type: 'cloud', endpoint: 'e', apiKey: 'sk-plain', model: 'm' }));
    expect(await loadProviderConfig(dir, fakeStorage())).toEqual({ type: 'cloud', endpoint: 'e', apiKey: 'sk-plain', model: 'm' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('unavailable encryption falls back to plaintext with warn each save', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-cfg-'));
  const dead = { isEncryptionAvailable: () => false, encryptString: () => { throw new Error('nope'); }, decryptString: () => { throw new Error('nope'); } };
  const before = (console.warn.mock?.calls?.length ?? 0);
  const orig = console.warn;
  const msgs = [];
  console.warn = (...a) => { msgs.push(a.join(' ')); orig(...a); };
  try {
    const cfg = { type: 'cloud', endpoint: 'e', apiKey: 'sk-plain', model: 'm' };
    const r1 = await saveProviderConfig(dir, cfg, dead);
    const r2 = await saveProviderConfig(dir, cfg, dead);
    expect(await loadProviderConfig(dir, dead)).toEqual(cfg);
    expect(r1.encrypted).toBe(false);
    expect(r2.encrypted).toBe(false);
    expect(msgs.length).toBe(2);
    expect(msgs.join('\n')).not.toContain('sk-plain');
  } finally {
    console.warn = orig;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
