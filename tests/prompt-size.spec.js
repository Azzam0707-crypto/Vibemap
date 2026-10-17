const { test, expect } = require('@playwright/test');
const { summarize } = require('../summarizer');

function bigFixture(n) {
  const entries = [], changes = [], parsed = [];
  for (let i = 0; i < n; i++) {
    const fp = 'src/mod' + (i % 20) + '/file' + i + '.js';
    entries.push({ filePath: fp, entryType: 'file', fileExt: '.js', sizeBytes: 1500, depth: 3 });
    const lines = [];
    for (let l = 0; l < 40; l++) lines.push('+function helper' + i + '_' + l + '() { return ' + l + '; }');
    changes.push({ filePath: fp, changeType: 'modified', diffText: 'diff --git a/' + fp + ' b/' + fp + '\n' + lines.join('\n'), linesAdded: 40, linesRemoved: 3 });
    parsed.push({ filePath: fp, functionsAdded: ['h' + i], functionsRemoved: [], functionsModified: ['render'], importsChanged: ['./other' + (i % 20)] });
  }
  return { entries, changes, parsed };
}

test('prompt stays bounded with 1000 files', async () => {
  const { entries, changes, parsed } = bigFixture(1000);
  const changed = new Set(['src/mod0/file0.js', 'src/index.js']);
  entries.push({ filePath: 'src/index.js', entryType: 'file', fileExt: '.js', sizeBytes: 100, depth: 2 });
  changes.push({ filePath: 'src/index.js', changeType: 'added', diffText: 'diff --git a/src/index.js b/src/index.js\n+console.log(1)', linesAdded: 1, linesRemoved: 0 });
  parsed.push({ filePath: 'src/index.js', functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged: [] });
  let bodyLen = 0, body = '';
  const fetchImpl = async (url, opts) => {
    bodyLen = opts.body.length;
    body = JSON.parse(opts.body).messages[0].content;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ overallSummary: 'x', fileSummaries: [] }) } }] }) };
  };
  const r = await summarize(entries, changes, parsed, { type: 'cloud', endpoint: 'https://x.test', apiKey: 'k', model: 'm' }, fetchImpl);
  expect(r.ok).toBe(true);
  expect(bodyLen).toBeLessThan(150000);
  expect(body).toContain('more files');
  expect(body).toContain('src/index.js');
});
