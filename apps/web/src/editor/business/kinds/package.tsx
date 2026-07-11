import {
  ACCENT,
  Base,
  Label,
  mono,
  Title,
  type RenderCtx,
} from '../shared';

/* ----------------------------- package -------------------------- */
export function renderPackage(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  if (variant === 'table') {
    const rows: [string, string, string, string][] = [
      ['服务周期', '4 周', '6 周', '8 周'],
      ['创作者数量', '20 位', '50 位', '80 位'],
      ['媒体资源位', '—', '2 个', '4 个'],
      ['套餐价格', '$30K', '$80K', '$150K'],
    ];
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
          <div style={{ marginTop: 12, border: '1px solid var(--border-default)', borderRadius: 7, overflow: 'hidden' }}>
            {rows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.3fr repeat(3,1fr)',
                  background: i === 3 ? 'color-mix(in srgb, var(--color-primary) 8%, white)' : i === 0 ? 'var(--surface-subtle)' : 'var(--foreground-inverse)',
                  borderBottom: i < 3 ? '1px solid var(--border-default)' : undefined,
                }}
              >
                <div style={{ padding: '7px 9px', fontSize: 10, fontWeight: 600 }}>{row[0]}</div>
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    style={{
                      padding: '7px 9px',
                      textAlign: 'center',
                      fontSize: 10,
                      fontWeight: i === 3 ? 700 : 500,
                      fontFamily: i === 3 ? 'var(--font-number)' : 'var(--font-text)',
                      color: j === 1 ? ACCENT : 'var(--foreground-secondary)',
                    }}
                  >
                    {row[j]}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Base>
    );
  }
  // standard: 3 套餐卡
  const tiers = ['A 轻量试水', 'B 增长进阶', 'C 品牌整合'];
  const prices = [30, 80, 150];
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%' }}>
        <Label item={item} />
        <Title text={title} style={{ marginTop: 5 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginTop: 14 }}>
          {tiers.map((t, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${i === 1 ? ACCENT : 'var(--border-default)'}`,
                borderRadius: 7,
                padding: 10,
                background: i === 1 ? 'color-mix(in srgb, var(--color-primary) 8%, white)' : 'var(--foreground-inverse)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700 }}>{t}</div>
              <div style={{ ...mono, fontWeight: 700, fontSize: 18, marginTop: 5 }}>${prices[i]}K</div>
              <div style={{ fontSize: 9, color: 'var(--foreground-muted)', marginTop: 8, lineHeight: 1.5 }}>{details.slice(0, 2).join(' · ')}</div>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}

/* ---------------------------- challenge ------------------------- */
export function renderChallenge(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 5 }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--foreground-muted)', maxWidth: '36%', textAlign: 'right' }}>{meta}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 13 }}>
          {details.map((x, i) => (
            <div key={i} style={{ padding: 10, border: '1px solid var(--border-default)', borderRadius: 7, display: 'flex', gap: 9 }}>
              <div style={{ ...mono, fontWeight: 700, fontSize: 18, color: ACCENT }}>{'0' + (i + 1)}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{x}</div>
                <div style={{ fontSize: 9, color: 'var(--foreground-muted)', marginTop: 3 }}>识别信号与行动方向</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}
