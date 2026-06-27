import { describe, it, expect, beforeEach } from 'vitest'
import { useEmailEditorStore } from '../../src/email-editor/store'
import { defaultEmailData } from '../../src/email-editor/defaultData'

describe('emailEditor store', () => {
  beforeEach(() => {
    useEmailEditorStore.setState({ data: structuredClone(defaultEmailData) })
  })

  it('setField updates a nested scalar by path', () => {
    useEmailEditorStore.getState().setField(['header', 'logo'], 'NEW_LOGO')
    expect(useEmailEditorStore.getState().data.header.logo).toBe('NEW_LOGO')
  })

  it('setField updates an array item field', () => {
    useEmailEditorStore.getState().setField(['topDeals', 0, 'brand'], 'NEWBRAND')
    expect(useEmailEditorStore.getState().data.topDeals[0].brand).toBe('NEWBRAND')
    expect(useEmailEditorStore.getState().data.topDeals[1].brand).toBe('CRICUT')
  })

  it('setField updates feature nested detail', () => {
    useEmailEditorStore.getState().setField(['feature', 'details', 1, 'text'], 'x')
    expect(useEmailEditorStore.getState().data.feature.details[1].text).toBe('x')
  })

  it('reset restores defaultEmailData', () => {
    useEmailEditorStore.getState().setField(['header', 'logo'], 'X')
    useEmailEditorStore.getState().reset()
    expect(useEmailEditorStore.getState().data.header.logo).toBe(defaultEmailData.header.logo)
  })
})
