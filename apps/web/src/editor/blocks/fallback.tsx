import type { FC } from 'react'
import type { BlockDef } from './types'

const FallbackBlock: FC = () => (
  <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100 text-xs text-neutral-400">
    未知组件
  </div>
)

export const fallbackBlock: BlockDef = {
  label: '未知组件',
  defaultSize: { w: 200, h: 120 },
  defaultData: () => ({}),
  Block: FallbackBlock,
  propertySchema: [],
}
