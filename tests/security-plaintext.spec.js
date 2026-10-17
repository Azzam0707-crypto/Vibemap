const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshConfig() {
  delete require.cache[require.resolve('../provider-config')];
  return require('../provider-config');
}

test('plaintext fallback returns encrypted:false and warns without key', async () => {
  const { saveProviderConfig } = freshConfig();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-sec-'));
  const dead = { isEncryptionAvailable: () => false, encryptString: () => { throw new Error('nope'); }, decryptString: () => { throw new Error('nope'); } };
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => { warns.push(a.join(' ')); };
  try {
    const cfg = { type: 'cloud', endpoint: 'https://e.test', apiKey: 'sk-SECRET-XYZ', model: 'm' };
    const ret = await saveProviderConfig(dir, cfg, dead);
    expect(ret.encrypted).toBe(false);
    expect(warns.length).toBeGreaterThanOrEqual(1);
    expect(warns.join('\n')).not.toContain('sk-SECRET-XYZ');
  } finally {
    console.warn = orig;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('encrypted save returns encrypted:true', async () => {
  const { saveProviderConfig } = freshConfig();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-sec-'));
  const fake = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from('enc:' + s, 'utf8'), decryptString: (b) => Buffer.from(b).toString('utf8').replace(/^enc:/, '') };
  try {
    const ret = await saveProviderConfig(dir, { type: 'cloud', endpoint: 'e', apiKey: 'k', model: 'm' }, fake);
    expect(ret.encrypted).toBe(true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
