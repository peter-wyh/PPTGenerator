import type { FC } from 'react'
import type { TextData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const TextBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as TextData
  return (
    <div
      className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
      style={{
        fontSize: d.fontSize,
        fontWeight: d.fontWeight ?? 400,
        color: d.color ?? '#222',
        background: d.bgColor ?? 'transparent',
        padding: 4,
      }}
    >
      {d.content || '双击编辑文本'}
    </div>
  )
}

export const textBlock: BlockDef = {
  label: '文本',
  defaultSize: { w: 240, h: 60 },
  defaultData: () => ({ content: '双击编辑文本', fontSize: 18, color: '#222', bgColor: '#fff' }),
  Block: TextBlock,
  propertySchema: [
    { key: 'content', label: '文本', kind: 'textarea' },
    { key: 'fontSize', label: '字号', kind: 'number' },
    { key: 'color', label: '颜色', kind: 'color' },
  ],
}
