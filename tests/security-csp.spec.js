const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp } = require('./helpers');

test('no CSP violations on launch and dashboard', async () => {
  const violations = [];
  const { app, win } = await launchApp(electron);
  win.on('console', (m) => {
    const t = m.text();
    if (/violates the following Content Security Policy|Refused to/i.test(t)) violations.push(t);
  });
  await win.waitForTimeout(1500);
  expect(await win.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'))).toBe(true);
  expect(violations).toEqual([]);
  await app.close();
});
