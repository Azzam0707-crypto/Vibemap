const { test, expect } = require('@playwright/test');
const { summarize } = require('../summarizer');

const entries = [
  { filePath: 'index.js', entryType: 'file', fileExt: '.js', sizeBytes: 100, depth: 1 },
];
const changes = [
  { filePath: 'index.js', changeType: 'modified', diffText: 'diff', linesAdded: 2, linesRemoved: 1 },
];
const parsed = [
  { filePath: 'index.js', functionsAdded: ['bar'], functionsRemoved: [], functionsModified: ['foo'], importsChanged: [] },
];

const LLM_JSON = JSON.stringify({
  overallSummary: 'Added a bar helper and tweaked foo.',
  fileSummaries: [{ filePath: 'index.js', summary: 'Now has a bar helper; foo behaves slightly differently.' }],
});

test('cloud provider posts chat-completions and parses summary', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: LLM_JSON } }] }) };
  };
  const r = await summarize(entries, changes, parsed,
    { type: 'cloud', endpoint: 'https://api.test.com/v1', apiKey: 'sk-x', model: 'm1' }, fetchImpl);
  expect(r.ok).toBe(true);
  expect(r.overallSummary).toContain('bar');
  expect(r.fileSummaries).toEqual([{ filePath: 'index.js', summary: expect.any(String) }]);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe('https://api.test.com/v1/chat/completions');
  expect(calls[0].opts.headers.Authorization).toBe('Bearer sk-x');
  expect(JSON.parse(calls[0].opts.body).model).toBe('m1');
});

test('ollama provider posts /api/chat without auth', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({ message: { content: LLM_JSON } }) };
  };
  const r = await summarize(entries, changes, parsed,
    { type: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3' }, fetchImpl);
  expect(r.ok).toBe(true);
  expect(r.overallSummary).toContain('bar');
  expect(calls[0].url).toBe('http://localhost:11434/api/chat');
  expect(calls[0].opts.headers.Authorization).toBeUndefined();
});

test('unreachable provider returns error, no throw', async () => {
  const r = await summarize(entries, changes, parsed,
    { type: 'cloud', endpoint: 'https://dead.test', apiKey: 'k', model: 'm' },
    async () => { throw new Error('fetch failed'); });
  expect(r.ok).toBe(false);
  expect(typeof r.error).toBe('string');
});

test('parses response wrapped in fences or prose', async () => {
  const fenced = '```json\n' + LLM_JSON + '\n```';
  const prosed = "Sure, here's the summary:\n" + LLM_JSON + '\nHope that helps!';
  for (const content of [fenced, prosed]) {
    const r = await summarize(entries, changes, parsed,
      { type: 'cloud', endpoint: 'https://api.test.com/v1', apiKey: 'k', model: 'm' },
      async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }));
    expect(r.ok).toBe(true);
    expect(r.overallSummary).toContain('bar');
  }
});

test('bad status and malformed body return error', async () => {
  const r401 = await summarize(entries, changes, parsed,
    { type: 'cloud', endpoint: 'https://api.test.com', apiKey: 'bad', model: 'm' },
    async () => ({ ok: false, status: 401, json: async () => ({}) }));
  expect(r401.ok).toBe(false);
  const rBad = await summarize(entries, changes, parsed,
    { type: 'ollama', endpoint: 'http://localhost:11434', model: 'm' },
    async () => ({ ok: true, status: 200, json: async () => ({ message: { content: 'not json' } }) }));
  expect(rBad.ok).toBe(false);
});
