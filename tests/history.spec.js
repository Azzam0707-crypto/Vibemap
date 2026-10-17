const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadHistory, saveEntry } = require('../history');

const entry = (folderPath, extra) => ({ folderPath, folderName: folderPath.split('/').pop(), lastScannedAt: new Date().toISOString(), result: { status: 'ok' }, ...(extra || {}) });

const withDir = async (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-hist-'));
  try {
    await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('starts empty when file missing', async () => {
  await withDir(async (dir) => {
    expect(await loadHistory(dir)).toEqual([]);
  });
});

test('saveEntry adds and persists newest first', async () => {
  await withDir(async (dir) => {
    await saveEntry(dir, entry('/a'));
    await saveEntry(dir, entry('/b'));
    const list = await loadHistory(dir);
    expect(list.map((e) => e.folderPath)).toEqual(['/b', '/a']);
  });
});

test('re-saving same path updates in place, moves to front, no duplicate', async () => {
  await withDir(async (dir) => {
    await saveEntry(dir, entry('/a', { result: { status: 'ok', v: 1 } }));
    await saveEntry(dir, entry('/b'));
    await saveEntry(dir, entry('/a', { result: { status: 'ok', v: 2 } }));
    const list = await loadHistory(dir);
    expect(list.map((e) => e.folderPath)).toEqual(['/a', '/b']);
    expect(list[0].result).toEqual({ status: 'ok', v: 2 });
  });
});

test('trims to 20, drops oldest', async () => {
  await withDir(async (dir) => {
    for (let i = 0; i < 21; i++) await saveEntry(dir, entry('/p' + i));
    const list = await loadHistory(dir);
    expect(list.length).toBe(20);
    expect(list.map((e) => e.folderPath)).not.toContain('/p0');
    expect(list[0].folderPath).toBe('/p20');
  });
});

test('corrupt file loads as [] without throwing', async () => {
  await withDir(async (dir) => {
    fs.writeFileSync(path.join(dir, 'history.json'), 'not-json{{{');
    await expect(loadHistory(dir)).resolves.toEqual([]);
  });
});
