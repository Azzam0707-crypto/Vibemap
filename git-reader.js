const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function git(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

async function readGitChanges(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return [];
  const [porcelain, diff] = await Promise.all([
    git(root, ['status', '--porcelain', '-uall']),
    git(root, ['diff', 'HEAD', '--']).catch(() => '')
  ]);
  const status = {};
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue;
    const x = line[0];
    const y = line[1];
    const p = line.slice(3).trim().replace(/^"|"$/g, '');
    const code = (x === ' ' ? y : x);
    status[p] = (code === 'A' || code === '?') ? 'added' : code === 'D' ? 'deleted' : code === 'R' ? 'renamed' : 'modified';
  }
  if (!diff.trim()) return Object.entries(status).map(([filePath, changeType]) => ({ filePath, changeType, diffText: '', linesAdded: 0, linesRemoved: 0 }));
  const out = [];
  const hunks = diff.split(/^diff --git /m).filter(Boolean);
  for (const h of hunks) {
    const m = h.match(/^a\/(.+?) b\/(.+?)$/m);
    if (!m) continue;
    const filePath = m[2].replace(/^"|"$/g, '');
    const lines = h.split('\n');
    let linesAdded = 0;
    let linesRemoved = 0;
    for (const l of lines) {
      if (l.startsWith('+++') || l.startsWith('---')) continue;
      if (l.startsWith('+')) linesAdded++;
      else if (l.startsWith('-')) linesRemoved++;
    }
    let changeType = status[filePath];
    if (!changeType) {
      const isNew = /^new file mode/m.test(h);
      const isDel = /^deleted file mode/m.test(h);
      changeType = isNew ? 'added' : isDel ? 'deleted' : 'modified';
    }
    out.push({ filePath, changeType, diffText: 'diff --git ' + h, linesAdded, linesRemoved });
  }
  for (const [filePath, changeType] of Object.entries(status)) {
    if (!out.some((c) => c.filePath === filePath)) {
      out.push({ filePath, changeType, diffText: '', linesAdded: 0, linesRemoved: 0 });
    }
  }
  return out;
}

module.exports = { readGitChanges };
