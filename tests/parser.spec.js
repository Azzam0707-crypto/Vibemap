const { test, expect } = require('@playwright/test');
const { parseCodeChange } = require('../parser');

const OLD = `import a from 'a';
function foo() { return 1; }
function oldFn() {}
`;
const NEW = `import b from 'b';
function foo() { return 2; }
function bar() {}
`;

test('detects added/removed/modified + imports', () => {
  const p = parseCodeChange('src/app.js', OLD, NEW);
  expect(p.filePath).toBe('src/app.js');
  expect(p.functionsAdded).toEqual(['bar']);
  expect(p.functionsRemoved).toEqual(['oldFn']);
  expect(p.functionsModified).toEqual(['foo']);
  expect(p.importsChanged.slice().sort()).toEqual(['a', 'b']);
});

test('non-JS/TS returns empty', () => {
  const p = parseCodeChange('README.md', OLD, NEW);
  expect(p).toEqual({ filePath: 'README.md', functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged: [] });
});

test('identical code yields empty', () => {
  const p = parseCodeChange('x.js', OLD, OLD);
  expect(p).toEqual({ filePath: 'x.js', functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged: [] });
});
