import {
  ACCENT,
  AVATAR_DOTS,
  Base,
  INK,
  Label,
  mono,
  splitStat,
  STAT_COLORS,
  Title,
  type RenderCtx,
} from '../shared';

/** 中性达人头像占位（取 title 首字母），不再依赖写死的外部图片 URL。 */
function AvatarPlaceholder({ title, size }: { title: string; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'color-mix(in srgb, var(--color-primary) 14%, white)',
        color: 'var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {(title || '?').trim().slice(0, 1).toUpperCase() || '?'}
    </div>
  );
}

/* ------------------------ campaign-overview ---------------------- */
export function renderCampaignOverview(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  if (variant === 'stats') {
    const hero = details[0] ? splitStat(details[0]) : null;
    return (
      <Base variant={variant}>
        <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}>
          <div style={{ padding: 20, background: INK, color: 'var(--foreground-inverse)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, letterSpacing: '.8px', opacity: 0.65 }}>{item.name.toUpperCase()} · 核心指标</div>
            {hero ? (
              <>
                <div style={{ marginTop: 'auto', ...mono, fontWeight: 800, fontSize: 38 }}>{hero.value}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{hero.label}</div>
              </>
            ) : (
              <div style={{ marginTop: 'auto', ...mono, fontWeight: 800, fontSize: 38, opacity: 0.4 }}>—</div>
            )}
          </div>
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, alignContent: 'center' }}>
            {details.slice(1).map((x, i) => {
              const { label, value } = splitStat(x);
              return (
                <div key={i} style={{ padding: 10, background: 'color-mix(in srgb, var(--color-primary) 8%, white)', borderRadius: 7 }}>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 17, color: ACCENT }}>{value}</div>
                  <div style={{ fontSize: 9, color: 'var(--foreground-secondary)', marginTop: 5 }}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Base>
    );
  }
  // standard
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 5 }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>{meta}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 17 }}>
          {details.map((x, i) => {
            const { label, value } = splitStat(x);
            return (
              <div key={i} style={{ borderLeft: `3px solid ${STAT_COLORS[i % 4]}`, paddingLeft: 9 }}>
                <div style={{ ...mono, fontWeight: 700, fontSize: 18 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--foreground-muted)', marginTop: 4 }}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Base>
  );
}

/* -------------------------- creator-profile ---------------------- */
export function renderCreatorProfile(ctx: RenderCtx): React.ReactNode {
  const { title, meta, details, variant } = ctx;
  if (variant === 'stats') {
    return (
      <Base variant={variant}>
        <div style={{ height: '100%', display: 'grid', gridTemplateRows: '112px 1fr' }}>
          <div style={{ padding: '16px 20px', background: INK, color: 'var(--foreground-inverse)', display: 'flex', alignItems: 'center', gap: 15 }}>
            <AvatarPlaceholder title={title} size={68} />
            <div>
              <Title text={title} size={23} color="var(--foreground-inverse)" />
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>{meta}</div>
              {details[0] && <div style={{ fontSize: 9, color: 'color-mix(in srgb, var(--color-secondary) 50%, white)', marginTop: 7 }}>{details[0]}</div>}
            </div>
          </div>
          <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9 }}>
            {details.slice(1, 5).map((x, i) => {
              if (i === 3)
                return (
                  <div key={i} style={{ borderLeft: `2px solid ${STAT_COLORS[3]}`, paddingLeft: 8 }}>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 15, lineHeight: 1.15 }}>{x}</div>
                  </div>
                );
              const p = x.split(' ');
              return (
                <div key={i} style={{ borderLeft: `2px solid ${STAT_COLORS[i % 4]}`, paddingLeft: 8 }}>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 17 }}>{p[0]}</div>
                  <div style={{ fontSize: 9, color: 'var(--foreground-muted)', marginTop: 4 }}>{p.slice(1).join(' ')}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Base>
    );
  }
  // standard: 3 列媒体资料
  return (
    <Base variant={variant}>
      <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '150px 1fr 205px', background: 'var(--foreground-inverse)' }}>
        <div style={{ position: 'relative', background: 'color-mix(in srgb, var(--color-primary) 8%, white)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AvatarPlaceholder title={title} size={84} />
        </div>
        <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Title text={title} size={23} />
            <span style={{ width: 15, height: 15, borderRadius: '50%', background: 'var(--blue)', color: 'var(--foreground-inverse)', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--foreground-secondary)', marginTop: 3 }}>{meta}</div>
          <div style={{ marginTop: 13, display: 'flex', gap: 6 }}>
            {details[0] && (
              <span style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, white)', color: 'var(--color-primary)', fontSize: 9, fontWeight: 700, padding: '5px 8px', borderRadius: 4 }}>{details[0]}</span>
            )}
          </div>
          <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>Audience profile: {details[4]}</div>
        </div>
        <div style={{ padding: '16px 15px', background: 'var(--surface-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, borderLeft: '1px solid var(--border-default)' }}>
          <span style={{ gridColumn: 'span 2', fontSize: 9, fontWeight: 700, color: 'var(--foreground-muted)', letterSpacing: '.5px', borderBottom: '1px solid var(--border-default)', paddingBottom: 4 }}>CREATOR PERFORMANCE</span>
          {details.slice(1, 4).map((x, i) => {
            const p = x.split(' ');
            return (
              <div key={i} style={{ gridColumn: i === 2 ? 'span 2' : undefined }}>
                <div style={{ ...mono, fontWeight: 700, fontSize: i === 2 ? 17 : 15 }}>{p[0]}</div>
                {i !== 2 && <div style={{ fontSize: 9, color: 'var(--foreground-muted)', marginTop: 2 }}>{p.slice(1).join(' ')}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </Base>
  );
}

/* --------------------------- creator-list ------------------------ */
export function renderCreatorList(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  return (
    <Base variant={variant}>
      <div style={{ padding: 16, height: '100%', display: 'flex', gap: 16 }}>
        <div style={{ width: '32%' }}>
          <Label item={item} />
          <Title text={title} style={{ marginTop: 5 }} />
          <div style={{ fontSize: 10, color: 'var(--foreground-muted)', marginTop: 10 }}>{meta}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {details.map((x, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px', alignItems: 'center', padding: 6, background: 'var(--surface-subtle)', borderRadius: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_DOTS[i % 4] }} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>{x}</span>
              <span style={{ fontSize: 9, color: 'var(--foreground-muted)', textAlign: 'right' }}>内容力 / 画像匹配</span>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}
