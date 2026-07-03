import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';

interface SizePreset {
  id: string;
  label: string;
  hint: string;
  w: number;
  h: number;
}

const PRESETS: SizePreset[] = [
  { id: '1280x720', label: '1280 × 720', hint: '横版 · 投放报告', w: 1280, h: 720 },
  { id: '1920x1080', label: '1920 × 1080', hint: '宽屏', w: 1920, h: 1080 },
  { id: '1024x768', label: '1024 × 768', hint: '标准 4:3', w: 1024, h: 768 },
  { id: '1080x1920', label: '1080 × 1920', hint: '竖版', w: 1080, h: 1920 },
];

interface Props {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (values: { name: string; width: number; height: number }) => void;
}

/** 新建项目完整表单弹窗：名称 + 画布尺寸（预设 / 自定义）。 */
export function CreateProjectDialog({ open, loading, error, onCancel, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [custom, setCustom] = useState(false);
  const [width, setWidth] = useState(PRESETS[0].w);
  const [height, setHeight] = useState(PRESETS[0].h);

  // 每次打开重置为默认。
  useEffect(() => {
    if (open) {
      setName('');
      setPresetId(PRESETS[0].id);
      setCustom(false);
      setWidth(PRESETS[0].w);
      setHeight(PRESETS[0].h);
    }
  }, [open]);

  if (!open) return null;

  function pickPreset(p: SizePreset) {
    setPresetId(p.id);
    setCustom(false);
    setWidth(p.w);
    setHeight(p.h);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const w = Math.max(1, Math.min(8192, Math.round(Number(width) || 0)));
    const h = Math.max(1, Math.min(8192, Math.round(Number(height) || 0)));
    onSubmit({ name: trimmed, width: w, height: h });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <form
        className="w-full max-w-md rounded-xl bg-surface-primary p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
      >
        <h3 className="font-headings text-base font-semibold text-foreground-primary">新建项目</h3>

        <div className="mt-4 space-y-4">
          <Input
            label="项目名称"
            name="name"
            placeholder="例如：2026 Q4 增长复盘"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />

          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground-secondary">画布尺寸</span>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => pickPreset(p)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    !custom && presetId === p.id
                      ? 'border-accent-primary bg-accent-primary/5'
                      : 'border-border-default hover:bg-surface-hover'
                  }`}
                >
                  <div className="text-sm font-medium text-foreground-primary">{p.label}</div>
                  <div className="text-[11px] text-foreground-muted">{p.hint}</div>
                </button>
              ))}
            </div>

            <label className="mt-2 flex items-center gap-2 text-xs text-foreground-secondary">
              <input
                type="checkbox"
                checked={custom}
                onChange={(e) => {
                  setCustom(e.target.checked);
                  if (!e.target.checked) {
                    const p = PRESETS.find((x) => x.id === presetId) ?? PRESETS[0];
                    setWidth(p.w);
                    setHeight(p.h);
                  }
                }}
              />
              自定义尺寸
            </label>

            {custom && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  name="width"
                  type="number"
                  label="宽"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
                <span className="mt-5 text-foreground-muted">×</span>
                <Input
                  name="height"
                  type="number"
                  label="高"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="submit" loading={loading} disabled={!name.trim()}>
            创建
          </Button>
        </div>
      </form>
    </div>
  );
}
