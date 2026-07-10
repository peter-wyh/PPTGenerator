/**
 * ProductPerformance — 商品表现（≈PRD CMP-B12）。
 * 列顺序 [商品, 图URL, 销量, 占比, 品类]。
 */
import type { ProductPerformanceData } from '@mediakit/shared';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ImgOrPlaceholder } from './shared';

export function ProductPerformance({ data }: { data: ProductPerformanceData }) {
  const { variant = 'cards', insight, rows = [] } = data;
  const items = rows.map((r) => ({ name: r[0] ?? '', img: r[1] ?? '', sold: r[2] ?? '', share: r[3] ?? '', cat: r[4] ?? '' }));

  if (variant === 'bar') {
    // 条形图：横向 BarChart(layout=vertical) 展示 TOP 商品销量。
    // sold 字段可能是 "1.2K"/"85%" 文本，解析首段数字作 value；无数字则按行号递减占位。
    const chartData = items.map((it, i) => {
      const m = it.sold.match(/-?\d+(\.\d+)?/);
      return { name: it.name || `#${i + 1}`, value: m ? parseFloat(m[0]) : items.length - i, sold: it.sold };
    });
    return (
      <div className="flex h-full w-full gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
        <div className="min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip cursor={{ fill: '#F9FAFB' }} formatter={(v: number) => v} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--color-primary, #FF5C00)">
                <LabelList dataKey="sold" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {insight && (
          <div className="flex w-[220px] flex-none flex-col justify-center rounded-lg bg-primary/5 p-3">
            <div className="mb-1 text-[11px] font-semibold text-primary">Insight</div>
            <div className="text-xs text-foreground-secondary">{insight}</div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'pie') {
    // 品类饼图：按品类聚合商品，左侧 PieChart 展示品类分布，右侧 TOP 商品列表。
    const PIE_COLORS = ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6B7280'];
    const catMap = new Map<string, number>();
    items.forEach((it) => {
      const cat = it.cat || '未分类';
      const m = it.sold.match(/-?\d+(\.\d+)?/);
      const v = m ? parseFloat(m[0]) : 1;
      catMap.set(cat, (catMap.get(cat) ?? 0) + v);
    });
    const pieData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));
    return (
      <div className="flex h-full w-full gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
        <div className="flex min-w-0 flex-1 items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="75%"
                innerRadius="40%"
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconSize={8}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex w-[260px] flex-none flex-col gap-1 overflow-auto">
          <div className="mb-1 text-[11px] font-semibold text-foreground-secondary">TOP 商品</div>
          {items.slice(0, 8).map((it, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-border-subtle py-1 last:border-b-0">
              <span className="w-4 flex-none text-center text-[10px] text-foreground-muted">{i + 1}</span>
              <ImgOrPlaceholder url={it.img} label={it.name} cls="h-7 w-7 flex-none" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-foreground-primary">{it.name}</div>
                <div className="text-[10px] text-foreground-muted">{it.cat}</div>
              </div>
              <div className="flex-none text-right">
                <div className="font-data text-xs font-semibold text-foreground-primary">{it.sold}</div>
                <div className="text-[10px] text-foreground-secondary">{it.share}</div>
              </div>
            </div>
          ))}
        </div>
        {insight && (
          <div className="flex w-[200px] flex-none flex-col justify-center rounded-lg bg-primary/5 p-3">
            <div className="mb-1 text-[11px] font-semibold text-primary">Insight</div>
            <div className="text-xs text-foreground-secondary">{insight}</div>
          </div>
        )}
      </div>
    );
  }

  const Row = ({ it, rank }: { it: (typeof items)[number]; rank: number }) => (
    <div className="flex items-center gap-2 border-b border-border-subtle py-1.5 last:border-b-0">
      <span className="w-5 flex-none text-center text-xs text-foreground-muted">{rank}</span>
      <ImgOrPlaceholder url={it.img} label={it.name} cls="h-10 w-10 flex-none" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground-primary">{it.name}</div>
        <div className="text-[10px] text-foreground-muted">{it.cat}</div>
      </div>
      <div className="flex-none text-right">
        <div className="font-data text-sm font-semibold text-foreground-primary">{it.sold}</div>
        <div className="text-[10px] text-foreground-secondary">占比 {it.share}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
      <div className={insight ? 'min-w-0 flex-1' : 'min-w-0 flex-1'}>
        {variant === 'rank' ? (
          <div className="flex flex-col">{items.map((it, i) => <Row key={i} it={it} rank={i + 1} />)}</div>
        ) : (
          <div className={`grid ${variant === 'grid' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            {items.map((it, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-2">
                <ImgOrPlaceholder url={it.img} label={it.name} cls="h-12 w-full" />
                <div className="truncate text-xs font-medium text-foreground-primary">{it.name}</div>
                <div className="flex justify-between text-[10px] text-foreground-secondary">
                  <span>{it.sold}</span>
                  <span>{it.share}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {insight && (
        <div className="flex w-[260px] flex-none flex-col justify-center rounded-lg bg-primary/5 p-3">
          <div className="mb-1 text-[11px] font-semibold text-primary">Insight</div>
          <div className="text-xs text-foreground-secondary">{insight}</div>
        </div>
      )}
    </div>
  );
}
