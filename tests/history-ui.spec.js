const { test, expect } = require('@playwright/test');

const cases = [
  [new Date('2026-10-11T12:00:00Z'), new Date('2026-10-11T11:59:30Z'), 'Just now'],
  [new Date('2026-10-11T12:00:00Z'), new Date('2026-10-11T11:30:00Z'), '30 minutes ago'],
  [new Date('2026-10-11T12:00:00Z'), new Date('2026-10-11T10:00:00Z'), '2 hours ago'],
  [new Date('2026-10-11T12:00:00Z'), new Date('2026-10-10T06:00:00Z'), 'Yesterday'],
  [new Date('2026-10-23T12:00:00Z'), new Date('2026-10-11T12:00:00Z'), '12 days ago'],
];

for (const [now, then, label] of cases) {
  test(`relTime ${label}`, () => {
    const { relTime } = require('../history-ui');
    expect(relTime(then.toISOString(), now)).toBe(label);
  });
}

test('relTime handles Date objects and future times', () => {
  const { relTime } = require('../history-ui');
  expect(relTime(new Date('2026-10-11T12:00:00Z'), new Date('2026-10-11T12:00:00Z'))).toBe('Just now');
});
