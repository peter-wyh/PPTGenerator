import { useEmailEditorStore } from './store'
import { Section } from './Section'
import { FieldImage } from './FieldImage'
import { Input } from '../components/Input'

export function EmailSidebar() {
  const data = useEmailEditorStore((s) => s.data)
  const f = useEmailEditorStore((s) => s.setField)

  return (
    <aside className="w-[480px] shrink-0 overflow-y-auto border-r border-edge bg-neutral-50 p-5">
      <h2 className="mb-4 text-base font-bold text-neutral-700">邮件编辑器</h2>

      <Section title="1. 头部 Header" defaultOpen>
        <FieldImage label="Logo URL" value={data.header.logo} onChange={(v) => f(['header', 'logo'], v)} />
        <div className="mb-3"><Input label="Sub Title" value={data.header.subtitle} onChange={(e) => f(['header', 'subtitle'], e.target.value)} /></div>
        <div className="mb-3"><Input label="Main Title" value={data.hero.title} onChange={(e) => f(['hero', 'title'], e.target.value)} /></div>
        <div className="mb-3"><Input label="Date Text" value={data.date} onChange={(e) => f(['date'], e.target.value)} /></div>
      </Section>

      <Section title="2. 顶部精选 Top Deals (3)">
        {data.topDeals.map((item, i) => (
          <div key={i} className="mb-2 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-xs font-bold uppercase text-primary">Item {i + 1}</div>
            <div className="mb-3"><Input label="Brand" value={item.brand} onChange={(e) => f(['topDeals', i, 'brand'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Text" value={item.text} onChange={(e) => f(['topDeals', i, 'text'], e.target.value)} /></div>
            <FieldImage label="Image" value={item.img} onChange={(v) => f(['topDeals', i, 'img'], v)} />
            <div className="mb-3"><Input label="Link" value={item.link} onChange={(e) => f(['topDeals', i, 'link'], e.target.value)} /></div>
          </div>
        ))}
      </Section>

      <Section title="3. 主推大图 Featured">
        <div className="mb-3"><Input label="Title" value={data.feature.title} onChange={(e) => f(['feature', 'title'], e.target.value)} /></div>
        <div className="mb-3"><Input label="Intro" value={data.feature.intro} onChange={(e) => f(['feature', 'intro'], e.target.value)} /></div>
        <FieldImage label="Main Img" value={data.feature.mainImg} onChange={(v) => f(['feature', 'mainImg'], v)} />
        <div className="mb-3"><Input label="Prod Name" value={data.feature.prodName} onChange={(e) => f(['feature', 'prodName'], e.target.value)} /></div>
        <div className="mb-3"><Input label="Btn Text" value={data.feature.btnText} onChange={(e) => f(['feature', 'btnText'], e.target.value)} /></div>
        {data.feature.details.map((det, i) => (
          <div key={i} className="mb-2 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-xs font-bold uppercase text-primary">Detail {i + 1}</div>
            <FieldImage label="Img" value={det.img} onChange={(v) => f(['feature', 'details', i, 'img'], v)} />
            <div className="mb-3"><Input label="Text" value={det.text} onChange={(e) => f(['feature', 'details', i, 'text'], e.target.value)} /></div>
          </div>
        ))}
      </Section>

      <Section title="4. 时尚区 Fashion (6)">
        {data.fashion.map((item, i) => (
          <div key={i} className="mb-2 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-xs font-bold uppercase text-primary">Product {i + 1}</div>
            <div className="mb-3"><Input label="Brand" value={item.brand} onChange={(e) => f(['fashion', i, 'brand'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Name" value={item.name} onChange={(e) => f(['fashion', i, 'name'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Discount" value={item.discount} onChange={(e) => f(['fashion', i, 'discount'], e.target.value)} /></div>
            <FieldImage label="Image" value={item.img} onChange={(v) => f(['fashion', i, 'img'], v)} />
            <div className="mb-3"><Input label="Link" value={item.link} onChange={(e) => f(['fashion', i, 'link'], e.target.value)} /></div>
          </div>
        ))}
      </Section>

      <Section title="5. 美妆区 Beauty (3)">
        {data.beauty.map((item, i) => (
          <div key={i} className="mb-2 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-xs font-bold uppercase text-primary">Product {i + 1}</div>
            <div className="mb-3"><Input label="Brand" value={item.brand} onChange={(e) => f(['beauty', i, 'brand'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Name" value={item.name} onChange={(e) => f(['beauty', i, 'name'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Discount" value={item.discount} onChange={(e) => f(['beauty', i, 'discount'], e.target.value)} /></div>
            <FieldImage label="Image" value={item.img} onChange={(v) => f(['beauty', i, 'img'], v)} />
            <div className="mb-3"><Input label="Link" value={item.link} onChange={(e) => f(['beauty', i, 'link'], e.target.value)} /></div>
          </div>
        ))}
      </Section>
    </aside>
  )
}
