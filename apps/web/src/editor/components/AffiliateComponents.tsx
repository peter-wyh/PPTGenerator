/**
 * 联盟营销域（Affiliate）渲染组件。
 *
 * 四个可复用锚点：
 *  - GeoMap        地理分布地图（世界底图 + 国家色阶 + Top 列表 + AI 洞察）
 *  - GaugeCard     环形进度仪表（整圆/半圆 + 同比 + 中心标签）
 *  - StatusLegend  状态图例（Performing Well / Needs Improvement / Underperforming）
 *  - WideTable     宽表横向滚动（冻结首列 + 行级状态色 + 斑马纹/紧凑变体）
 *
 * 色阶/状态色等约定与 packages/shared 中对应类型注释一致。
 * data.variant 通道由 REGISTRY VariantSelector 写入（虽然类型未声明 variant 字段，
 * 组件读取时按 { variant?: string } 容错转型，与 BasicComponents 写法一致）。
 */
import type {
  GaugeCardData,
  GeoMapColorScheme,
  GeoMapCountry,
  GeoMapData,
  LegendStatus,
  StatusLegendData,
  WideTableData,
} from '@mediakit/shared';

/* ============================== helpers =============================== */

/** 国家代码（ISO alpha-2）→ 旗帜 emoji。 */
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🏳️';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)),
  );
}

/** 国家代码 → 世界 SVG（400×200 equirectangular）近似坐标。未命中返回 null。 */
const COUNTRY_POS: Record<string, { x: number; y: number }> = {
  US: { x: 80, y: 75 },
  CA: { x: 80, y: 55 },
  GB: { x: 200, y: 55 },
  DE: { x: 215, y: 60 },
  FR: { x: 205, y: 65 },
  JP: { x: 340, y: 75 },
  AU: { x: 345, y: 140 },
  BR: { x: 130, y: 130 },
  CN: { x: 310, y: 75 },
  IN: { x: 285, y: 90 },
  KR: { x: 335, y: 80 },
  IT: { x: 220, y: 68 },
  ES: { x: 195, y: 75 },
  MX: { x: 75, y: 95 },
  RU: { x: 280, y: 50 },
  NL: { x: 210, y: 55 },
  SG: { x: 315, y: 110 },
  ID: { x: 330, y: 120 },
  TH: { x: 305, y: 100 },
  VN: { x: 312, y: 95 },
  MY: { x: 320, y: 108 },
  PH: { x: 335, y: 100 },
  AE: { x: 260, y: 90 },
  SA: { x: 250, y: 88 },
  TR: { x: 235, y: 70 },
  PL: { x: 222, y: 55 },
  SE: { x: 220, y: 45 },
  NO: { x: 215, y: 40 },
  FI: { x: 232, y: 45 },
  NZ: { x: 380, y: 150 },
  AR: { x: 130, y: 150 },
  CL: { x: 120, y: 145 },
  ZA: { x: 240, y: 145 },
  NG: { x: 215, y: 115 },
  EG: { x: 235, y: 90 },
};

/** 色阶方案 → 6 步数组（浅→深）。 */
const COLOR_SCALES: Record<GeoMapColorScheme, string[]> = {
  orange: ['#FFEDD5', '#FED7AA', '#FDBA74', '#FB923C', '#F97316', '#EA580C'],
  blue: ['#EFF6FF', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB'],
  green: ['#ECFDF5', '#A7F3D0', '#6EE7B7', '#34D399', '#10B981', '#059669'],
  purple: ['#F5F3FF', '#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED'],
  red: ['#FEF2F2', '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626'],
};

/** 状态 → 行级配色（背景 / 左边框 / 文字）。 */
const STATUS_COLORS: Record<LegendStatus, { bg: string; border: string; text: string }> = {
  good: { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700' },
  warn: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700' },
  bad: { bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700' },
};

/** 状态 → 圆点背景色（StatusLegend 用）。 */
const STATUS_DOT: Record<LegendStatus, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
};

/** 状态 → 边框色（WideTable 行左边框 accent 用）。 */
const STATUS_BORDER_COLOR: Record<LegendStatus, string> = {
  good: '#22C55E',
  warn: '#F59E0B',
  bad: '#EF4444',
};

/** 状态 → 徽章背景（WideTable Status 列用）。 */
const STATUS_BADGE: Record<LegendStatus, { bg: string; text: string; label: string }> = {
  good: { bg: 'bg-green-50', text: 'text-green-700', label: 'Good' },
  warn: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Warn' },
  bad: { bg: 'bg-red-50', text: 'text-red-700', label: 'Bad' },
};

/** 从 LegendStatus 字符串（如 'good'/'warn'/'bad'）解析状态；非法返回 null。 */
function parseStatus(v: unknown): LegendStatus | null {
  return v === 'good' || v === 'warn' || v === 'bad' ? v : null;
}

/* -------------------------------- GeoMap ------------------------------- */

/**
 * 地理分布地图。
 * - world 变体：左 SVG 世界底图 + 右 Top 国家列表；色阶按 value 排名映射。
 * - list 变体：仅 Top 国家列表（无地图）。
 */
export function GeoMap({ data }: { data: GeoMapData }) {
  const variant = (data as { variant?: string }).variant ?? 'world';
  const scheme: GeoMapColorScheme = data.colorScheme ?? 'orange';
  const scale = COLOR_SCALES[scheme] ?? COLOR_SCALES.orange;
  const countries = [...(data.countries ?? [])].sort((a, b) => b.value - a.value);
  const maxVal = countries.length ? countries[0].value : 0;

  // 色阶步：按排名取色阶索引（最大值→最深色）。无数据时全部最浅。
  const colorFor = (idx: number): string => {
    if (countries.length === 0 || maxVal <= 0) return scale[0];
    const ratio = countries[idx].value / maxVal;
    // 6 步：0-1 线性映射到 0..5
    const step = Math.min(scale.length - 1, Math.floor(ratio * scale.length));
    return scale[step];
  };

  // 渲染单个国家在地图上的圆点
  const renderDot = (c: GeoMapCountry, idx: number) => {
    const pos = COUNTRY_POS[c.code.toUpperCase()];
    if (!pos) return null;
    const ratio = maxVal > 0 ? c.value / maxVal : 0;
    const r = 3 + Math.sqrt(ratio) * 9; // 3..12
    return (
      <circle
        key={c.code}
        cx={pos.x}
        cy={pos.y}
        r={r}
        fill={colorFor(idx)}
        fillOpacity={0.85}
        stroke="#fff"
        strokeWidth={0.6}
      >
        <title>{`${flagEmoji(c.code)} ${c.name}: ${c.display ?? c.value}`}</title>
      </circle>
    );
  };

  const RankedRow = ({ c, idx }: { c: GeoMapCountry; idx: number }) => (
    <div
      className="flex items-center gap-2 rounded-md px-2 py-1"
      style={{ backgroundColor: idx === 0 ? `${scale[5]}0D` : undefined }}
    >
      <span className="w-4 flex-none text-right text-[11px] font-semibold text-foreground-muted">
        {idx + 1}
      </span>
      <span className="flex-none text-base leading-none">{flagEmoji(c.code)}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-foreground-primary">
        {c.name}
      </span>
      <span className="font-data text-xs font-semibold text-foreground-primary">
        {c.display ?? c.value}
      </span>
      {c.share && (
        <span className="text-[11px] text-foreground-muted">{c.share}</span>
      )}
    </div>
  );

  const Ranked = () => (
    <div className="flex flex-col gap-0.5">
      {countries.slice(0, 10).map((c, i) => (
        <RankedRow key={c.code} c={c} idx={i} />
      ))}
    </div>
  );

  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-border-default bg-surface-primary p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-foreground-primary">
            {data.title}
          </div>
          {data.subtitle && (
            <div className="mt-0.5 truncate text-xs text-foreground-muted">
              {data.subtitle}
            </div>
          )}
        </div>
        {data.metricLabel && (
          <div className="flex-none rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] text-foreground-muted">
            {data.metricLabel}
          </div>
        )}
      </div>

      {variant === 'list' ? (
        <div className="mt-3 flex-1 overflow-auto">
          <Ranked />
        </div>
      ) : (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-3">
          {/* 世界地图 SVG */}
          <div className="relative min-h-0 overflow-hidden rounded-lg bg-surface-secondary">
            <svg
              viewBox="0 0 400 200"
              className="h-full w-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* 简化世界轮廓（灰色底块，按大洲粗略形状） */}
              <g fill="#E5E7EB" stroke="#D1D5DB" strokeWidth={0.5}>
                {/* 北美 */}
                <path d="M30,40 Q55,28 90,32 L120,40 L125,70 L110,95 L80,100 L55,90 L35,70 Z" />
                {/* 南美 */}
                <path d="M110,105 L135,100 L145,125 L140,160 L120,170 L112,150 Z" />
                {/* 欧洲 */}
                <path d="M185,42 L225,40 L232,58 L220,72 L195,70 L182,55 Z" />
                {/* 非洲 */}
                <path d="M200,80 L235,78 L245,110 L240,145 L220,160 L205,140 L198,110 Z" />
                {/* 亚洲 */}
                <path d="M240,35 L350,38 L360,70 L340,95 L300,100 L270,90 L245,70 Z" />
                {/* 大洋洲 */}
                <path d="M315,125 L360,122 L370,145 L345,160 L320,150 Z" />
              </g>
              {/* 经纬度辅助网格（淡） */}
              <g stroke="#F3F4F6" strokeWidth={0.4}>
                <line x1="0" y1="50" x2="400" y2="50" />
                <line x1="0" y1="100" x2="400" y2="100" />
                <line x1="0" y1="150" x2="400" y2="150" />
                <line x1="100" y1="0" x2="100" y2="200" />
                <line x1="200" y1="0" x2="200" y2="200" />
                <line x1="300" y1="0" x2="300" y2="200" />
              </g>
              {/* 国家数据点 */}
              {countries.map((c, i) => renderDot(c, i))}
            </svg>
          </div>
          {/* 右侧排名列表 */}
          <div className="min-h-0 overflow-auto">
            <Ranked />
          </div>
        </div>
      )}

      {data.insight && (
        <div className="mt-3 rounded-lg bg-surface-secondary px-3 py-2">
          <p className="text-[11px] italic leading-relaxed text-foreground-muted">
            💡 {data.insight}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ GaugeCard ----------------------------- */

/**
 * 环形进度仪表。
 * - full：整圆环（SVG 120×120，r=45，strokeWidth=10，rotate -90deg 从顶部起）。
 * - semi：半圆环（SVG 120×70，180° 弧）。
 * 中心放 value（大）+ centerLabel（小）；下方 compare（按 +/- 染色）+ subtitle。
 */
export function GaugeCard({ data }: { data: GaugeCardData }) {
  const shape = data.shape ?? 'full';
  const color = data.color ?? '#FF5C00';
  const progress = Math.max(0, Math.min(100, data.progress ?? 0));

  const compareColor = data.compare
    ? data.compare.trim().startsWith('-')
      ? '#EF4444'
      : '#22C55E'
    : undefined;

  const Center = () => (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      <div className="font-data text-xl font-bold text-foreground-primary">{data.value}</div>
      {data.centerLabel && (
        <div className="mt-0.5 text-[10px] text-foreground-muted">{data.centerLabel}</div>
      )}
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-border-default bg-surface-primary p-4">
      {data.title && (
        <div className="mb-2 text-sm font-medium text-foreground-secondary">{data.title}</div>
      )}

      {shape === 'semi' ? (
        <div className="relative" style={{ width: 140, height: 80 }}>
          <svg viewBox="0 0 120 70" className="h-full w-full">
            {/* 背景半圆弧（180°，从左到右） */}
            <path
              d="M 15,60 A 45,45 0 0 1 105,60"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={10}
              strokeLinecap="round"
            />
            {/* 前景半圆弧（按 progress 比例） */}
            <path
              d="M 15,60 A 45,45 0 0 1 105,60"
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${progress} 100`}
            />
          </svg>
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-1 text-center"
            style={{ paddingBottom: 0 }}
          >
            <div className="font-data text-xl font-bold text-foreground-primary">{data.value}</div>
            {data.centerLabel && (
              <div className="mt-0.5 text-[10px] text-foreground-muted">{data.centerLabel}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative" style={{ width: 120, height: 120 }}>
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="45" fill="none" stroke="#E5E7EB" strokeWidth={10} />
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - progress / 100)}
            />
          </svg>
          <Center />
        </div>
      )}

      {data.compare && (
        <div className="mt-2 text-xs font-medium" style={{ color: compareColor }}>
          {data.compare}
        </div>
      )}
      {data.subtitle && (
        <div className="mt-1 text-[11px] text-foreground-muted">{data.subtitle}</div>
      )}
    </div>
  );
}

/* ---------------------------- StatusLegend ---------------------------- */

/**
 * 状态图例：横向排列的「色点 + 标签」；可选标题在左侧。
 */
export function StatusLegend({ data }: { data: StatusLegendData }) {
  const items = data.items ?? [];
  return (
    <div className="h-full w-full flex items-center gap-4 rounded-xl border border-border-default bg-surface-primary px-4 py-2">
      {data.title && (
        <div className="flex-none text-xs font-medium text-foreground-secondary">
          {data.title}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 flex-none rounded-full ${STATUS_DOT[it.status] ?? 'bg-gray-400'}`}
            />
            <span className="text-xs text-foreground-secondary">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ WideTable ----------------------------- */

/**
 * 宽表横向滚动。
 * - 变体（data.variant）：standard / zebra / compact。
 * - freezeFirstCol（默认 true）：首列 sticky。
 * - rowStatus：每行左边框 accent（4px）+ 末列 Status 彩色徽章。
 */
export function WideTable({ data }: { data: WideTableData }) {
  const variant = (data as { variant?: string }).variant ?? 'standard';
  const freezeFirstCol = data.freezeFirstCol !== false; // 缺省 true
  const compact = variant === 'compact';
  const zebra = variant === 'zebra';
  const headers = data.headers ?? [];
  const rows = data.rows ?? [];
  const rowStatus = data.rowStatus ?? [];

  const cellPad = compact ? 'px-2 py-1' : 'px-3 py-2';
  const fontSize = compact ? 'text-[11px]' : 'text-xs';

  // 末列是 Status 列？rowStatus 长度对齐 rows 时启用
  const hasStatusCol = rowStatus.length > 0;
  const statusColIdx = headers.length - 1;

  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-border-default bg-surface-primary">
      {(data.title || data.subtitle) && (
        <div className="border-b border-border-default px-4 py-2">
          {data.title && (
            <div className="text-sm font-semibold text-foreground-primary">{data.title}</div>
          )}
          {data.subtitle && (
            <div className="mt-0.5 text-[11px] text-foreground-muted">{data.subtitle}</div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-secondary">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`whitespace-nowrap ${fontSize} font-medium uppercase tracking-wide text-foreground-muted ${cellPad} ${
                    freezeFirstCol && i === 0
                      ? 'sticky left-0 z-10 bg-surface-secondary'
                      : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const status = parseStatus(rowStatus[ri]);
              const zebraBg = zebra && ri % 2 === 1 ? 'bg-surface-secondary' : '';
              const statusBg = status ? STATUS_COLORS[status].bg : '';
              const rowBg = statusBg || zebraBg;
              return (
                <tr key={ri} className={`${rowBg} border-b border-border-default/60 last:border-b-0`}>
                  {row.map((cell, ci) => {
                    const isFrozen = freezeFirstCol && ci === 0;
                    // 行级状态左边框：仅在首列单元格加 4px 左边框 accent
                    const borderAccent =
                      isFrozen && status
                        ? {
                            borderLeft: `4px solid ${STATUS_BORDER_COLOR[status]}`,
                          }
                        : undefined;
                    // Status 列：渲染彩色徽章
                    const cellStatus = hasStatusCol && ci === statusColIdx ? parseStatus(cell) : null;
                    return (
                      <td
                        key={ci}
                        className={`whitespace-nowrap ${fontSize} ${isFrozen ? 'font-medium text-foreground-primary' : 'text-foreground-secondary'} ${cellPad} ${
                          isFrozen ? 'sticky left-0 z-10' : ''
                        } ${isFrozen && rowBg ? rowBg : ''}`}
                        style={borderAccent}
                      >
                        {cellStatus ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[cellStatus].bg} ${STATUS_BADGE[cellStatus].text}`}
                          >
                            {cell}
                          </span>
                        ) : (
                          cell
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(1, headers.length)}
                  className={`px-3 py-6 text-center ${fontSize} text-foreground-muted`}
                >
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
