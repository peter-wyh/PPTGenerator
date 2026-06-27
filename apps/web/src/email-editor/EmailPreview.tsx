import { useMemo, useState } from 'react'
import { useEmailEditorStore } from './store'
import { generateEmailHtml } from './generateHtml'

export function EmailPreview() {
  const data = useEmailEditorStore((s) => s.data)
  const html = useMemo(() => generateEmailHtml(data), [data])
  const [btnLabel, setBtnLabel] = useState('复制代码')

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(html)
      setBtnLabel('已复制 ✓')
    } catch {
      setBtnLabel('复制失败')
    }
    setTimeout(() => setBtnLabel('复制代码'), 2000)
  }

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-auto bg-neutral-200 p-8">
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-8 top-8 z-10 rounded bg-primary px-5 py-2 text-sm font-bold text-white shadow hover:bg-primary-hover"
      >
        {btnLabel}
      </button>
      <iframe title="email-preview" srcDoc={html} className="h-[1200px] w-[650px] max-w-full border-none bg-white shadow-lg" />
    </div>
  )
}
