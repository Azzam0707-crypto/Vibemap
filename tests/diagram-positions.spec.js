const { test, expect } = require('@playwright/test');
const { generateDiagram } = require('../diagram');

const file = (filePath) => ({ filePath, entryType: 'file', fileExt: '.js', sizeBytes: 10, depth: 1 });
const pc = (filePath, importsChanged) => ({ filePath, functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged });

test('positions follow dagre ranks, isolated node placed', () => {
  const entries = [file('a.js'), file('b.js'), file('iso.js')].map((e) => e);
  const parsed = [pc('a.js', ['./b']), pc('b.js', []), pc('iso.js', [])];
  const d = generateDiagram(entries, parsed);
  expect(d.positions).toBeTruthy();
  expect(d.positions['a.js']).toBeTruthy();
  // edge direction: a imports b, dagre LR puts a left of b
  expect(d.positions['a.js'].x).toBeLessThan(d.positions['b.js'].x);
  // isolated node still placed, finite coords
  expect(Number.isFinite(d.positions['iso.js'].x)).toBe(true);
  expect(Number.isFinite(d.positions['iso.js'].y)).toBe(true);
  // bounds cover all nodes
  expect(d.bounds.width).toBeGreaterThan(0);
  expect(d.bounds.height).toBeGreaterThan(0);
});

test('positions differ from naive grid', () => {
  const entries = [file('a.js'), file('b.js'), file('c.js')];
  const parsed = [pc('a.js', ['./c']), pc('b.js', []), pc('c.js', [])];
  const d = generateDiagram(entries, parsed);
  // naive grid: a=(20,20) b=(210,20) c=(400,20); dagre ranks put c right of a, b isolated elsewhere
  const naiveY = { 'a.js': 20, 'b.js': 20, 'c.js': 20 };
  const same = ['a.js', 'b.js', 'c.js'].every((id) => d.positions[id].y === naiveY[id]);
  expect(same).toBe(false);
});
