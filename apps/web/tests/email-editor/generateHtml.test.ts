import { describe, it, expect } from 'vitest'
import { generateEmailHtml } from '../../src/email-editor/generateHtml'
import { defaultEmailData } from '../../src/email-editor/defaultData'

describe('generateEmailHtml', () => {
  const html = generateEmailHtml(defaultEmailData)

  it('is a full HTML document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html.includes('</html>')).toBe(true)
  })

  it('contains the logo and subtitle', () => {
    expect(html).toContain(defaultEmailData.header.logo)
    expect(html).toContain(defaultEmailData.header.subtitle)
  })

  it('contains brands from each section', () => {
    expect(html).toContain('LAURA GELLER')
    expect(html).toContain('AirEssentials Gathered Waist Dress')
    expect(html).toContain('SPANX')
    expect(html).toContain('LOOKFANTASTIC')
  })

  it('uses primary #FF099E and discount red', () => {
    expect(html).toContain('#FF099E')
    expect(html).toContain('#d32f2f')
  })

  it('includes the mobile stack media query', () => {
    expect(html).toContain('@media')
    expect(html).toContain('stack-column')
  })

  it('reflects edited data', () => {
    const edited = { ...defaultEmailData, hero: { title: 'MEGA SALE' } }
    expect(generateEmailHtml(edited)).toContain('MEGA SALE')
  })
})
