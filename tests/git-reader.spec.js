const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { readGitChanges } = require('../git-reader');

function git(cwd, cmd) {
  execSync(`git ${cmd}`, { cwd, stdio: 'ignore' });
}

test('returns [] without .git, no throw', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-nogit-'));
  try {
    await expect(readGitChanges(tmp)).resolves.toEqual([]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('reads RawChange from fixture repo', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-git-'));
  try {
    git(tmp, 'init');
    git(tmp, 'config user.email t@t.t');
    git(tmp, 'config user.name t');
    fs.writeFileSync(path.join(tmp, 'a.js'), 'function foo() { return 1; }\n');
    git(tmp, 'add a.js');
    git(tmp, 'commit -m one');
    fs.writeFileSync(path.join(tmp, 'a.js'), 'function foo() { return 2; }\nfunction bar() {}\n');
    fs.writeFileSync(path.join(tmp, 'b.js'), 'console.log(1);\n');
    const changes = await readGitChanges(tmp);
    const byPath = Object.fromEntries(changes.map((c) => [c.filePath, c]));
    expect(byPath['a.js'].changeType).toBe('modified');
    expect(byPath['a.js'].linesAdded).toBeGreaterThan(0);
    expect(byPath['a.js'].diffText).toContain('foo');
    expect(byPath['b.js'].changeType).toBe('added');
    for (const c of changes) {
      expect(typeof c.filePath).toBe('string');
      expect(typeof c.diffText).toBe('string');
      expect(typeof c.linesAdded).toBe('number');
      expect(typeof c.linesRemoved).toBe('number');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
