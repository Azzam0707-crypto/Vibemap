function extractRefs(filePath, text) {
  const src = String(text || '');
  const out = new Set();
  const local = (s) => {
    if (!s) return false;
    const t = s.trim();
    if (/^(https?:|data:|blob:|#|mailto:)/i.test(t)) return false;
    return t.startsWith('.') || t.startsWith('/') || /^[A-Za-z0-9_@-]+(\/[A-Za-z0-9_@+.-]+)+/.test(t);
  };
  const add = (s) => { if (local(s)) out.add(s.trim()); };
  const ext = String(filePath).slice(String(filePath).lastIndexOf('.')).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    for (const m of src.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    for (const m of src.matchAll(/<link[^>]+href\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    return [...out];
  }
  if (ext === '.css') {
    for (const m of src.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/gi)) add(m[1]);
    for (const m of src.matchAll(/url\(\s*["']?([^"'()]+)["']?\s*\)/gi)) add(m[1]);
    return [...out];
  }
  if (filePath.split('/').pop().toLowerCase() === 'package.json') {
    let scripts = {};
    try {
      scripts = JSON.parse(src).scripts || {};
    } catch {
      return [];
    }
    for (const val of Object.values(scripts)) {
      for (const tok of String(val).split(/[\s;&|()]+/)) {
        const t = tok.replace(/^[\"']+|[\"';,]+$/g, '');
        if (/^\.\.?\/[^"'`\s]*\.[A-Za-z0-9]+$/.test(t)) add(t);
      }
    }
    return [...out];
  }
  return [];
}

module.exports = { extractRefs };
