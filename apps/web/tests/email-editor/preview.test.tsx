import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useEmailEditorStore } from '../../src/email-editor/store'
import { EmailPreview } from '../../src/email-editor/EmailPreview'
import { defaultEmailData } from '../../src/email-editor/defaultData'

describe('EmailPreview', () => {
  beforeEach(() => {
    useEmailEditorStore.setState({ data: structuredClone(defaultEmailData) })
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders an iframe whose srcDoc contains the logo', () => {
    const { container } = render(<EmailPreview />)
    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    expect(iframe.getAttribute('srcdoc')).toContain(defaultEmailData.header.logo)
  })

  it('updates srcDoc when data changes', async () => {
    const { container } = render(<EmailPreview />)
    useEmailEditorStore.getState().setField(['hero', 'title'], 'MEGA SALE')
    await waitFor(() => {
      const iframe = container.querySelector('iframe') as HTMLIFrameElement
      expect(iframe.getAttribute('srcdoc')).toContain('MEGA SALE')
    })
  })

  it('copies generated HTML to clipboard on button click', async () => {
    render(<EmailPreview />)
    fireEvent.click(screen.getByText('复制代码'))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      const arg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(arg).toContain('<table')
    })
  })
})
