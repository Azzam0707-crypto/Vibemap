const fs = require('fs');
const path = require('path');
const { scanFolder } = require('./scanner');
const { readGitChanges } = require('./git-reader');
const { parseCodeChange } = require('./parser');
const { extractRefs } = require('./refs');
const { generateDiagram } = require('./diagram');
const { summarize } = require('./summarizer');

async function analyzeFolder(root, providerConfig, onProgress) {
  const prog = onProgress || (() => {});
  const entries = await scanFolder(root);
  const files = entries.filter((e) => e.entryType === 'file');
  if (files.length === 0) return { status: 'empty' };
  prog({ stage: 'scanning', files: files.length });
  if (!providerConfig) return { status: 'ai-error', error: 'no provider configured' };
  const changes = await readGitChanges(root);
  const changed = new Set(changes.map((c) => c.filePath));
  const parsed = [];
  const extraRefs = {};
  for (const f of files) {
    if (/\.(html?|css|json)$/i.test(f.fileExt) || f.filePath.split('/').pop().toLowerCase() === 'package.json') {
      try {
        const text = await fs.promises.readFile(path.join(root, ...f.filePath.split('/')), 'utf8');
        const refs = extractRefs(f.filePath, text);
        if (refs.length > 0) extraRefs[f.filePath] = refs;
      } catch { /* unreadable: no refs */ }
    }
    if (!/\.(jsx?|tsx?)$/.test(f.fileExt)) continue;
    if (changes.length > 0 && !changed.has(f.filePath)) continue;
    const change = changes.find((c) => c.filePath === f.filePath);
    let oldSrc = '';
    if (change && change.diffText) {
      oldSrc = change.diffText.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1)).join('\n');
    }
    let newSrc = '';
    try {
      newSrc = await fs.promises.readFile(path.join(root, ...f.filePath.split('/')), 'utf8');
    } catch {
      continue;
    }
    parsed.push(parseCodeChange(f.filePath, oldSrc, newSrc));
  }
  prog({ stage: 'analyzing', files: files.length });
  prog({ stage: 'summarizing', files: files.length });
  const summary = await summarize(entries, changes, parsed, providerConfig);
  if (!summary.ok) return { status: 'ai-error', error: summary.error, entries, changes };
  prog({ stage: 'mapping', files: files.length });
  const diagram = generateDiagram(entries, parsed, changes, extraRefs);
  return { status: 'ok', entries, changes, diagram, summary };
}

module.exports = { analyzeFolder };
