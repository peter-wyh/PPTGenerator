import {
  ACCENT,
  Base,
  Label,
  STAT_COLORS,
  Title,
  type RenderCtx,
} from '../shared';

/* --------------------------- brand-wall ------------------------- */
export function renderBrandWall(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  const colors = ['var(--foreground-primary)', ACCENT, 'var(--foreground-muted)', 'var(--foreground-primary)', 'var(--foreground-muted)'];
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 5 }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{meta}</div>
        </div>
        <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
          {details.map((x, i) => (
            <div
              key={i}
              style={{
                height: 42,
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
                fontFamily: 'var(--font-heading)',
                color: colors[i % colors.length],
              }}
            >
              {x}
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}

/* ------------------------ org / service ------------------------- */
export function renderOrgService(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%' }}>
        <Label item={item} />
        <Title text={title} style={{ marginTop: 5 }} />
        <div style={{ fontSize: 10, color: 'var(--foreground-muted)', marginTop: 4 }}>{meta}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 18 }}>
          {details.map((x, i) => (
            <div key={i} style={{ padding: '13px 10px', borderTop: `3px solid ${STAT_COLORS[i % 4]}`, background: 'var(--surface-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{x}</div>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}
