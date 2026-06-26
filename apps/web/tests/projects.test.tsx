import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../src/api/client'
import { initAuthBridge } from '../src/stores/auth'
import Projects from '../src/routes/Projects'

function renderProjects() {
  return render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>,
  )
}

describe('Projects page', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
    initAuthBridge()
  })

  it('renders project cards from the API', async () => {
    mock.onGet('/projects').reply(200, {
      projects: [
        { id: 'p1', name: 'Q4 复盘', canvasWidth: 1280, canvasHeight: 720, userId: 'u', updatedAt: '2026-06-26T10:00:00.000Z' },
      ],
    })
    renderProjects()
    await waitFor(() => expect(screen.getByText('Q4 复盘')).toBeInTheDocument())
    expect(screen.getByText(/1280×720/)).toBeInTheDocument()
  })

  it('shows empty state when no projects', async () => {
    mock.onGet('/projects').reply(200, { projects: [] })
    renderProjects()
    await waitFor(() => expect(screen.getByText(/还没有项目/)).toBeInTheDocument())
  })

  it('shows error on failure', async () => {
    mock.onGet('/projects').reply(500)
    renderProjects()
    await waitFor(() => expect(screen.getByText(/加载项目失败/)).toBeInTheDocument())
  })
})
