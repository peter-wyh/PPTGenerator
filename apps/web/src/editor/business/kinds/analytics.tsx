import {
  ACCENT,
  BAR_FADE,
  Base,
  Chips,
  Label,
  Title,
  type RenderCtx,
} from '../shared';

/* --------------------- content-analysis / funnel ----------------- */
export function renderFunnel(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  const widths = [100, 72, 46, 28];
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 18 }}>
        <div>
          <Label item={item} />
          <Title text={title} style={{ marginTop: 5 }} />
          <div style={{ fontSize: 10, lineHeight: 1.5, color: '#777', marginTop: 8 }}>{meta}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          {details.map((x, i) => (
            <div
              key={i}
              style={{
                height: 24,
                width: `${widths[i % 4]}%`,
                margin: '0 auto',
                background: BAR_FADE[i % 4],
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 9px',
                color: i < 2 ? '#FFF' : '#7C2D12',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <span>{x}</span>
              <span>{widths[i % 4]}%</span>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}

/* ------------------------------ report -------------------------- */
export function renderReport(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant } = ctx;
  const summary = ['本期达成 112%', '环比 +18.4%', '下期动作 3 项'];
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%', display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 15 }}>
        <div>
          <Label item={item} />
          <Title text={title} style={{ marginTop: 5 }} />
          <div style={{ fontSize: 10, color: '#777', marginTop: 5 }}>{meta}</div>
          <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chips list={details.slice(0, 3)} />
          </div>
        </div>
        <div style={{ borderLeft: '1px solid #EEE', paddingLeft: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7 }}>
          {summary.map((s, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? ACCENT : '#555' }}>
              {s}
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}

/* ------------------------------ global -------------------------- */
export function renderGlobal(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, variant } = ctx;
  const chips = ['12 市场', '6 办公室', '1000+ 达人'];
  const dots = [
    { left: '22%', top: '26%' },
    { left: '78%', top: '40%' },
    { left: '50%', top: '68%' },
    { left: '96%', top: '65%' },
  ];
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div>
          <Label item={item} />
          <Title text={title} style={{ marginTop: 5 }} />
          <div style={{ fontSize: 10, color: '#777', marginTop: 6 }}>{meta}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 5 }}>
            {chips.map((c, i) => (
              <span key={i} style={{ fontSize: 9, padding: 5, background: '#FFF0E8', color: '#9A3412', borderRadius: 5 }}>{c}</span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'relative', background: '#FFF7F0', borderRadius: '50%', width: 130, height: 130, margin: 'auto', transform: 'scale(1,.64)' }}>
            {dots.map((d, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: d.left,
                  top: d.top,
                  width: 13,
                  height: 13,
                  background: i === 0 ? ACCENT : '#F59E0B',
                  border: '2px solid #FFF',
                  borderRadius: '50%',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Base>
  );
}
