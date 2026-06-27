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

describe('table block', () => {
  it('renders one <th> per header', () => {
    const { container } = renderBlock('table')
    expect(container.querySelectorAll('th')).toHaveLength(3)
  })

  it('renders a <td> per cell across all rows', () => {
    const { container } = renderBlock('table')
    // 默认 2 行 × 3 列
    expect(container.querySelectorAll('td')).toHaveLength(6)
  })
})

describe('bar-chart block', () => {
  it('renders a recharts chart with default data', () => {
    const { container, getByText } = renderBlock('bar-chart')
    expect(getByText('柱状图')).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).toBeTruthy()
  })
  it('shows 无数据 when bars is empty', () => {
    const { getByText } = renderBlock('bar-chart', { title: '柱状图', bars: [] })
    expect(getByText('无数据')).toBeInTheDocument()
  })
})

describe('line-chart block', () => {
  it('renders a recharts chart with default data', () => {
    const { container } = renderBlock('line-chart')
    expect(container.querySelector('.recharts-wrapper')).toBeTruthy()
  })
})

describe('pie-chart block', () => {
  it('renders a recharts chart with default data', () => {
    const { container } = renderBlock('pie-chart')
    expect(container.querySelector('.recharts-wrapper')).toBeTruthy()
  })
})
