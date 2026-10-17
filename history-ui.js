function relTime(iso, now) {
  const then = iso instanceof Date ? iso : new Date(iso);
  const ref = now instanceof Date ? now : now ? new Date(now) : new Date();
  const mins = Math.max(0, Math.floor((ref - then) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins === 1 ? '1 minute ago' : mins + ' minutes ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : hours + ' hours ago';
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOf(ref) - startOf(then)) / 86400000);
  if (days <= 1) return 'Yesterday';
  return days + ' days ago';
}

if (typeof module !== 'undefined') module.exports = { relTime };
if (typeof window !== 'undefined') window.historyUi = { relTime };
