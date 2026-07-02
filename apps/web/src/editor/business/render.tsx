import type { BusinessBlockData } from '@mediakit/shared';
import { getBusinessItem, type VariantId } from './catalog';
import {
  ACCENT,
  AVATAR_DOTS,
  BAR_FADE,
  Base,
  CAL_BANDS,
  Chips,
  INK,
  Label,
  mono,
  splitStat,
  STAT_COLORS,
  Title,
  type RenderCtx,
} from './shared';

const AVATAR = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=480&q=85';
const CASE_BG = 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=85';

const DEDICATED = new Set([
  'cover+light',
  'process+cards',
  'campaign-plan+cards',
  'case-showcase+results',
  'campaign-overview+stats',
  'creator-profile+stats',
  'package+table',
]);

function isDedicated(kind: string, variant: VariantId): boolean {
  return DEDICATED.has(`${kind}+${variant}`);
}

/* ------------------------------ 通用变体 ------------------------------ */

function GenericCards(ctx: RenderCtx) {
  const { item, title, meta, details, variant } = ctx;
  return (
    <Base variant={variant} tone="#FFFFFF">
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '185px 1fr', gap: 16, height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Label item={item} />
          <Title text={title} style={{ marginTop: 6 }} />
          <div style={{ marginTop: 'auto', fontSize: 10, color: '#777', lineHeight: 1.5 }}>{meta}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, alignContent: 'center' }}>
          {details.map((x, i) => (
            <div
              key={i}
              style={{
                minHeight: 52,
                padding: 10,
                background: ['#1A1A1A', '#FFF0E8', '#FFF7F0', '#FAFAFA'][i % 4],
                color: i === 0 ? '#FFF' : '#333',
                borderRadius: 7,
              }}
            >
              <div style={{ ...mono, fontWeight: 700, fontSize: 10, opacity: 0.62 }}>{'0' + (i + 1)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, lineHeight: 1.25 }}>{x}</div>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}

function GenericLight(ctx: RenderCtx) {
  const { item, title, meta, details, variant } = ctx;
  return (
    <Base variant={variant}>
      <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 128px', gap: 16, height: '100%' }}>
        <div>
          <div style={{ ...mono, fontSize: 42, fontWeight: 800, lineHeight: 0.8, color: ACCENT }}>
            {item.id.slice(0, 2).toUpperCase()}
          </div>
          <Title text={title} style={{ marginTop: 12, maxWidth: '85%' }} />
          <div style={{ fontSize: 10, color: '#777', marginTop: 9, maxWidth: '82%', lineHeight: 1.55 }}>{meta}</div>
        </div>
        <div
          style={{
            borderLeft: '1px solid #F0E7E2',
            paddingLeft: 12,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          {details.slice(0, 4).map((x, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? ACCENT : '#555' }}>
              {x}
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}

function GenericAccent(ctx: RenderCtx) {
  const { item, title, meta, details } = ctx;
  return (
    <Base variant="accent" tone={INK}>
      <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '150px 1fr', background: INK, color: '#FFF' }}>
        <div
          style={{
            padding: 18,
            background: ACCENT,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px' }}>{item.name.toUpperCase()}</div>
          <div style={{ fontFamily: "'Funnel Sans', sans-serif", fontWeight: 800, fontSize: 38, lineHeight: 0.9 }}>
            {details.length}
          </div>
          <div style={{ fontSize: 10, lineHeight: 1.4 }}>
            关键增长
            <br />
            动作
          </div>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
          <Title text={title} size={22} color="#FFF" style={{ lineHeight: 1.1 }} />
          <div style={{ fontSize: 10, color: '#D1D5DB', lineHeight: 1.5, marginTop: 8 }}>{meta}</div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {details.map((x, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 8px',
                  border: `1px solid ${i === 0 ? ACCENT : '#4B5563'}`,
                  borderRadius: 20,
                  color: i === 0 ? '#FFB27D' : '#E5E7EB',
                  fontSize: 9,
                }}
              >
                {x}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Base>
  );
}

/* --------------------------- 默认兜底渲染 ---------------------------- */

function DefaultRender(ctx: RenderCtx) {
  const { item, title, meta, details, variant } = ctx;
  return (
    <Base variant={variant}>
      <div style={{ padding: 18, height: '100%', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 18 }}>
        <div>
          <Label item={item} />
          <Title text={title} style={{ marginTop: 5 }} />
          <div style={{ fontSize: 10, lineHeight: 1.55, color: '#777', marginTop: 10 }}>{meta}</div>
          <div style={{ height: 6, width: '45%', background: ACCENT, marginTop: 16 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, alignContent: 'center' }}>
          <Chips list={details} color="#FAFAFA" />
        </div>
      </div>
    </Base>
  );
}

/* ----------------------------- 各 kind 渲染 ---------------------------- */

function renderKind(ctx: RenderCtx): React.ReactNode {
  const { item, title, meta, details, variant, data } = ctx;
  const kind = data.businessKind;

  switch (kind) {
    /* ---------------------------- cover ---------------------------- */
    case 'cover': {
      if (variant === 'light') {
        return (
          <Base variant={variant}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', padding: 30, gap: 16, height: '100%', background: '#FFF' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: ACCENT }}>
                  {details[0] || 'MEDIATEK'}
                </div>
                <Title text={title} size={33} style={{ marginTop: 'auto', maxWidth: '88%' }} />
                <div style={{ fontSize: 12, color: '#666', marginTop: 14, maxWidth: '76%', lineHeight: 1.5 }}>
                  {details[1] || meta}
                </div>
              </div>
              <div style={{ background: ACCENT, color: '#FFF', borderRadius: 9, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>2026<br />Q4</span>
                <span style={{ fontSize: 10, lineHeight: 1.4 }}>TikTok<br />Growth Plan</span>
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
              color: '#FFF',
              background: 'linear-gradient(125deg,#1A1A1A 0%,#352116 58%,#FF5C00 150%)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: 1 }}>
              <span>MEDIATEK / BUSINESS</span>
              <span>2026 Q4</span>
            </div>
            <Title text={title} size={31} color="#FFF" style={{ marginTop: 'auto', maxWidth: '75%', lineHeight: 1.04, fontWeight: 800 }} />
            <div style={{ fontSize: 12, opacity: 0.78, marginTop: 12 }}>{details[1] || meta}</div>
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,.25)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
              }}
            >
              <span>{details[0] || '业务线 Logo'}</span>
              <span>www.mediakit.com</span>
            </div>
          </div>
        </Base>
      );
    }

    /* ---------------------------- agenda ---------------------------- */
    case 'agenda': {
      const chapters = ['公司概览', '服务与案例', '合作案例', 'Campaign 结案'];
      return (
        <Base variant={variant}>
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, height: '100%' }}>
            <div style={{ borderRight: '1px solid #F0E7E2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <Label item={item} />
                <Title text={title} style={{ marginTop: 7 }} />
              </div>
              <div style={{ fontSize: 10, color: '#888' }}>MediaKit Presentation</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
              {chapters.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 24px', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: ACCENT, ...mono }}>{'0' + (i + 1)}</span>
                  <span style={{ fontWeight: 600 }}>{c}</span>
                  <span style={{ color: '#999', textAlign: 'right' }}>{'0' + (i + 2)}</span>
                </div>
              ))}
            </div>
          </div>
        </Base>
      );
    }

    /* --------------------------- milestone -------------------------- */
    case 'milestone': {
      const years = ['2019', '2022', '2024', '2026'];
      return (
        <Base variant={variant}>
          <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 5 }} />
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 20,
                borderTop: '2px solid #FFDAC5',
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
                  <div style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{years[i] || ''}</div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>{x}</div>
                </div>
              ))}
            </div>
          </div>
        </Base>
      );
    }

    /* --------------------------- brand-wall ------------------------- */
    case 'brand-wall': {
      const colors = ['#1A1A1A', ACCENT, '#6B7280', '#1A1A1A', '#9CA3AF'];
      return (
        <Base variant={variant}>
          <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <Label item={item} />
                <Title text={title} style={{ marginTop: 5 }} />
              </div>
              <div style={{ fontSize: 11, color: '#777' }}>{meta}</div>
            </div>
            <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
              {details.map((x, i) => (
                <div
                  key={i}
                  style={{
                    height: 42,
                    border: '1px solid #EEE',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: "'Funnel Sans', sans-serif",
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
    case 'org':
    case 'service': {
      const subs = kind === 'org' ? ['20%', '25%', '35%', '20%'] : ['策略 · 执行 · 复盘', '策略 · 执行 · 复盘', '策略 · 执行 · 复盘', '策略 · 执行 · 复盘'];
      return (
        <Base variant={variant}>
          <div style={{ padding: 18, height: '100%' }}>
            <Label item={item} />
            <Title text={title} style={{ marginTop: 5 }} />
            <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>{meta}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 18 }}>
              {details.map((x, i) => (
                <div key={i} style={{ padding: '13px 10px', borderTop: `3px solid ${STAT_COLORS[i % 4]}`, background: '#FAFAFA' }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{x}</div>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 6 }}>{subs[i] || ''}</div>
                </div>
              ))}
            </div>
          </div>
        </Base>
      );
    }

    /* -------------------- process / campaign-plan -------------------- */
    case 'process':
    case 'campaign-plan': {
      if (variant === 'cards') {
        return (
          <Base variant={variant}>
            <div style={{ padding: 18, height: '100%', display: 'grid', gridTemplateColumns: '190px 1fr', gap: 18 }}>
              <div>
                <Label item={item} />
                <Title text={title} style={{ marginTop: 5 }} />
                <div style={{ fontSize: 10, color: '#777', lineHeight: 1.5, marginTop: 8 }}>{meta}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {details.map((x, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 10,
                      background: i === 0 ? INK : '#FFF7F0',
                      color: i === 0 ? '#FFF' : '#333',
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
            <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>{meta}</div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {details.map((x, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i === details.length - 1 ? 1 : 1.15 }}>
                  <div
                    style={{
                      flex: 1,
                      minHeight: 54,
                      padding: 9,
                      background: i === 0 ? ACCENT : '#FFF7F0',
                      color: i === 0 ? '#FFF' : '#333',
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
    case 'calendar': {
      return (
        <Base variant={variant}>
          <div style={{ padding: 18, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Label item={item} />
                <Title text={title} style={{ marginTop: 5 }} />
              </div>
              <div style={{ fontSize: 10, color: '#777', maxWidth: '42%', textAlign: 'right' }}>{meta}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginTop: 18 }}>
              {details.map((x, i) => (
                <div key={i} style={{ border: '1px solid #EEE', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ background: CAL_BANDS[i % 4], padding: 5, fontSize: 9, fontWeight: 700, color: '#666' }}>Q{i + 1}</div>
                  <div style={{ padding: 9, fontSize: 11, fontWeight: 700, minHeight: 42 }}>{x}</div>
                </div>
              ))}
            </div>
          </div>
        </Base>
      );
    }

    /* ------------------------ campaign-overview ---------------------- */
    case 'campaign-overview': {
      if (variant === 'stats') {
        return (
          <Base variant={variant}>
            <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}>
              <div style={{ padding: 20, background: INK, color: '#FFF', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 10, letterSpacing: '.8px', opacity: 0.65 }}>CAMPAIGN HERO METRIC</div>
                <div style={{ marginTop: 'auto', ...mono, fontWeight: 800, fontSize: 38 }}>12.6M</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Campaign impressions</div>
                <div style={{ fontSize: 10, opacity: 0.65, marginTop: 9 }}>+26% vs. original target</div>
              </div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, alignContent: 'center' }}>
                {details.slice(1).map((x, i) => {
                  const { label, value } = splitStat(x);
                  return (
                    <div key={i} style={{ padding: 10, background: '#FFF7F0', borderRadius: 7 }}>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 17, color: ACCENT }}>{value}</div>
                      <div style={{ fontSize: 9, color: '#666', marginTop: 5 }}>{label}</div>
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
              <div style={{ fontSize: 10, color: '#777' }}>{meta}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 17 }}>
              {details.map((x, i) => {
                const { label, value } = splitStat(x);
                return (
                  <div key={i} style={{ borderLeft: `3px solid ${STAT_COLORS[i % 4]}`, paddingLeft: 9 }}>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 18 }}>{value}</div>
                    <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Base>
      );
    }

    /* -------------------------- creator-profile ---------------------- */
    case 'creator-profile': {
      if (variant === 'stats') {
        return (
          <Base variant={variant}>
            <div style={{ height: '100%', display: 'grid', gridTemplateRows: '112px 1fr' }}>
              <div style={{ padding: '16px 20px', background: INK, color: '#FFF', display: 'flex', alignItems: 'center', gap: 15 }}>
                <img src={AVATAR} alt="" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <Title text={title} size={23} color="#FFF" />
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>{meta}</div>
                  <div style={{ fontSize: 9, color: '#FFB27D', marginTop: 7 }}>TIKTOK · {details[0]}</div>
                </div>
                <div style={{ marginLeft: 'auto', ...mono, fontWeight: 700, fontSize: 11, color: '#FFB27D', textAlign: 'right' }}>
                  TOP<br />PERFORMER
                </div>
              </div>
              <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9 }}>
                {details.slice(1, 5).map((x, i) => {
                  if (i === 3)
                    return (
                      <div key={i} style={{ borderLeft: `2px solid ${STAT_COLORS[3]}`, paddingLeft: 8 }}>
                        <div style={{ ...mono, fontWeight: 700, fontSize: 17 }}>18–34</div>
                        <div style={{ fontSize: 9, color: '#777', marginTop: 4 }}>Women · US / UK</div>
                      </div>
                    );
                  const p = x.split(' ');
                  return (
                    <div key={i} style={{ borderLeft: `2px solid ${STAT_COLORS[i % 4]}`, paddingLeft: 8 }}>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 17 }}>{p[0]}</div>
                      <div style={{ fontSize: 9, color: '#777', marginTop: 4 }}>{p.slice(1).join(' ')}</div>
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
          <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '150px 1fr 205px', background: '#FFF' }}>
            <div style={{ position: 'relative', background: '#F6E4DC', overflow: 'hidden' }}>
              <img src={AVATAR} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
            </div>
            <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Title text={title} size={23} />
                <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#3B82F6', color: '#FFF', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>{meta}</div>
              <div style={{ marginTop: 13, display: 'flex', gap: 6 }}>
                <span style={{ background: '#111', color: '#FFF', fontSize: 9, fontWeight: 700, padding: '5px 8px', borderRadius: 4 }}>TIKTOK</span>
                <span style={{ background: '#FFF0E8', color: '#C2410C', fontSize: 9, fontWeight: 700, padding: '5px 8px', borderRadius: 4 }}>{details[0]}</span>
              </div>
              <div style={{ marginTop: 'auto', fontSize: 10, color: '#777', lineHeight: 1.5 }}>Audience profile: {details[4]}</div>
            </div>
            <div style={{ padding: '16px 15px', background: '#FAFAFA', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, borderLeft: '1px solid #EEE' }}>
              <span style={{ gridColumn: 'span 2', fontSize: 9, fontWeight: 700, color: '#888', letterSpacing: '.5px', borderBottom: '1px solid #E5E7EB', paddingBottom: 4 }}>CREATOR PERFORMANCE</span>
              {details.slice(1, 4).map((x, i) => {
                const p = x.split(' ');
                return (
                  <div key={i} style={{ gridColumn: i === 2 ? 'span 2' : undefined }}>
                    <div style={{ ...mono, fontWeight: 700, fontSize: i === 2 ? 17 : 15 }}>{p[0]}</div>
                    {i !== 2 && <div style={{ fontSize: 9, color: '#777', marginTop: 2 }}>{p.slice(1).join(' ')}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </Base>
      );
    }

    /* --------------------------- creator-list ------------------------ */
    case 'creator-list': {
      return (
        <Base variant={variant}>
          <div style={{ padding: 16, height: '100%', display: 'flex', gap: 16 }}>
            <div style={{ width: '32%' }}>
              <Label item={item} />
              <Title text={title} style={{ marginTop: 5 }} />
              <div style={{ fontSize: 10, color: '#777', marginTop: 10 }}>{meta}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {details.map((x, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px', alignItems: 'center', padding: 6, background: '#FAFAFA', borderRadius: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_DOTS[i % 4] }} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{x}</span>
                  <span style={{ fontSize: 9, color: '#888', textAlign: 'right' }}>内容力 / 画像匹配</span>
                </div>
              ))}
            </div>
          </div>
        </Base>
      );
    }

    /* --------------------- content-analysis / funnel ----------------- */
    case 'content-analysis':
    case 'funnel': {
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

    /* ----------------------------- package -------------------------- */
    case 'package': {
      if (variant === 'table') {
        const rows: [string, string, string, string][] = [
          ['服务周期', '4 周', '6 周', '8 周'],
          ['创作者数量', '20 位', '50 位', '80 位'],
          ['媒体资源位', '—', '2 个', '4 个'],
          ['套餐价格', '¥30K', '¥80K', '¥150K'],
        ];
        return (
          <Base variant={variant}>
            <div style={{ padding: 18, height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <Label item={item} />
                  <Title text={title} style={{ marginTop: 5 }} />
                </div>
                <div style={{ fontSize: 10, color: '#777' }}>{meta}</div>
              </div>
              <div style={{ marginTop: 12, border: '1px solid #EEE', borderRadius: 7, overflow: 'hidden' }}>
                {rows.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.3fr repeat(3,1fr)',
                      background: i === 3 ? '#FFF7F0' : i === 0 ? '#FAFAFA' : '#FFF',
                      borderBottom: i < 3 ? '1px solid #EEE' : undefined,
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
                          fontFamily: i === 3 ? "'IBM Plex Mono', monospace" : 'Inter, sans-serif',
                          color: j === 1 ? ACCENT : '#555',
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
                    border: `1px solid ${i === 1 ? ACCENT : '#EEE'}`,
                    borderRadius: 7,
                    padding: 10,
                    background: i === 1 ? '#FFF7F0' : '#FFF',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{t}</div>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 18, marginTop: 5 }}>¥{prices[i]}K</div>
                  <div style={{ fontSize: 9, color: '#777', marginTop: 8, lineHeight: 1.5 }}>{details.slice(0, 2).join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
        </Base>
      );
    }

    /* ------------------------------ report -------------------------- */
    case 'report': {
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
    case 'global': {
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

    /* ---------------------------- challenge ------------------------- */
    case 'challenge': {
      return (
        <Base variant={variant}>
          <div style={{ padding: 18, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Label item={item} />
                <Title text={title} style={{ marginTop: 5 }} />
              </div>
              <div style={{ fontSize: 10, color: '#777', maxWidth: '36%', textAlign: 'right' }}>{meta}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 13 }}>
              {details.map((x, i) => (
                <div key={i} style={{ padding: 10, border: '1px solid #EEE', borderRadius: 7, display: 'flex', gap: 9 }}>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 18, color: ACCENT }}>{'0' + (i + 1)}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{x}</div>
                    <div style={{ fontSize: 9, color: '#888', marginTop: 3 }}>识别信号与行动方向</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Base>
      );
    }

    /* -------------------------- case-showcase ----------------------- */
    case 'case-showcase': {
      if (variant === 'results') {
        return (
          <Base variant={variant}>
            <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.1fr' }}>
              <div style={{ padding: 22, background: ACCENT, color: '#FFF', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', opacity: 0.75 }}>CASE RESULT</div>
                <div style={{ marginTop: 'auto', ...mono, fontWeight: 800, fontSize: 43 }}>138%</div>
                <div style={{ fontSize: 13, marginTop: 5 }}>GMV target achieved</div>
                <div style={{ fontSize: 10, lineHeight: 1.5, opacity: 0.8, marginTop: 10 }}>70 位 TikTok 创作者共同完成 30 天上市增长。</div>
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
                <Label item={item} />
                <Title text={title} style={{ marginTop: 5 }} />
                <div style={{ fontSize: 10, color: '#777', lineHeight: 1.4, marginTop: 6 }}>{meta}</div>
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
                background: `linear-gradient(145deg,rgba(124,45,18,.15),rgba(255,92,0,.52)),url(${CASE_BG}) center/cover`,
                borderRadius: 8,
                padding: 13,
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'relative', color: '#FFF', fontSize: 10, fontWeight: 700, letterSpacing: '.7px' }}>CASE STUDY · BEAUTY</div>
              <Title text={title} size={20} color="#FFF" style={{ position: 'relative', marginTop: 8, maxWidth: '78%', textShadow: '0 1px 12px rgba(0,0,0,.24)' }} />
              <div style={{ position: 'absolute', left: 12, bottom: 13, color: '#FFF', fontSize: 10 }}>品牌 × 内容 × 增长</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Label item={item} />
              <div style={{ fontSize: 10, color: '#777', lineHeight: 1.45, marginTop: 4 }}>{meta}</div>
              <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <Chips list={details} />
              </div>
            </div>
          </div>
        </Base>
      );
    }

    /* -------------------------- retrospective ----------------------- */
    case 'retrospective': {
      const eyebrows = ['保留', '优化', '推荐', '目标'];
      return (
        <Base variant={variant}>
          <div style={{ padding: 18, height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 16 }}>
            <div>
              <Label item={item} />
              <Title text={title} style={{ marginTop: 5 }} />
              <div style={{ fontSize: 10, color: '#777', lineHeight: 1.5, marginTop: 8 }}>{meta}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, alignContent: 'center' }}>
              {details.map((x, i) => (
                <div
                  key={i}
                  style={{
                    padding: 10,
                    background: i === 0 ? INK : '#FAFAFA',
                    color: i === 0 ? '#FFF' : '#333',
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

    default:
      return <DefaultRender {...ctx} />;
  }
}

/* ------------------------------- 入口 -------------------------------- */

export function BusinessBlockRenderer({ data }: { data: BusinessBlockData }) {
  const item = getBusinessItem(data.businessKind);
  const variant = (data.variant || 'standard') as VariantId;
  const ctx: RenderCtx = {
    item,
    data,
    title: data.title || item.title,
    meta: data.meta || item.meta,
    details: data.details && data.details.length ? data.details : item.details,
    variant,
  };
  const kind = data.businessKind;

  // 通用变体：非专用组合时，cards/light/accent 走通用兜底。
  if (!isDedicated(kind, variant)) {
    if (variant === 'cards') return <GenericCards {...ctx} />;
    if (variant === 'light') return <GenericLight {...ctx} />;
    if (variant === 'accent') return <GenericAccent {...ctx} />;
  }

  return <>{renderKind(ctx)}</>;
}
