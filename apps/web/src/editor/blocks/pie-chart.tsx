import type { FC } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import type { PieChartData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const PieChartBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as PieChartData
  const slices = d.slices ?? []
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-[13px] font-semibold text-neutral-800">{d.title || '饼图'}</div>
      {slices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-neutral-400">无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="70%" label>
              {slices.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export const pieChartBlock: BlockDef = {
  label: '饼图',
  defaultSize: { w: 320, h: 240 },
  defaultData: () => ({
    title: '饼图',
    slices: [
      { label: 'A', value: 40, color: '#FF5C00' },
      { label: 'B', value: 35, color: '#3B82F6' },
      { label: 'C', value: 25, color: '#22C55E' },
    ],
  }),
  Block: PieChartBlock,
  propertySchema: [
    { key: 'title', label: '标题', kind: 'text' },
    {
      key: 'slices',
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
