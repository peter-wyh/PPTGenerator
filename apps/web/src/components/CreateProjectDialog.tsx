import { useEffect, useState } from 'react';
import type { Campaign, ProjectMeta, Scenario, ScenarioSub } from '@mediakit/shared';
import { Button } from './Button';
import { Input } from './Input';
import {
  ADVERTISERS,
  BUSINESS_LINES,
  isCampaignScenario,
  SCENARIOS,
} from '@/projectsMeta';
import { listCampaigns } from '@/api/campaigns';

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

/** 新建项目表单：场景驱动，campaign 类型从上游接口(mock)选择具体 campaign 并联动填充。 */
export function CreateProjectDialog({ open, loading, error, onCancel, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState<Scenario | ''>('');
  const [scenarioSub, setScenarioSub] = useState<ScenarioSub>('weekly');
  const [creator, setCreator] = useState('');

  // campaign（上游 mock）
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignId, setCampaignId] = useState('');

  // media-kit 手动字段
  const [mkBusinessLine, setMkBusinessLine] = useState('');
  const [mkAdvertiser, setMkAdvertiser] = useState('');

  // 画布尺寸
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [custom, setCustom] = useState(false);
  const [width, setWidth] = useState(PRESETS[0].w);
  const [height, setHeight] = useState(PRESETS[0].h);

  const isCampaign = isCampaignScenario(scenario as Scenario);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) ?? null;

  useEffect(() => {
    if (open) {
      setName('');
      setScenario('');
      setScenarioSub('weekly');
      setCreator('');
      setCampaignId('');
      setMkBusinessLine('');
      setMkAdvertiser('');
      setPresetId(PRESETS[0].id);
      setCustom(false);
      setWidth(PRESETS[0].w);
      setHeight(PRESETS[0].h);
    }
  }, [open]);

  // 进入 campaign 类型场景时懒加载上游 campaign 列表。
  useEffect(() => {
    if (open && isCampaign && campaigns.length === 0 && !campaignsLoading) {
      setCampaignsLoading(true);
      listCampaigns()
        .then(setCampaigns)
        .finally(() => setCampaignsLoading(false));
    }
  }, [open, isCampaign, campaigns.length, campaignsLoading]);

  if (!open) return null;

  function pickPreset(p: SizePreset) {
    setPresetId(p.id);
    setCustom(false);
    setWidth(p.w);
    setHeight(p.h);
  }

  const canSubmit =
    !!name.trim() && (!scenario || !isCampaignScenario(scenario as Scenario) || !!campaignId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !canSubmit) return;
    const w = Math.max(1, Math.min(8192, Math.round(Number(width) || 0)));
    const h = Math.max(1, Math.min(8192, Math.round(Number(height) || 0)));

    const meta: ProjectMeta = {
      creator: creator || undefined,
      scenario: (scenario || undefined) as Scenario | undefined,
      scenarioSub: scenario === 'campaign-report' ? scenarioSub : undefined,
    };

    if (isCampaignScenario(scenario as Scenario) && selectedCampaign) {
      meta.campaignId = selectedCampaign.id;
      meta.businessLine = selectedCampaign.businessLine;
      meta.advertiser = selectedCampaign.advertiser;
      meta.campaignInfo = {
        campaignName: selectedCampaign.name,
        platform: selectedCampaign.platform,
        startDate: selectedCampaign.startDate,
        endDate: selectedCampaign.endDate,
        budget: selectedCampaign.budget,
      };
    } else if (scenario === 'media-kit') {
      meta.businessLine = mkBusinessLine || undefined;
      meta.advertiser = mkAdvertiser || undefined;
    }

    onSubmit({ name: trimmed, width: w, height: h, meta });
  }

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

          {/* 场景（驱动后续表单） */}
          <label className="block text-sm text-foreground-secondary">
            <span className="mb-1 block font-medium">场景</span>
            <select
              className={selectCls}
              value={scenario}
              onChange={(e) => {
                setScenario(e.target.value as Scenario | '');
                setCampaignId('');
              }}
            >
              <option value="">（请选择场景）</option>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {/* campaign 类型：选具体 campaign（上游接口 mock） */}
          {isCampaign && (
            <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-hover/40 p-3">
              <label className="block text-sm text-foreground-secondary">
                <span className="mb-1 block font-medium">
                  Campaign <span className="text-foreground-muted">（来自上游接口）</span>
                </span>
                <select
                  className={selectCls}
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  disabled={campaignsLoading}
                >
                  <option value="">{campaignsLoading ? '加载中…' : '（选择 Campaign）'}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.advertiser}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCampaign && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground-secondary">
                  <span>广告主：{selectedCampaign.advertiser}</span>
                  <span>业务线：{selectedCampaign.businessLine}</span>
                  <span>平台：{selectedCampaign.platform}</span>
                  <span>预算：{selectedCampaign.budget}</span>
                  <span className="col-span-2">
                    周期：{selectedCampaign.startDate} ~ {selectedCampaign.endDate}
                  </span>
                </div>
              )}

              {/* campaign 报告：报告类型 */}
              {scenario === 'campaign-report' && (
                <label className="block text-sm text-foreground-secondary">
                  <span className="mb-1 block">报告类型</span>
                  <select
                    className={selectCls}
                    value={scenarioSub}
                    onChange={(e) => setScenarioSub(e.target.value as ScenarioSub)}
                  >
                    {SCENARIOS.find((s) => s.id === 'campaign-report')?.subs?.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* media-kit：手动选广告主 / 业务线 */}
          {scenario === 'media-kit' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm text-foreground-secondary">
                <span className="mb-1 block">广告主</span>
                <select className={selectCls} value={mkAdvertiser} onChange={(e) => setMkAdvertiser(e.target.value)}>
                  <option value="">（选填）</option>
                  {ADVERTISERS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-foreground-secondary">
                <span className="mb-1 block">业务线</span>
                <select className={selectCls} value={mkBusinessLine} onChange={(e) => setMkBusinessLine(e.target.value)}>
                  <option value="">（选填）</option>
                  {BUSINESS_LINES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* 创建人（通用） */}
          <label className="block text-sm text-foreground-secondary">
            <span className="mb-1 block">创建人</span>
            <select className={selectCls} value={creator} onChange={(e) => setCreator(e.target.value)}>
              <option value="">（选填）</option>
              {['alex', 'stella', 'reese', 'stacey'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

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

          {error && <p className="text-sm text-red">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="submit" loading={loading} disabled={!canSubmit}>
            创建
          </Button>
        </div>
      </form>
    </div>
  );
}
