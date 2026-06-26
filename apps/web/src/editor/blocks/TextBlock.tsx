import type { TextData } from '@ppt-generator/shared'

export function TextBlock({ data }: { data: TextData }) {
  return (
    <div
      className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
      style={{
        fontSize: data.fontSize,
        fontWeight: data.fontWeight ?? 400,
        color: data.color ?? '#222',
        background: data.bgColor ?? 'transparent',
        padding: 4,
      }}
    >
      {data.content || '双击编辑文本'}
    </div>
  )
}
