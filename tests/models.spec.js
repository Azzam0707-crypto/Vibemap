const { test, expect } = require('@playwright/test');
const { fetchModels } = require('../models');

const CLOUD = { type: 'cloud', endpoint: 'https://gateway.example.com/v1', apiKey: 'sk-x', model: '' };

test('openai-shaped endpoint uses Bearer GET /models, reads data[].id', async () => {
  let got;
  const r = await fetchModels({ type: 'cloud', endpoint: 'https://api.openai.com/v1', apiKey: 'sk-x', model: '' }, async (url, opts) => {
    got = { url, opts };
    return { ok: true, status: 200, json: async () => ({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] }) };
  });
  expect(r).toEqual(['gpt-4o-mini', 'gpt-4o']);
  expect(got.url).toBe('https://api.openai.com/v1/models');
  expect(got.opts.headers.Authorization).toBe('Bearer sk-x');
});

test('generic cloud endpoint defaults to openai shape', async () => {
  let got;
  const r = await fetchModels(CLOUD, async (url, opts) => {
    got = { url, opts };
    return { ok: true, status: 200, json: async () => ({ data: [{ id: 'm1' }] }) };
  });
  expect(r).toEqual(['m1']);
  expect(got.url).toBe('https://gateway.example.com/v1/models');
  expect(got.opts.headers.Authorization).toBe('Bearer sk-x');
});

test('anthropic uses X-Api-Key + version header', async () => {
  let got;
  const r = await fetchModels({ type: 'cloud', endpoint: 'https://api.anthropic.com/v1', apiKey: 'sk-a', model: '' }, async (url, opts) => {
    got = { url, opts };
    return { ok: true, status: 200, json: async () => ({ data: [{ id: 'claude-haiku-4-5' }] }) };
  });
  expect(r).toEqual(['claude-haiku-4-5']);
  expect(got.url).toBe('https://api.anthropic.com/v1/models');
  expect(got.opts.headers['X-Api-Key']).toBe('sk-a');
  expect(got.opts.headers['anthropic-version']).toBe('2023-06-01');
});

test('gemini puts key in query, strips models/ prefix', async () => {
  let got;
  const r = await fetchModels({ type: 'cloud', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'K', model: '' }, async (url, opts) => {
    got = { url, opts };
    return { ok: true, status: 200, json: async () => ({ models: [{ name: 'models/gemini-2.5-flash' }, { name: 'models/gemini-2.5-pro' }] }) };
  });
  expect(r).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
  expect(got.url).toContain('/models?key=K');
  expect(got.opts.headers.Authorization).toBeUndefined();
});

test('ollama hits origin /api/tags, reads models[].name', async () => {
  let got;
  const r = await fetchModels({ type: 'ollama', endpoint: 'http://localhost:11434/v1', apiKey: '', model: '' }, async (url, opts) => {
    got = { url, opts };
    return { ok: true, status: 200, json: async () => ({ models: [{ name: 'llama3:latest' }, { name: 'mistral' }] }) };
  });
  expect(r).toEqual(['llama3:latest', 'mistral']);
  expect(got.url).toBe('http://localhost:11434/api/tags');
});

test('failure returns null, no throw', async () => {
  expect(await fetchModels(CLOUD, async () => { throw new Error('down'); })).toBeNull();
  expect(await fetchModels(CLOUD, async () => ({ ok: false, status: 500, json: async () => ({}) }))).toBeNull();
  expect(await fetchModels(CLOUD, async () => ({ ok: true, status: 200, json: async () => ({ nope: [] }) }))).toBeNull();
});
