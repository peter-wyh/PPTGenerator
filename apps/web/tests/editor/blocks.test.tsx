import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { REGISTRY } from '../../src/editor/blocks'

// recharts 在 jsdom 无布局，图表 task 再加图表用例；此处提前 mock 以免引入图表时漏配。
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 320, height: 200 }),
  }
})

function renderBlock(type: keyof typeof REGISTRY, data?: unknown) {
  const def = REGISTRY[type]
  return render(React.createElement(def.Block, { data: data ?? def.defaultData() }))
}

describe('indicator-card block', () => {
  it('renders title and value from default data', () => {
    const { getByText } = renderBlock('indicator-card')
    expect(getByText('指标名称')).toBeInTheDocument()
    expect(getByText('---')).toBeInTheDocument()
  })
})
