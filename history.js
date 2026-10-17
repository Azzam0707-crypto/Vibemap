const fs = require('fs');
const path = require('path');

const FILE = 'history.json';
const MAX_ENTRIES = 20;

async function loadHistory(dir) {
  try {
    const raw = JSON.parse(await fs.promises.readFile(path.join(dir, FILE), 'utf8'));
    if (!Array.isArray(raw)) return [];
    return raw.filter((e) => e && typeof e.folderPath === 'string');
  } catch {
    return [];
  }
}

async function saveEntry(dir, entry) {
  await fs.promises.mkdir(dir, { recursive: true });
  const list = await loadHistory(dir);
  const rest = list.filter((e) => e.folderPath !== entry.folderPath);
  const next = [entry, ...rest].slice(0, MAX_ENTRIES);
  await fs.promises.writeFile(path.join(dir, FILE), JSON.stringify(next), 'utf8');
  return next;
}

module.exports = { loadHistory, saveEntry };
