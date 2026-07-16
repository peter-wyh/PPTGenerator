import {
  ACCENT,
  Base,
  INK,
  Label,
  mono,
  Title,
  type RenderCtx,
} from '../shared';

/* ---------------------------- cover ---------------------------- */
export function renderCover(ctx: RenderCtx): React.ReactNode {
  const { title, meta, details, variant } = ctx;
  if (variant === 'light') {
    return (
      <Base variant={variant}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', padding: 30, gap: 16, height: '100%', background: 'var(--foreground-inverse)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: ACCENT }}>
              {details[0] || ''}
            </div>
            <Title text={title} size={33} style={{ marginTop: 'auto', maxWidth: '88%' }} />
            <div style={{ fontSize: 12, color: 'var(--foreground-secondary)', marginTop: 14, maxWidth: '76%', lineHeight: 1.5 }}>
              {details[1] || meta}
            </div>
          </div>
          <div style={{ background: ACCENT, color: 'var(--foreground-inverse)', borderRadius: 9, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {details[0] && <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.4 }}>{details[0]}</span>}
          </div>
        </div>
      </Base>
    );
  }
  // standard: 渐变 hero
  return (
    <Base variant={variant} tone={INK}>
      <div
        style={{
          padding: 24,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--foreground-inverse)',
          background: 'linear-gradient(125deg, var(--color-neutral-text, var(--foreground-primary)) 0%, color-mix(in srgb, var(--color-neutral-text, var(--foreground-primary)) 70%, var(--color-primary, var(--color-primary))) 58%, var(--color-primary, var(--color-primary)) 150%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: 1 }}>
          <span>{details[0] || ''}</span>
          <span />
        </div>
        <Title text={title} size={31} color="var(--foreground-inverse)" style={{ marginTop: 'auto', maxWidth: '75%', lineHeight: 1.04, fontWeight: 800 }} />
        <div style={{ fontSize: 12, opacity: 0.78, marginTop: 12 }}>{details[1] || meta}</div>
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 12,
            borderTop: '1px solid color-mix(in srgb, var(--foreground-inverse) 25%, transparent)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
          }}
        >
          <span>{details[0] || '业务线 Logo'}</span>
          <span />
        </div>
      </div>
    </Base>
  );
}

/* ---------------------------- agenda ---------------------------- */
export function renderAgenda(ctx: RenderCtx): React.ReactNode {
  const { item, title, details, variant } = ctx;
  const chapters = details.length ? details : [];
  return (
    <Base variant={variant}>
      <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, height: '100%' }}>
        <div style={{ borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 7 }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
          {chapters.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 24px', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: ACCENT, ...mono }}>{'0' + (i + 1)}</span>
              <span style={{ fontWeight: 600 }}>{c}</span>
              <span style={{ color: 'var(--foreground-muted)', textAlign: 'right' }}>{'0' + (i + 2)}</span>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}

/* --------------------------- milestone -------------------------- */
export function renderMilestone(ctx: RenderCtx): React.ReactNode {
  const { item, title, details, variant } = ctx;
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Label item={item} />
        <Title text={title} style={{ marginTop: 5 }} />
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 20,
            borderTop: '2px solid color-mix(in srgb, var(--color-primary) 20%, white)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 8,
          }}
        >
          {details.map((x, i) => (
            <div key={i} style={{ position: 'relative', paddingTop: 10 }}>
              <div
                style={{
                  position: 'absolute',
                  top: -7,
                  left: 0,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: i === details.length - 1 ? ACCENT : INK,
                }}
              />
              <div style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{'0' + (i + 1)}</div>
              <div style={{ fontSize: 10, color: 'var(--foreground-secondary)', marginTop: 3 }}>{x}</div>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}
