import { describe, it, expect } from 'vitest'
import { REGISTRY, fallbackBlock } from '../../src/editor/blocks'
import type { BasicComponentType } from '@ppt-generator/shared'

const TYPES: BasicComponentType[] = [
  'text', 'image', 'indicator-card', 'bar-chart', 'line-chart', 'pie-chart', 'table',
]

describe('component registry', () => {
  it.each(TYPES)('has a complete def for %s', (t) => {
    const def = REGISTRY[t]
    expect(def).toBeTruthy()
    expect(typeof def.label).toBe('string')
    expect(typeof def.defaultData).toBe('function')
    expect(typeof def.Block).toBe('function')
    expect(Array.isArray(def.propertySchema)).toBe(true)
    expect(def.defaultSize).toBeTruthy()
    expect(def.defaultSize.w).toBeGreaterThan(0)
    expect(def.defaultSize.h).toBeGreaterThan(0)
  })

  it('exposes a fallback def for unknown types', () => {
    expect(fallbackBlock.label).toBe('未知组件')
    expect(typeof fallbackBlock.Block).toBe('function')
  })

  it('text defaultData yields editable content', () => {
    const d = REGISTRY.text.defaultData() as { content: string }
    expect(typeof d.content).toBe('string')
  })
})
