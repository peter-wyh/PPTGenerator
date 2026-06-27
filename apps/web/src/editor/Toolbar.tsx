import { useNavigate } from 'react-router-dom'
import { useEditorStore } from './store'
import { Button } from '../components/Button'
import { REGISTRY } from './blocks'
import type { BasicComponentType } from '@ppt-generator/shared'

export function Toolbar() {
  const navigate = useNavigate()
  const addComponent = useEditorStore((s) => s.addComponent)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const label = saveStatus === 'saving' ? '保存中…' : saveStatus === 'error' ? '保存失败' : saveStatus === 'saved' ? '已保存' : ''
  return (
    <header className="flex items-center justify-between border-b border-edge bg-surface px-4 py-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate('/projects')}>← 返回</Button>
        <span className="text-lg font-extrabold text-primary">MediaKit</span>
      </div>
      <div className="flex items-center gap-2">
        {(Object.entries(REGISTRY) as [BasicComponentType, (typeof REGISTRY)[BasicComponentType]][]).map(
          ([type, def]) => (
            <Button key={type} variant="ghost" onClick={() => addComponent(type)}>
              + {def.label}
            </Button>
          ),
        )}
        <Button variant="ghost" disabled>撤销</Button>
        <Button variant="ghost" disabled>重做</Button>
        <span className="w-20 text-xs text-neutral-500">{label}</span>
      </div>
    </header>
  )
}
