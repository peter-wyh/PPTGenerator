import type { FC } from 'react'

export interface PropertyField {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'list' | 'table'
  options?: string[]
  itemFields?: { key: string; label: string; kind: 'text' | 'number' | 'color' }[]
}

export interface BlockDef {
  label: string
  defaultSize: { w: number; h: number }
  defaultData: () => unknown
  Block: FC<{ data: unknown }>
  propertySchema: PropertyField[]
}
