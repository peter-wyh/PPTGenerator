import type { FC } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import type { BarChartData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const BarChartBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as BarChartData
  const bars = d.bars ?? []
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-[13px] font-semibold text-neutral-800">{d.title || '柱状图'}</div>
      {bars.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-neutral-400">无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {bars.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export const barChartBlock: BlockDef = {
  label: '柱状图',
  defaultSize: { w: 360, h: 240 },
  defaultData: () => ({
    title: '柱状图',
    bars: [
      { label: 'A', value: 80, color: '#FF5C00' },
      { label: 'B', value: 60, color: '#3B82F6' },
      { label: 'C', value: 40, color: '#22C55E' },
    ],
  }),
  Block: BarChartBlock,
  propertySchema: [
    { key: 'title', label: '标题', kind: 'text' },
    {
      key: 'bars',
      label: '数据',
      kind: 'list',
      itemFields: [
        { key: 'label', label: '标签', kind: 'text' },
        { key: 'value', label: '数值', kind: 'number' },
        { key: 'color', label: '颜色', kind: 'color' },
      ],
    },
  ],
}
