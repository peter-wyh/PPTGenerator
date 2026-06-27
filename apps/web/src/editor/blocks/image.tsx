import { useState, type FC } from 'react'
import type { ImageData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const ImageBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as ImageData
  const [broken, setBroken] = useState(false)
  if (!d.src || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-xs text-neutral-500">
        图片
      </div>
    )
  }
  return <img src={d.src} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
}

export const imageBlock: BlockDef = {
  label: '图片',
  defaultSize: { w: 240, h: 160 },
  defaultData: () => ({ src: '' }),
  Block: ImageBlock,
  propertySchema: [{ key: 'src', label: '图片 URL', kind: 'text' }],
}
