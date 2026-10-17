const noSlash = (s) => String(s || '').replace(/\/+$/, '');

function originOf(endpoint) {
  try {
    return new URL(endpoint).origin;
  } catch {
    return noSlash(endpoint).split('/').slice(0, 3).join('/');
  }
}

function idsFromData(data) {
  if (!data || !Array.isArray(data.data)) return null;
  const ids = data.data.map((m) => (m && m.id != null ? String(m.id) : '')).filter(Boolean);
  return ids;
}

async function fetchModels(cfg, fetchImpl = globalThis.fetch) {
  const type = cfg && cfg.type;
  const endpoint = noSlash(cfg && cfg.endpoint);
  const key = (cfg && cfg.apiKey) || '';
  const e = endpoint.toLowerCase();
  const json = { 'Content-Type': 'application/json' };
  try {
    if (type === 'ollama' || e.includes('localhost:11434')) {
      const res = await fetchImpl(originOf(endpoint) + '/api/tags', { headers: json });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.models)) return null;
      return data.models.map((m) => (m && m.name != null ? String(m.name) : '')).filter(Boolean);
    }
    if (e.includes('generativelanguage.googleapis.com')) {
      const res = await fetchImpl(endpoint + '/models?key=' + encodeURIComponent(key), { headers: json });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.models)) return null;
      return data.models.map((m) => String((m && m.name) || '').replace(/^models\//, '')).filter(Boolean);
    }
    if (e.includes('anthropic.com')) {
      const res = await fetchImpl(endpoint + '/models', { headers: { ...json, 'X-Api-Key': key, 'anthropic-version': '2023-06-01' } });
      if (!res.ok) return null;
      return idsFromData(await res.json());
    }
    const res = await fetchImpl(endpoint + '/models', { headers: { ...json, Authorization: 'Bearer ' + key } });
    if (!res.ok) return null;
    return idsFromData(await res.json());
  } catch {
    return null;
  }
}

module.exports = { fetchModels };
