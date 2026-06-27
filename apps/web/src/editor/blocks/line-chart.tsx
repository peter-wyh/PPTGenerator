import type { FC } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { LineChartData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const LineChartBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as LineChartData
  const points = d.points ?? []
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-[13px] font-semibold text-neutral-800">{d.title || '折线图'}</div>
      {points.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-neutral-400">无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="value" stroke="#FF5C00" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export const lineChartBlock: BlockDef = {
  label: '折线图',
  defaultSize: { w: 360, h: 240 },
  defaultData: () => ({
    title: '折线图',
    points: [
      { label: 'Q1', value: 30 },
      { label: 'Q2', value: 55 },
      { label: 'Q3', value: 42 },
      { label: 'Q4', value: 70 },
    ],
  }),
  Block: LineChartBlock,
  propertySchema: [
    { key: 'title', label: '标题', kind: 'text' },
    {
      key: 'points',
      label: '数据',
      kind: 'list',
      itemFields: [
        { key: 'label', label: '标签', kind: 'text' },
        { key: 'value', label: '数值', kind: 'number' },
      ],
    },
  ],
}
