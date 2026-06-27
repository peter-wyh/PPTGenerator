import type { FC } from 'react'
import type { IndicatorCardData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const THEME: Record<IndicatorCardData['colorTheme'], string> = {
  blue: '#3B82F6',
  green: '#22C55E',
  orange: '#FF5C00',
  purple: '#8B5CF6',
}

const IndicatorCard: FC<{ data: unknown }> = ({ data }) => {
  const d = data as IndicatorCardData
  const accent = THEME[d.colorTheme ?? 'blue'] ?? THEME.blue
  return (
    <div
      className="flex h-full w-full flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white p-3"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="text-[10px] font-medium text-neutral-400">{d.title || '指标'}</div>
      <div className="font-mono text-lg font-semibold text-neutral-800">{d.value || '---'}</div>
      {d.trend ? (
        <div className="text-[10px] font-semibold" style={{ color: d.trendUp ? '#16a34a' : '#dc2626' }}>
          <span>{d.trendUp ? '↑' : '↓'}</span> {d.trend}
        </div>
      ) : null}
    </div>
  )
}

export const indicatorCardBlock: BlockDef = {
  label: '指标卡',
  defaultSize: { w: 200, h: 110 },
  defaultData: () => ({ title: '指标名称', value: '---', trend: '', trendUp: false, colorTheme: 'blue' }),
  Block: IndicatorCard,
  propertySchema: [
    { key: 'title', label: '标题', kind: 'text' },
    { key: 'value', label: '数值', kind: 'text' },
    { key: 'trend', label: '趋势', kind: 'text' },
    { key: 'trendUp', label: '趋势方向', kind: 'select', options: ['↑', '↓'] },
    { key: 'colorTheme', label: '配色', kind: 'select', options: ['blue', 'green', 'orange', 'purple'] },
  ],
}
