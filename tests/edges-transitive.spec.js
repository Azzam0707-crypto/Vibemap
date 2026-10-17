const { test, expect } = require('@playwright/test');
const { generateDiagram } = require('../diagram');

const file = (filePath) => ({ filePath, entryType: 'file', fileExt: '.js', sizeBytes: 10, depth: 2 });
const pc = (filePath, importsChanged) => ({ filePath, functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged });

test('2-hop chain adds transitive edge, 3-hop does not', () => {
  const entries = ['a.js', 'b.js', 'c.js', 'd.js'].map(file);
  const parsed = [
    pc('a.js', ['./b']),
    pc('b.js', ['./c']),
    pc('c.js', ['./d']),
    pc('d.js', []),
  ];
  const d = generateDiagram(entries, parsed, []);
  expect(d.edges).toContainEqual({ from: 'a.js', to: 'b.js', kind: 'direct' });
  expect(d.edges).toContainEqual({ from: 'a.js', to: 'c.js', kind: 'transitive' });
  expect(d.edges.some((e) => e.from === 'a.js' && e.to === 'd.js')).toBe(false);
});

test('direct edge wins over transitive for same pair', () => {
  const entries = ['a.js', 'b.js', 'c.js'].map(file);
  const parsed = [
    pc('a.js', ['./b', './c']),
    pc('b.js', ['./c']),
    pc('c.js', []),
  ];
  const d = generateDiagram(entries, parsed, []);
  const ac = d.edges.filter((e) => e.from === 'a.js' && e.to === 'c.js');
  expect(ac).toEqual([{ from: 'a.js', to: 'c.js', kind: 'direct' }]);
});

test('existing edges carry kind direct', () => {
  const entries = ['a.js', 'b.js'].map(file);
  const d = generateDiagram(entries, [pc('a.js', ['./b']), pc('b.js', [])], []);
  expect(d.edges).toEqual([{ from: 'a.js', to: 'b.js', kind: 'direct' }]);
});
