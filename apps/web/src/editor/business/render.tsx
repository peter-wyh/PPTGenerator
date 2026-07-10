import type { BusinessBlockData } from '@mediakit/shared';
import { getBusinessItem, type VariantId } from './catalog';
import {
  ACCENT,
  Base,
  Chips,
  INK,
  Label,
  mono,
  Title,
  type RenderCtx,
} from './shared';
import { renderCover, renderAgenda, renderMilestone } from './kinds/cover-agenda';
import { renderBrandWall, renderOrgService } from './kinds/brand-org';
import { renderProcess, renderCalendar } from './kinds/process';
import { renderCampaignOverview, renderCreatorProfile, renderCreatorList } from './kinds/campaign';
import { renderFunnel, renderReport, renderGlobal } from './kinds/analytics';
import { renderPackage, renderChallenge } from './kinds/package';
import { renderCaseShowcase, renderRetrospective } from './kinds/showcase';

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
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 38, lineHeight: 0.9 }}>
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

/* ----------------------------- 各 kind 分发 ---------------------------- */

function renderKind(ctx: RenderCtx): React.ReactNode {
  const kind = ctx.data.businessKind;

  switch (kind) {
    case 'cover':
      return renderCover(ctx);
    case 'agenda':
      return renderAgenda(ctx);
    case 'milestone':
      return renderMilestone(ctx);
    case 'brand-wall':
      return renderBrandWall(ctx);
    case 'org':
    case 'service':
      return renderOrgService(ctx);
    case 'process':
    case 'campaign-plan':
      return renderProcess(ctx);
    case 'calendar':
      return renderCalendar(ctx);
    case 'campaign-overview':
      return renderCampaignOverview(ctx);
    case 'creator-profile':
      return renderCreatorProfile(ctx);
    case 'creator-list':
      return renderCreatorList(ctx);
    case 'content-analysis':
    case 'funnel':
      return renderFunnel(ctx);
    case 'package':
      return renderPackage(ctx);
    case 'report':
      return renderReport(ctx);
    case 'global':
      return renderGlobal(ctx);
    case 'challenge':
      return renderChallenge(ctx);
    case 'case-showcase':
      return renderCaseShowcase(ctx);
    case 'retrospective':
      return renderRetrospective(ctx);
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
