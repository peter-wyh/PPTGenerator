/** 本地时区今天，YYYY-MM-DD。impure（读系统时钟）；独立成文件以保持 periodRange.ts 纯净。 */
export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
