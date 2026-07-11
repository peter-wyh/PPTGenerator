import { useEffect, useRef, useState } from 'react';
import type {
  CreatorAvatarCardData,
  EditorComponent,
  WorkScreenshotItem,
} from '@mediakit/shared';
import { useEditorStore, allReportCreators } from '../store';
import { campaignCreatorWorks, type CreatorWithWorks } from '@/api/creatorPerformance';
import { parseCreatorLink } from '../creatorLink';
import { ImportDataModal } from '../components/ImportDataModal';
import { ImportCampaignModal } from '../components/ImportCampaignModal';
import { metricsToRows } from '../campaignMetrics';

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
  const { creator: pageCreator, creatorId: pageCreatorId, creators: allCreators } = usePageCreator();
  const campaign = useEditorStore((s) => s.reportData.campaign);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creatorsWithWorks, setCreatorsWithWorks] = useState<{ creatorId: string; creatorName: string; platform: string; tier: string; posts: { id: string; title: string; cover: string; platform: string }[] }[]>([]);

  const campaignId = campaign?.id ?? '';

  // Load works for globally-configured creators only (filtered to this campaign).
  const creatorsKey = allCreators.map((c) => c.id).join(',');
  useEffect(() => {
    if (!campaignId || allCreators.length === 0) {
      setCreatorsWithWorks([]);
      return;
    }
    let alive = true;
    setLoading(true);
    try {
      const allWorks = campaignCreatorWorks(campaignId);
      // Only include creators that are in the global data config
      const allowedIds = new Set(allCreators.map((c) => c.id));
      const filtered = allWorks.filter((cw) => allowedIds.has(cw.creatorId));
      if (!alive) return;
      setCreatorsWithWorks(filtered.map((cw) => ({
        creatorId: cw.creatorId,
        creatorName: cw.creatorName,
        platform: cw.platform,
        tier: cw.tier,
        posts: cw.posts.map((p) => ({ id: p.postId, title: p.title, cover: p.cover, platform: p.platform })),
      })));
      // Default: select page-bound creator only, or all if no page binding (first load only)
      setSelectedCreatorIds((prev) => {
        if (prev.size > 0) return prev; // keep user's choice
        if (pageCreatorId && filtered.some((c) => c.creatorId === pageCreatorId)) {
          return new Set([pageCreatorId]); // 只选页面绑定的达人
        }
        return new Set(filtered.map((c) => c.creatorId)); // 无页面绑定则全选
      });
    } catch {
      // ignore
    } finally {
      if (alive) setLoading(false);
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, creatorsKey, pageCreatorId]);

  const selectedCreators = creatorsWithWorks.filter((c) => selectedCreatorIds.has(c.creatorId));
  const selectedPostCount = selectedCreators.reduce((sum, c) => sum + c.posts.length, 0);

  function toggleCreator(creatorId: string) {
    const next = new Set(selectedCreatorIds);
    if (next.has(creatorId)) next.delete(creatorId);
    else next.add(creatorId);
    setSelectedCreatorIds(next);
  }

  function importSelected() {
    const images: WorkScreenshotItem[] = [];
    for (const c of selectedCreators) {
      for (const post of c.posts) {
        images.push({ src: post.cover, caption: `${c.creatorName} · ${post.title}` });
      }
    }
    if (images.length === 0) return;
    updateComponentData(comp.id, { images });
    commit();
  }

  if (!campaignId) {
    return (
      <FieldGroup title="Import from Campaign">
        <p className="text-xs text-foreground-muted">Bind a Campaign in global data settings first.</p>
      </FieldGroup>
    );
  }

  if (allCreators.length === 0) {
    return (
      <FieldGroup title="Import from Campaign">
        <p className="text-xs text-foreground-muted">Select creators in global data settings first.</p>
      </FieldGroup>
    );
  }

  return (
    <FieldGroup title="Import from Campaign">
      {loading && <p className="text-xs text-foreground-muted">Loading…</p>}
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">
          🔗 页面达人：{pageCreator.name}
        </p>
      )}
      {creatorsWithWorks.length > 0 && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground-secondary">
                Creators ({selectedCreators.length}/{creatorsWithWorks.length})
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCreatorIds(new Set(creatorsWithWorks.map((c) => c.creatorId)))}
                  className="text-[11px] text-accent-primary hover:underline"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedCreatorIds(new Set())}
                  className="text-[11px] text-foreground-muted hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            {creatorsWithWorks.map((c) => (
              <label
                key={c.creatorId}
                className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={selectedCreatorIds.has(c.creatorId)}
                  onChange={() => toggleCreator(c.creatorId)}
                  className="h-3 w-3 accent-accent-primary"
                />
                <span className="text-xs text-foreground-primary">
                  {c.creatorName}
                  <span className="ml-1 text-foreground-muted">
                    {c.platform} · {c.tier} · {c.posts.length} posts
                  </span>
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={importSelected}
            disabled={loading || selectedPostCount === 0}
            className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? 'Loading...'
              : `Import ${selectedPostCount} screenshot${selectedPostCount === 1 ? '' : 's'} from ${selectedCreators.length} creator${selectedCreators.length === 1 ? '' : 's'}`}
          </button>
        </>
      )}
      {creatorsWithWorks.length === 0 && !loading && (
        <p className="text-xs text-foreground-muted">No works found for selected creators in this campaign.</p>
      )}
    </FieldGroup>
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
    updateComponentData(comp.id, {
      name: cr.name,
      platform: (cr.platform ?? 'TikTok') as CreatorAvatarCardData['platform'],
      handle: cr.handle,
      followers: cr.followers,
      engagement: cr.engagement,
      intro: cr.category ? `${cr.category} · ${cr.region ?? ''}`.trim() : '',
    });
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
    if (!cr || !cr.stats?.length) return;
    updateComponentData(comp.id, { stats: cr.stats.map((s) => ({ ...s })) });
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

/**
 * creator-works-list：选一个达人 → 从 campaign performance 导入该达人的作品列表。
 * 达人选择范围限定在全局「数据配置」中的已选达人，不能超出。
 */
export function ReportCreatorWorksImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creatorId: pageCreatorId, creators } = usePageCreator();
  const reportData = useEditorStore((s) => s.reportData);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selectedCreator, setSelectedCreator] = useState('');
  const [creatorsWithWorks, setCreatorsWithWorks] = useState<CreatorWithWorks[]>([]);
  const [loading, setLoading] = useState(false);

  const campaignId = reportData?.campaign?.id ?? '';

  useEffect(() => {
    if (!campaignId) { setCreatorsWithWorks([]); return; }
    setLoading(true);
    const allWorks = campaignCreatorWorks(campaignId);
    // Only include creators that are in the global data config
    const allowedIds = new Set(creators.map((c) => c.id));
    setCreatorsWithWorks(allWorks.filter((cw) => allowedIds.has(cw.creatorId)));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, creators.map((c) => c.id).join(',')]);

  // 自动预选页面绑定的达人
  useEffect(() => {
    if (pageCreatorId && !selectedCreator) setSelectedCreator(pageCreatorId);
  }, [pageCreatorId, selectedCreator]);

  if (!campaignId) {
    return (
      <FieldGroup title="Import from Campaign">
        <p className="text-xs text-foreground-muted">Bind a Campaign in global data settings first.</p>
      </FieldGroup>
    );
  }

  function apply() {
    const cw = creatorsWithWorks.find((c) => c.creatorId === selectedCreator);
    if (!cw || cw.posts.length === 0) return;
    const headers = ['Cover', 'Title', 'Impressions', 'Likes', 'Comments', 'Shares', 'Eng. Rate'];
    const rows = cw.posts.map((post) => [
      post.cover,
      post.title,
      post.impressions,
      post.likes,
      post.comments,
      post.shares,
      post.engagementRate,
    ]);
    updateComponentData(comp.id, { headers, rows, title: `${cw.creatorName} Works` });
    commit();
    setSelectedCreator('');
  }

  return (
    <FieldGroup title="Import from Campaign">
      {loading && <p className="text-xs text-foreground-muted">Loading…</p>}
      {creatorsWithWorks.length > 0 && (
        <>
          {pageCreator && (
            <p className="mb-1 text-[10px] text-accent-primary">
              🔗 页面达人：{pageCreator.name}
            </p>
          )}
          <select
            value={selectedCreator}
            onChange={(e) => setSelectedCreator(e.target.value)}
            className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
          >
            <option value="">Select creator…</option>
            {creatorsWithWorks.map((c) => (
              <option key={c.creatorId} value={c.creatorId}>
                {c.creatorName} ({c.posts.length} posts)
              </option>
            ))}
          </select>
          {selectedCreator && (
            <button
              onClick={apply}
              className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
            >
              Import {creatorsWithWorks.find((c) => c.creatorId === selectedCreator)?.posts.length ?? 0} posts
            </button>
          )}
        </>
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
    if (!cr?.audience?.genderSplit?.length) return;
    updateComponentData(comp.id, {
      slices: cr.audience.genderSplit.map((g) => ({
        label: g.label,
        value: g.value,
        color: g.color ?? 'auto',
      })),
    });
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
    if (!cr?.audience?.ageRange?.length) return;
    updateComponentData(comp.id, {
      bars: cr.audience.ageRange.map((a) => ({
        label: a.label,
        value: a.value,
        color: a.color ?? 'auto',
      })),
    });
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
