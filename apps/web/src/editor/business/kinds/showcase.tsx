import {
  ACCENT,
  Base,
  Chips,
  INK,
  Label,
  mono,
  splitStat,
  Title,
  type RenderCtx,
} from '../shared';

/* -------------------------- case-showcase ----------------------- */
export function renderCaseShowcase(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  if (variant === 'results') {
    const hero = details[3] ? splitStat(details[3]) : details[0] ? splitStat(details[0]) : null;
    return (
      <Base variant={variant}>
        <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.1fr' }}>
          <div style={{ padding: 22, background: ACCENT, color: 'var(--foreground-inverse)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', opacity: 0.75 }}>{item.name.toUpperCase()}</div>
            {hero ? (
              <>
                <div style={{ marginTop: 'auto', ...mono, fontWeight: 800, fontSize: 43 }}>{hero.value}</div>
                <div style={{ fontSize: 13, marginTop: 5 }}>{hero.label}</div>
              </>
            ) : (
              <div style={{ marginTop: 'auto', ...mono, fontWeight: 800, fontSize: 43, opacity: 0.4 }}>—</div>
            )}
            <div style={{ fontSize: 10, lineHeight: 1.5, opacity: 0.8, marginTop: 10 }}>{details[1] || details[0] || ''}</div>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 5 }} />
            <div style={{ fontSize: 10, color: 'var(--foreground-muted)', lineHeight: 1.4, marginTop: 6 }}>{meta}</div>
            <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <Chips list={details} />
            </div>
          </div>
        </div>
      </Base>
    );
  }
  // standard: 杂志风 + 图片卡
  return (
    <Base variant={variant}>
      <div style={{ padding: 16, height: '100%', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
        <div
          style={{
            position: 'relative',
            background: `linear-gradient(145deg,color-mix(in srgb, var(--color-primary) 15%, transparent),color-mix(in srgb, var(--color-primary) 52%, transparent))`,
            borderRadius: 8,
            padding: 13,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', color: 'var(--foreground-inverse)', fontSize: 10, fontWeight: 700, letterSpacing: '.7px' }}>{item.name.toUpperCase()}</div>
          <Title text={title} size={20} color="var(--foreground-inverse)" style={{ position: 'relative', marginTop: 8, maxWidth: '78%', textShadow: '0 1px 12px rgba(0,0,0,.24)' }} />
          {details[0] && <div style={{ position: 'absolute', left: 12, bottom: 13, color: 'var(--foreground-inverse)', fontSize: 10 }}>{details[0]}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Label item={item} />
          <div style={{ fontSize: 10, color: 'var(--foreground-muted)', lineHeight: 1.45, marginTop: 4 }}>{meta}</div>
          <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Chips list={details} />
          </div>
        </div>
      </div>
    </Base>
  );
}

/* -------------------------- retrospective ----------------------- */
export function renderRetrospective(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  const eyebrows = ['保留', '优化', '推荐', '目标'];
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 16 }}>
        <div>
          <Label item={item} />
          <Title text={title} style={{ marginTop: 5 }} />
          <div style={{ fontSize: 10, color: 'var(--foreground-muted)', lineHeight: 1.5, marginTop: 8 }}>{meta}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, alignContent: 'center' }}>
          {details.map((x, i) => (
            <div
              key={i}
              style={{
                padding: 10,
                background: i === 0 ? INK : 'var(--surface-subtle)',
                color: i === 0 ? 'var(--foreground-inverse)' : 'var(--foreground-primary)',
                borderRadius: 7,
                minHeight: 48,
              }}
            >
              <div style={{ fontSize: 9, opacity: 0.65 }}>{eyebrows[i] || ''}</div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{x}</div>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}
