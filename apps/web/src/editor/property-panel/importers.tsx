import { useEffect, useRef, useState } from 'react';
import type {
  CollaborationDeliverable,
  CreatorAvatarCardData,
  EditorComponent,
  WorkAudienceInsight,
} from '@mediakit/shared';
import { useEditorStore, allReportCreators } from '../store';
import { getCollaboration } from '@/api/collaborations';
import { parseCreatorLink } from '../creatorLink';
import { formatExecPrice, formatCPE, formatCPM } from '@/lib/format';
import { ImportDataModal } from '../components/ImportDataModal';
import { ImportCampaignModal } from '../components/ImportCampaignModal';
import { metricsToRows } from '../campaignMetrics';
import { campaignDataPatch, creatorPatch } from '../pageBinding';

/**
 * 从当前页面的 creatorId 绑定中自动获取达人。
 * - creator-case 页面：page.creatorId 直接绑定
 * - creator-collab 页面：page.creatorId 直接绑定
 * 返回 { creator, creatorId }，无绑定时 creator=null。
 */
function usePageCreator() {
  const pageCreatorId = useEditorStore((s) => {
    const p = s.pages.find((pg) => pg.id === s.currentPageId);
    return p?.creatorId;
  });
  const creators = allReportCreators(useEditorStore((s) => s.reportData));
  const creator = pageCreatorId ? creators.find((c) => c.id === pageCreatorId) ?? null : null;
  return { creator, creatorId: pageCreatorId ?? '', creators };
}
import type { ChartData } from '../datasource/resolve';
import { parseFile } from '../datasource/parse';
import { FieldGroup } from './helpers';
import { DeliverablePicker } from './DeliverablePicker';

export function CreatorLinkImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorAvatarCardData;
  const [url, setUrl] = useState(data.sourceUrl ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(data.sourceUrl ?? '');
  }, [data.sourceUrl]);

  const onParse = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus('error');
      setError('请粘贴达人链接');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const parsed = await parseCreatorLink(trimmed);
      updateComponentData(comp.id, parsed);
      commit();
      setStatus('idle');
    } catch {
      setStatus('error');
      setError('暂仅支持 TikTok / Instagram / YouTube / 微博 链接');
    }
  };

  return (
    <FieldGroup title="达人链接解析">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="粘贴达人主页/视频链接…"
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
      />
      <button
        onClick={onParse}
        disabled={status === 'loading'}
        className="mt-1 rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-50"
      >
        {status === 'loading' ? '解析中…' : '解析'}
      </button>
      {status === 'error' && <div className="mt-1 text-xs text-red">{error}</div>}
    </FieldGroup>
  );
}

export function ChartImportButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chartType = comp.type as 'bar-chart' | 'line-chart' | 'pie-chart';
  const prevTitle = (comp.data as { title?: string }).title;

  return (
    <FieldGroup title="数据导入">
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        导入 Excel/CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      {file && (
        <ImportDataModal
          file={file}
          chartType={chartType}
          prevTitle={prevTitle}
          onConfirm={(data: ChartData) => {
            setComponentData(comp.id, data);
            setFile(null);
          }}
          onCancel={() => setFile(null)}
        />
      )}
    </FieldGroup>
  );
}

export function KpiImportButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const sheets = await parseFile(file);
      const sheet = sheets[0];
      if (!sheet || sheet.columns.length === 0) {
        setError('文件为空或无表头');
        return;
      }
      const headers = sheet.columns;
      const rows = sheet.rows.map((r) => headers.map((h) => r[h] ?? ''));
      setComponentData(comp.id, { ...comp.data, headers, rows });
    } catch {
      setError('解析失败，请检查文件格式');
    }
  }

  return (
    <FieldGroup title="数据导入">
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        导入 Excel/CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div className="text-[11px] text-foreground-muted">
        首行作为表头，其余作为数据行；仅覆盖表格内容。
      </div>
    </FieldGroup>
  );
}

export function ImportCampaignButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const defaultCampaignId = useEditorStore((s) => s.projectMeta?.campaignId);
  const boundCampaign = useEditorStore((s) => s.reportData.campaign);
  const [open, setOpen] = useState(false);

  /** 一键从已绑定 Campaign 导入（无需弹模态框）。 */
  function quickImport() {
    if (!boundCampaign?.metrics?.length) return;
    const patch = metricsToRows(boundCampaign.metrics);
    setComponentData(comp.id, { ...comp.data, ...patch });
  }

  return (
    <FieldGroup title="从 Campaign 导入">
      {/* 已绑定 Campaign 时，显示一键导入快捷按钮 */}
      {boundCampaign && boundCampaign.metrics && boundCampaign.metrics.length > 0 ? (
        <>
          <button
            onClick={quickImport}
            className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
          >
            ⚡ 导入「{boundCampaign.name}」
          </button>
          <div className="text-[11px] text-foreground-muted">
            从「数据配置」绑定的 Campaign 一键导入 {boundCampaign.metrics.length} 项指标。
          </div>
          <button
            onClick={() => setOpen(true)}
            className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            换一个 Campaign…
          </button>
        </>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          选择 Campaign 导入
        </button>
      )}
      <div className="text-[11px] text-foreground-muted">
        导入选中 campaign 的投放表现指标（Spend/Impressions/Clicks/Conversions/CTR/ROAS），覆盖当前表格。
      </div>
      {open && (
        <ImportCampaignModal
          defaultCampaignId={defaultCampaignId ?? boundCampaign?.id}
          onConfirm={(metrics) => {
            const patch = metricsToRows(metrics);
            setComponentData(comp.id, { ...comp.data, ...patch });
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </FieldGroup>
  );
}

/**
 * work-screenshot：从全局「数据配置」已绑定的 Campaign + 已选达人中选作品截图。
 * 只能选全局配置范围内的 campaign 和达人，不能超出。
 */
export function ReportWorkScreenshotImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入截图"
      onPick={(d) => {
        updateComponentData(comp.id, { images: d.screenshots ?? [] });
        commit();
      }}
    />
  );
}

/**
 * creator-avatar-card：从「数据配置」面板已选达人中选一个，一键填充头像卡字段。
 */
export function ReportCreatorAvatarImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creators } = usePageCreator();
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  // 自动预选页面绑定的达人
  useEffect(() => {
    if (pageCreator && !selected) setSelected(pageCreator.id);
  }, [pageCreator, selected]);

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected) ?? pageCreator;
    if (!cr) return;
    const patch = creatorPatch('creator-avatar-card', cr, '');
    if (!patch) return;
    updateComponentData(comp.id, patch);
    commit();
    setSelected('');
  }

  return (
    <FieldGroup title="从项目数据导入">
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">
          🔗 页面达人：{pageCreator.name}
        </p>
      )}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{c.platform} · {c.tier}）
          </option>
        ))}
      </select>
      {selected && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 导入到头像卡
        </button>
      )}
    </FieldGroup>
  );
}

/**
 * meta-strip（基础信息）：从「数据配置」面板已选达人中选一个，
 * 一键填充信息条（CATEGORY / REGION / TIER）。缺字段自动跳过。
 */
export function ReportCreatorMetaStripImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creators } = usePageCreator();
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  // 自动预选页面绑定的达人
  useEffect(() => {
    if (pageCreator && !selected) setSelected(pageCreator.id);
  }, [pageCreator, selected]);

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected) ?? pageCreator;
    if (!cr) return;
    const patch = creatorPatch('meta-strip', cr, '');
    if (!patch) return;
    updateComponentData(comp.id, patch);
    commit();
    setSelected('');
  }

  return (
    <FieldGroup title="从项目数据导入">
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">
          🔗 页面达人：{pageCreator.name}
        </p>
      )}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{c.platform} · {c.tier}）
          </option>
        ))}
      </select>
      {selected && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 导入到基础信息
        </button>
      )}
    </FieldGroup>
  );
}

/**
 * creator-stats-strip：从「数据配置」面板已选达人中选一个，一键填充达人数据条 KPI。
 */
export function ReportCreatorStatsImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creators } = usePageCreator();
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  // 自动预选页面绑定的达人
  useEffect(() => {
    if (pageCreator && !selected) setSelected(pageCreator.id);
  }, [pageCreator, selected]);

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected) ?? pageCreator;
    if (!cr) return;
    const patch = creatorPatch('creator-stats-strip', cr, '');
    if (!patch) return;
    updateComponentData(comp.id, patch);
    commit();
    setSelected('');
  }

  const selectedCreator = creators.find((c) => c.id === selected) ?? pageCreator;
  const hasStats = (selectedCreator?.stats?.length ?? 0) > 0;

  return (
    <FieldGroup title="从项目数据导入">
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">
          🔗 页面达人：{pageCreator.name}
        </p>
      )}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{(c.stats?.length ?? 0)} 项 KPI）
          </option>
        ))}
      </select>
      {selected && hasStats && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 导入 {selectedCreator!.stats!.length} 项 KPI
        </button>
      )}
      {selected && !hasStats && (
        <p className="mt-1 text-[11px] text-foreground-muted">该达人未配置 KPI 数据</p>
      )}
    </FieldGroup>
  );
}

/**
 * creator-list：多选达人 → 一键填充达人列表 rows。
 * 约定列顺序 [Avatar, Name, Platform, Followers, Engagement, Category]。
 */
export function ReportCreatorListImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creatorId: pageCreatorId, creators } = usePageCreator();
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 自动预选页面绑定的达人
  useEffect(() => {
    if (pageCreatorId && selectedIds.length === 0) setSelectedIds([pageCreatorId]);
  }, [pageCreatorId, selectedIds]);

  if (creators.length === 0) return null;

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applyAll() {
    const picked = creators.filter((c) => selectedIds.includes(c.id));
    if (!picked.length) return;
    const headers = ['Avatar', 'Name', 'Platform', 'Followers', 'Engagement', 'Category'];
    const rows = picked.map((cr) => [
      cr.avatar ?? '',
      cr.name,
      cr.platform ?? '',
      cr.followers ?? '',
      cr.engagement ?? '',
      cr.category ?? '',
    ]);
    updateComponentData(comp.id, { headers, rows });
    commit();
    setSelectedIds([]);
  }

  function applyAllCreators() {
    const headers = ['Avatar', 'Name', 'Platform', 'Followers', 'Engagement', 'Category'];
    const rows = creators.map((cr) => [
      cr.avatar ?? '',
      cr.name,
      cr.platform ?? '',
      cr.followers ?? '',
      cr.engagement ?? '',
      cr.category ?? '',
    ]);
    updateComponentData(comp.id, { headers, rows });
    commit();
  }

  return (
    <FieldGroup title="从项目数据导入">
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">
          🔗 页面达人：{pageCreator.name}
        </p>
      )}
      <div className="space-y-1">
        {creators.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={selectedIds.includes(c.id)}
              onChange={() => toggle(c.id)}
              className="h-3 w-3"
            />
            <span className="text-foreground-primary">{c.name}</span>
            <span className="text-foreground-muted">{c.platform} · {c.followers}</span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {selectedIds.length > 0 && (
          <button
            onClick={applyAll}
            className="rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
          >
            ⚡ 导入选中 ({selectedIds.length})
          </button>
        )}
        <button
          onClick={applyAllCreators}
          className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          导入全部 ({creators.length})
        </button>
      </div>
    </FieldGroup>
  );
}

/** 把一个达人的 deliverables 组装成对齐的 headers/rows/insights（每行一个作品类型）。 */
export function buildWorksTable(deliverables: CollaborationDeliverable[]): {
  headers: string[];
  rows: string[][];
  insights: WorkAudienceInsight[];
} {
  const metricLabels = (deliverables[0]?.metrics ?? []).map((m) => m.label);
  const hasCostFields = deliverables.some((d) => d.execPrice != null);
  const costHeaders = hasCostFields ? ['执行价', 'CPE', 'CPM'] : [];
  const headers = ['封面', '类型', ...metricLabels, ...costHeaders];
  const rows = deliverables.map((d) => {
    const byLabel = new Map((d.metrics ?? []).map((m) => [m.label, m.value]));
    const costCells = hasCostFields
      ? [
          d.execPrice != null ? formatExecPrice(d.execPrice) : '',
          d.cpe != null ? formatCPE(d.cpe) : '',
          d.cpm != null ? formatCPM(d.cpm) : '',
        ]
      : [];
    return [d.screenshots?.[0]?.src ?? '', d.contentType, ...metricLabels.map((l) => byLabel.get(l) ?? ''), ...costCells];
  });
  const insights = deliverables.map((d) => d.audience ?? {});
  return { headers, rows, insights };
}

/**
 * creator-works-list：选一个达人 → 从 campaign performance 导入该达人的作品列表。
 * 达人选择范围限定在全局「数据配置」中的已选达人，不能超出。
 */
export function ReportCreatorWorksImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creatorId: pageCreatorId, creators } = usePageCreator();
  const campaign = useEditorStore((s) => s.reportData.campaign);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const campaignId = campaign?.id ?? '';
  const [creatorId, setCreatorId] = useState(pageCreatorId || creators[0]?.id || '');
  const [deliverables, setDeliverables] = useState<CollaborationDeliverable[] | null>(null);

  useEffect(() => {
    if (!campaignId || !creatorId) {
      setDeliverables([]);
      return;
    }
    let alive = true;
    setDeliverables(null);
    getCollaboration(campaignId, creatorId)
      .then((c) => {
        if (alive) setDeliverables(c?.deliverables ?? []);
      })
      .catch(() => {
        if (alive) setDeliverables([]);
      });
    return () => {
      alive = false;
    };
  }, [campaignId, creatorId]);

  function apply() {
    if (!deliverables || deliverables.length === 0) return;
    const { headers, rows, insights } = buildWorksTable(deliverables);
    updateComponentData(comp.id, { headers, rows, insights });
    commit();
  }

  if (creators.length === 0) {
    return (
      <FieldGroup title="从达人合作导入">
        <p className="text-xs text-foreground-muted">请先在「数据配置」选择达人。</p>
      </FieldGroup>
    );
  }

  return (
    <FieldGroup title="从达人合作导入">
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">🔗 页面达人：{pageCreator.name}</p>
      )}
      <select
        value={creatorId}
        onChange={(e) => setCreatorId(e.target.value)}
        className="w-full rounded border border-border-default px-1.5 py-1 text-xs"
      >
        {creators.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {deliverables === null ? (
        <p className="text-xs text-foreground-muted">加载…</p>
      ) : deliverables.length === 0 ? (
        <p className="text-xs text-foreground-muted">该达人暂无合作数据。</p>
      ) : (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          导入作品列表（{deliverables.length} 个作品类型）
        </button>
      )}
    </FieldGroup>
  );
}

/**
 * KPI Board 复合导入器：文件导入 + Campaign 导入。
 * 用于 dataSource.projectImporter。
 */
export function KpiBoardImporter({ comp }: { comp: EditorComponent }) {
  return (
    <>
      <KpiImportButton comp={comp} />
      <ImportCampaignButton comp={comp} />
    </>
  );
}

/**
 * creator-fan-gender：从页面绑定达人（或全局达人列表）的 audience.genderSplit 一键填充性别占比饼图。
 */
export function ReportCreatorFanGenderImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creators } = usePageCreator();
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (pageCreator && !selected) setSelected(pageCreator.id);
  }, [pageCreator, selected]);

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected) ?? pageCreator;
    if (!cr) return;
    const patch = creatorPatch('creator-fan-gender', cr, '');
    if (!patch) return;
    updateComponentData(comp.id, patch);
    commit();
    setSelected('');
  }

  const selectedCreator = creators.find((c) => c.id === selected) ?? pageCreator;
  const hasData = (selectedCreator?.audience?.genderSplit?.length ?? 0) > 0;

  return (
    <FieldGroup title="从项目数据导入">
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">
          🔗 页面达人：{pageCreator.name}
        </p>
      )}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{c.audience?.genderSplit?.length ?? 0} 项性别数据）
          </option>
        ))}
      </select>
      {selected && hasData && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 导入性别占比
        </button>
      )}
      {selected && !hasData && (
        <p className="mt-1 text-[11px] text-foreground-muted">该达人未配置受众画像数据</p>
      )}
    </FieldGroup>
  );
}

/**
 * creator-fan-age：从页面绑定达人（或全局达人列表）的 audience.ageRange 一键填充年龄段柱状图。
 */
export function ReportCreatorFanAgeImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creators } = usePageCreator();
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (pageCreator && !selected) setSelected(pageCreator.id);
  }, [pageCreator, selected]);

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected) ?? pageCreator;
    if (!cr) return;
    const patch = creatorPatch('creator-fan-age', cr, '');
    if (!patch) return;
    updateComponentData(comp.id, patch);
    commit();
    setSelected('');
  }

  const selectedCreator = creators.find((c) => c.id === selected) ?? pageCreator;
  const hasData = (selectedCreator?.audience?.ageRange?.length ?? 0) > 0;

  return (
    <FieldGroup title="从项目数据导入">
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">
          🔗 页面达人：{pageCreator.name}
        </p>
      )}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{c.audience?.ageRange?.length ?? 0} 个年龄段）
          </option>
        ))}
      </select>
      {selected && hasData && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 导入年龄段数据
        </button>
      )}
      {selected && !hasData && (
        <p className="mt-1 text-[11px] text-foreground-muted">该达人未配置受众画像数据</p>
      )}
    </FieldGroup>
  );
}

/* ================================================================
 * Campaign 报告数据导入器（11 种组件通用）
 * 从绑定的 Campaign 或手动选择 Campaign → 一键填充组件数据
 * ================================================================ */

/** Campaign 报告组件通用导入器：从已绑定 Campaign 一键填充。 */
export function CampaignReportImporter({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const boundCampaign = useEditorStore((s) => s.reportData.campaign);
  const defaultCampaignId = useEditorStore((s) => s.projectMeta?.campaignId);
  const [campaignId, setCampaignId] = useState(boundCampaign?.id ?? defaultCampaignId ?? '');

  function apply() {
    if (!campaignId) return;
    const patch = campaignDataPatch(comp.type, campaignId);
    if (patch) {
      setComponentData(comp.id, { ...comp.data, ...patch });
    }
  }

  return (
    <FieldGroup title="从 Campaign 导入">
      {boundCampaign && (
        <p className="mb-1 text-[10px] text-accent-primary">
          🔗 绑定 Campaign：{boundCampaign.name}
        </p>
      )}
      <select
        value={campaignId}
        onChange={(e) => setCampaignId(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择 Campaign…</option>
        {boundCampaign && <option value={boundCampaign.id}>{boundCampaign.name}</option>}
      </select>
      <button
        onClick={apply}
        disabled={!campaignId}
        className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        ⚡ 导入 Campaign 数据
      </button>
    </FieldGroup>
  );
}

/** work-metrics：从达人合作 deliverable 一键导入效果数据（一次性拷贝）。 */
export function ReportWorkMetricsImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入效果数据"
      onPick={(d) => {
        updateComponentData(comp.id, { metrics: d.metrics ?? [], workName: d.contentType });
        commit();
      }}
    />
  );
}

/** comment-wordcloud：从达人合作 deliverable 一键导入评论词云（一次性拷贝）。 */
export function ReportCommentWordcloudImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入评论词云"
      onPick={(d) => {
        updateComponentData(comp.id, { words: d.wordcloud ?? [] });
        commit();
      }}
    />
  );
}

/** creator-work-metrics：从达人合作 deliverable 一键导入受众画像（一次性拷贝）。 */
export function ReportWorkAudienceImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入画像"
      onPick={(d) => {
        updateComponentData(comp.id, { audience: d.audience });
        commit();
      }}
    />
  );
}
