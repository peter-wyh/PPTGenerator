import type { BasicComponentType } from '@ppt-generator/shared'
import type { BlockDef } from './types'
import { textBlock } from './text'
import { imageBlock } from './image'
import { indicatorCardBlock } from './indicator-card'
import { barChartBlock } from './bar-chart'
import { lineChartBlock } from './line-chart'
import { pieChartBlock } from './pie-chart'
import { tableBlock } from './table'
import { fallbackBlock } from './fallback'

export { fallbackBlock }

export const REGISTRY: Record<BasicComponentType, BlockDef> = {
  text: textBlock,
  image: imageBlock,
  'indicator-card': indicatorCardBlock,
  'bar-chart': barChartBlock,
  'line-chart': lineChartBlock,
  'pie-chart': pieChartBlock,
  table: tableBlock,
}

export function getBlock(type: string): BlockDef {
  return (REGISTRY as Record<string, BlockDef>)[type] ?? fallbackBlock
}
