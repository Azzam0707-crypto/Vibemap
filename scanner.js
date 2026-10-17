const fs = require('fs');
const path = require('path');

const DEFAULT_EXCLUDES = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'venv', '__pycache__', 'release', 'dist-release', 'out', 'coverage', 'test-results']);
const DEFAULT_MAX_DEPTH = 8;
const NOISE_FILE = /(^|\/)\.last-run\.json$|\.(asar|exe|dll|so)$|^docs\/superpowers\//i;

async function scanFolder(root, { excludes = DEFAULT_EXCLUDES, maxDepth = DEFAULT_MAX_DEPTH } = {}) {
  const out = [];
  async function walk(dir, rel, depth) {
    if (depth > maxDepth) return;
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const it of items) {
      if (excludes.has(it.name)) continue;
      const abs = path.join(dir, it.name);
      const relPath = rel ? rel + '/' + it.name : it.name;
      if (NOISE_FILE.test(relPath)) continue;
      const d = depth + 1;
      if (d > maxDepth) continue;
      if (it.isDirectory()) {
        out.push({ filePath: relPath, entryType: 'folder', fileExt: '', sizeBytes: 0, depth: d });
        await walk(abs, relPath, d);
      } else if (it.isFile()) {
        const st = await fs.promises.stat(abs);
        out.push({ filePath: relPath, entryType: 'file', fileExt: path.extname(it.name), sizeBytes: st.size, depth: d });
      }
    }
  }
  await walk(root, '', 0);
  return out;
}

module.exports = { scanFolder, DEFAULT_EXCLUDES };
