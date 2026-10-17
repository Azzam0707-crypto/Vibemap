const parser = require('@babel/parser');
const path = require('path');

const CODE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function empty(filePath) {
  return { filePath, functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged: [] };
}

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) if (c && typeof c.type === 'string') walk(c, visit);
    } else if (child && typeof child.type === 'string') {
      walk(child, visit);
    }
  }
}

function extract(src) {
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const fns = new Map();
  const imports = new Set();
  walk(ast, (n) => {
    if (n.type === 'ImportDeclaration') imports.add(n.source.value);
    else if (n.type === 'CallExpression' && n.callee && n.callee.type === 'Identifier' && n.callee.name === 'require'
      && n.arguments && n.arguments.length === 1 && n.arguments[0].type === 'StringLiteral') {
      imports.add(n.arguments[0].value);
    }
  });
  for (const n of ast.program.body) {
    if (n.type === 'ImportDeclaration') imports.add(n.source.value);
    else if (n.type === 'FunctionDeclaration' && n.id) fns.set(n.id.name, src.slice(n.start, n.end));
    else if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (d.init && (d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression') && d.id.type === 'Identifier') {
          fns.set(d.id.name, src.slice(n.start, n.end));
        }
      }
    } else if (n.type === 'ExportNamedDeclaration' && n.declaration && n.declaration.type === 'FunctionDeclaration' && n.declaration.id) {
      fns.set(n.declaration.id.name, src.slice(n.start, n.end));
    }
  }
  return { fns, imports };
}

function parseCodeChange(filePath, oldSrc, newSrc) {
  if (!CODE_EXTS.has(path.extname(filePath))) return empty(filePath);
  let a;
  let b;
  try {
    a = extract(oldSrc || '');
    b = extract(newSrc || '');
  } catch {
    return empty(filePath);
  }
  const functionsAdded = [...b.fns.keys()].filter((k) => !a.fns.has(k));
  const functionsRemoved = [...a.fns.keys()].filter((k) => !b.fns.has(k));
  const functionsModified = [...b.fns.keys()].filter((k) => a.fns.has(k) && a.fns.get(k) !== b.fns.get(k));
  const importsChanged = [...new Set([...a.imports, ...b.imports])].filter((m) => !a.imports.has(m) || !b.imports.has(m));
  return { filePath, functionsAdded, functionsRemoved, functionsModified, importsChanged };
}

module.exports = { parseCodeChange };
