const MAX_DETAIL_FILES = 60;
const MAX_DIFF_CHARS = 1500;

const ENTRY_BASENAMES = new Set(['index.js', 'index.jsx', 'index.ts', 'index.tsx', 'main.js', 'main.jsx', 'main.ts', 'main.tsx', 'app.js', 'app.jsx', 'app.ts', 'app.tsx', 'server.js', 'app.py', 'main.py', 'server.py']);

function baseName(f) {
  return String(f).split('/').pop().toLowerCase();
}

function buildPrompt(entries, changes, parsedChanges) {
  const allFiles = (entries || []).filter((e) => e.entryType === 'file').map((e) => e.filePath);
  const byChange = new Map((changes || []).map((c) => [c.filePath, c]));
  const byParsed = new Map((parsedChanges || []).map((p) => [p.filePath, p]));
  const degree = new Map(allFiles.map((f) => [f, 0]));
  for (const p of parsedChanges || []) {
    for (const spec of p.importsChanged || []) {
      const s = String(spec).replace(/^(\.\.?\/)+/, '').split('/').pop();
      const hit = allFiles.find((f) => f === spec || f.split('/').pop() === s);
      if (hit) {
        degree.set(p.filePath, (degree.get(p.filePath) || 0) + 1);
        degree.set(hit, (degree.get(hit) || 0) + 1);
      }
    }
  }
  const priority = (f) => (byChange.has(f) ? 2 : 0) + (ENTRY_BASENAMES.has(baseName(f)) ? 1 : 0);
  const ranked = [...allFiles].sort((a, b) => priority(b) - priority(a) || (degree.get(b) || 0) - (degree.get(a) || 0));
  const detailed = ranked.slice(0, MAX_DETAIL_FILES);
  const rest = ranked.slice(MAX_DETAIL_FILES);
  const detail = detailed.map((f) => {
    const c = byChange.get(f) || {};
    const p = byParsed.get(f) || {};
    let diff = typeof c.diffText === 'string' ? c.diffText : '';
    if (diff.length > MAX_DIFF_CHARS) diff = diff.slice(0, MAX_DIFF_CHARS) + '\n...[truncated]';
    return { filePath: f, changeType: c.changeType || 'unchanged', diffText: diff, functionsAdded: p.functionsAdded || [], functionsRemoved: p.functionsRemoved || [], functionsModified: p.functionsModified || [], importsChanged: p.importsChanged || [] };
  });
  let prompt = 'Explain this project in plain language for a non-technical person. Reply with JSON only: {"overallSummary": "...", "fileSummaries": [{"filePath": "...", "summary": "..."}]}.\n'
    + 'Files in detail (' + detailed.length + ' most relevant): ' + JSON.stringify(detail) + '\n';
  if (rest.length > 0) {
    prompt += 'Other files, name only (' + rest.length + ' more files not detailed): ' + JSON.stringify(rest) + '\n';
  }
  return prompt;
}

function toSummary(obj) {
  if (!obj || typeof obj.overallSummary !== 'string' || !Array.isArray(obj.fileSummaries)) return null;
  return {
    ok: true,
    overallSummary: obj.overallSummary,
    fileSummaries: obj.fileSummaries.map((f) => ({ filePath: String(f.filePath), summary: String(f.summary) })),
  };
}

function parseJsonLoose(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new Error('unparseable');
  }
}

function err(e) {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

const noSlash = (s) => String(s || '').replace(/\/+$/, '');

async function summarize(entries, changes, parsedChanges, providerConfig, fetchImpl = globalThis.fetch) {
  const cfg = providerConfig || {};
  const prompt = buildPrompt(entries, changes, parsedChanges);
  const target = cfg.type === 'ollama' ? noSlash(cfg.endpoint) + '/api/chat' : noSlash(cfg.endpoint) + '/chat/completions';
  console.log('summarizer: POST', target, 'model:', cfg.model);
  try {
    if (cfg.type === 'ollama') {
      const res = await fetchImpl(noSlash(cfg.endpoint) + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.model, stream: false, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) return { ok: false, error: 'AI request failed with status ' + res.status };
      const data = await res.json();
      const out = toSummary(parseJsonLoose(data.message.content));
      return out || { ok: false, error: 'AI returned an unexpected response' };
    }
    const res = await fetchImpl(noSlash(cfg.endpoint) + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return { ok: false, error: 'AI request failed with status ' + res.status };
    const data = await res.json();
    const out = toSummary(parseJsonLoose(data.choices[0].message.content));
    return out || { ok: false, error: 'AI returned an unexpected response' };
  } catch (e) {
    return err(e);
  }
}

module.exports = { summarize };
