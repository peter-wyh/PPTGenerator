import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import { api } from '../../src/api/client'
import { initAuthBridge } from '../../src/stores/auth'
import Editor from '../../src/editor/Editor'

describe('Editor', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
    initAuthBridge()
  })

  it('loads the project and renders its pages/components', async () => {
    mock.onGet('/projects/p1').reply(200, {
      project: {
        id: 'p1', userId: 'u', name: '测试', canvasWidth: 1280, canvasHeight: 720,
        pages: [{ id: 'pg', name: '封面', components: [] }],
        createdAt: '2026-06-26T00:00:00.000Z', updatedAt: '2026-06-26T00:00:00.000Z',
      },
    })
    render(
      <MemoryRouter>
        <Editor projectId="p1" />
      </MemoryRouter>,
    )
    await waitFor(() => expect(mock.history.get.length).toBe(1))
  })

  it('shows error on load failure', async () => {
    mock.onGet('/projects/p1').reply(404)
    const { container } = render(
      <MemoryRouter>
        <Editor projectId="p1" />
      </MemoryRouter>,
    )
    await waitFor(() => expect(container.textContent).toContain('项目不存在或无权访问'))
  })
})
