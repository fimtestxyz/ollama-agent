export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  if (diff < 2 * day) return "yesterday";
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear()
    ? date
    : `${date}/${String(d.getFullYear()).slice(2)}`;
}
