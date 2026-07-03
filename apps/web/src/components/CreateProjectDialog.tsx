import { useEffect, useState } from 'react';
import type { ProjectMeta, Scenario, ScenarioSub } from '@mediakit/shared';
import { Button } from './Button';
import { Input } from './Input';
import {
  ADVERTISERS,
  BUSINESS_LINES,
  CREATORS,
  isCampaignScenario,
  mockCampaignInfo,
  PLATFORMS,
  SCENARIOS,
} from '@/projectsMeta';

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

const selectCls =
  'w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary';

interface Props {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (values: { name: string; width: number; height: number; meta: ProjectMeta }) => void;
}

/** 新建项目完整表单弹窗：名称 + 画布尺寸 + 业务线/创建人/场景/广告主 (+campaign 信息)。 */
export function CreateProjectDialog({ open, loading, error, onCancel, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [custom, setCustom] = useState(false);
  const [width, setWidth] = useState(PRESETS[0].w);
  const [height, setHeight] = useState(PRESETS[0].h);

  // meta
  const [businessLine, setBusinessLine] = useState('');
  const [creator, setCreator] = useState('');
  const [scenario, setScenario] = useState<Scenario | ''>('');
  const [scenarioSub, setScenarioSub] = useState<ScenarioSub>('weekly');
  const [advertiser, setAdvertiser] = useState('');
  const [campaign, setCampaign] = useState(mockCampaignInfo());
  const [campaignTouched, setCampaignTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setPresetId(PRESETS[0].id);
      setCustom(false);
      setWidth(PRESETS[0].w);
      setHeight(PRESETS[0].h);
      setBusinessLine('');
      setCreator('');
      setScenario('');
      setScenarioSub('weekly');
      setAdvertiser('');
      setCampaign(mockCampaignInfo());
      setCampaignTouched(false);
    }
  }, [open]);

  if (!open) return null;

  function pickPreset(p: SizePreset) {
    setPresetId(p.id);
    setCustom(false);
    setWidth(p.w);
    setHeight(p.h);
  }

  function changeScenario(s: Scenario | '') {
    setScenario(s);
    // 进入 campaign 类型且用户尚未编辑过 campaign 信息 → 预填 mock。
    if (isCampaignScenario(s as Scenario) && !campaignTouched) {
      setCampaign(mockCampaignInfo());
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const w = Math.max(1, Math.min(8192, Math.round(Number(width) || 0)));
    const h = Math.max(1, Math.min(8192, Math.round(Number(height) || 0)));

    const meta: ProjectMeta = {
      businessLine: businessLine || undefined,
      creator: creator || undefined,
      scenario: (scenario || undefined) as Scenario | undefined,
      scenarioSub: scenario === 'campaign-report' ? scenarioSub : undefined,
      advertiser: advertiser || undefined,
      campaignInfo: isCampaignScenario(scenario as Scenario) ? campaign : undefined,
    };

    onSubmit({ name: trimmed, width: w, height: h, meta });
  }

  const showSub = scenario === 'campaign-report';
  const showCampaign = isCampaignScenario(scenario as Scenario);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-surface-primary p-6 shadow-lg"
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

          {/* 画布尺寸 */}
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
                <Input name="width" type="number" label="宽" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
                <span className="mt-5 text-foreground-muted">×</span>
                <Input name="height" type="number" label="高" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
              </div>
            )}
          </div>

          {/* 业务线 / 创建人 / 广告主 */}
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block">业务线</span>
              <select className={selectCls} value={businessLine} onChange={(e) => setBusinessLine(e.target.value)}>
                <option value="">（选填）</option>
                {BUSINESS_LINES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block">创建人</span>
              <select className={selectCls} value={creator} onChange={(e) => setCreator(e.target.value)}>
                <option value="">（选填）</option>
                {CREATORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block">广告主</span>
              <select className={selectCls} value={advertiser} onChange={(e) => setAdvertiser(e.target.value)}>
                <option value="">（选填）</option>
                {ADVERTISERS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 场景 */}
          <div className={`grid ${showSub ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block">场景</span>
              <select
                className={selectCls}
                value={scenario}
                onChange={(e) => changeScenario(e.target.value as Scenario | '')}
              >
                <option value="">（选填）</option>
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {showSub && (
              <label className="block text-sm text-foreground-secondary">
                <span className="mb-1 block">报告类型</span>
                <select className={selectCls} value={scenarioSub} onChange={(e) => setScenarioSub(e.target.value as ScenarioSub)}>
                  {SCENARIOS.find((s) => s.id === 'campaign-report')?.subs?.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* Campaign 信息（仅 campaign 类型场景） */}
          {showCampaign && (
            <div className="rounded-lg border border-border-subtle bg-surface-hover/40 p-3">
              <div className="mb-2 text-xs font-medium text-foreground-muted">Campaign 信息（mock）</div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Campaign 名称" value={campaign.campaignName} onChange={(e) => { setCampaign({ ...campaign, campaignName: e.target.value }); setCampaignTouched(true); }} />
                <label className="block text-sm text-foreground-secondary">
                  <span className="mb-1 block">投放平台</span>
                  <select className={selectCls} value={campaign.platform} onChange={(e) => { setCampaign({ ...campaign, platform: e.target.value }); setCampaignTouched(true); }}>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <Input label="开始日期" value={campaign.startDate} onChange={(e) => { setCampaign({ ...campaign, startDate: e.target.value }); setCampaignTouched(true); }} />
                <Input label="结束日期" value={campaign.endDate} onChange={(e) => { setCampaign({ ...campaign, endDate: e.target.value }); setCampaignTouched(true); }} />
                <Input label="预算" value={campaign.budget} onChange={(e) => { setCampaign({ ...campaign, budget: e.target.value }); setCampaignTouched(true); }} />
              </div>
            </div>
          )}

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
