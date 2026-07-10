/**
 * Shared helpers/constants used across multiple report components.
 */
export const CAMPAIGN_COLORS = ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EC4899'];

/** Renders an <img> if url present, else a placeholder with the first character of label. */
export function ImgOrPlaceholder({ url, label, cls }: { url: string; label: string; cls?: string }) {
  if (url) {
    return <img src={url} alt={label} draggable={false} className={`rounded object-cover ${cls ?? ''}`} />;
  }
  return (
    <div
      className={`flex items-center justify-center rounded bg-surface-hover text-[10px] text-foreground-muted ${cls ?? ''}`}
    >
      {label.slice(0, 1) || '?'}
    </div>
  );
}
