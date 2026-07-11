import {
  ACCENT,
  Base,
  CAL_BANDS,
  INK,
  Label,
  mono,
  Title,
  type RenderCtx,
} from '../shared';

/* -------------------- process / campaign-plan -------------------- */
export function renderProcess(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  if (variant === 'cards') {
    return (
      <Base variant={variant}>
        <div style={{ padding: 18, height: '100%', display: 'grid', gridTemplateColumns: '190px 1fr', gap: 18 }}>
          <div>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 5 }} />
            <div style={{ fontSize: 10, color: 'var(--foreground-muted)', lineHeight: 1.5, marginTop: 8 }}>{meta}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {details.map((x, i) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  background: i === 0 ? INK : 'color-mix(in srgb, var(--color-primary) 8%, white)',
                  color: i === 0 ? 'var(--foreground-inverse)' : 'var(--foreground-primary)',
                  borderRadius: 7,
                }}
              >
                <div style={{ ...mono, fontWeight: 700, fontSize: 13, opacity: 0.65 }}>{'0' + (i + 1)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 7 }}>{x}</div>
              </div>
            ))}
          </div>
        </div>
      </Base>
    );
  }
  // standard: 横向箭头流
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Label item={item} />
        <Title text={title} style={{ marginTop: 5 }} />
        <div style={{ fontSize: 10, color: 'var(--foreground-muted)', marginTop: 4 }}>{meta}</div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {details.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i === details.length - 1 ? 1 : 1.15 }}>
              <div
                style={{
                  flex: 1,
                  minHeight: 54,
                  padding: 9,
                  background: i === 0 ? ACCENT : 'color-mix(in srgb, var(--color-primary) 8%, white)',
                  color: i === 0 ? 'var(--foreground-inverse)' : 'var(--foreground-primary)',
                  borderRadius: 7,
                }}
              >
                <div style={{ fontSize: 9, opacity: 0.7 }}>{'0' + (i + 1)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{x}</div>
              </div>
              {i < details.length - 1 && <span style={{ color: ACCENT, fontSize: 14 }}>→</span>}
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}

/* ---------------------------- calendar -------------------------- */
export function renderCalendar(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 5 }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--foreground-muted)', maxWidth: '42%', textAlign: 'right' }}>{meta}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginTop: 18 }}>
          {details.map((x, i) => (
            <div key={i} style={{ border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ background: CAL_BANDS[i % 4], padding: 5, fontSize: 9, fontWeight: 700, color: 'var(--foreground-secondary)' }}>Q{i + 1}</div>
              <div style={{ padding: 9, fontSize: 11, fontWeight: 700, minHeight: 42 }}>{x}</div>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}
