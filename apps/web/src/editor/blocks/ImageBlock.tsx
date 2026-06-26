import { useState } from 'react'
import type { ImageData } from '@ppt-generator/shared'

export function ImageBlock({ data }: { data: ImageData }) {
  const [broken, setBroken] = useState(false)
  if (!data.src || broken) {
    return <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-xs text-neutral-500">图片</div>
  }
  return (
    <img
      src={data.src}
      alt=""
      className="h-full w-full object-contain"
      onError={() => setBroken(true)}
    />
  )
}
