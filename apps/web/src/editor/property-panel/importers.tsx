import { useEffect, useRef, useState } from 'react';
import type {
  Campaign,
  CreatorAvatarCardData,
  EditorComponent,
  WorkScreenshotItem,
} from '@mediakit/shared';
import { useEditorStore } from '../store';
import { listCampaigns } from '@/api/campaigns';
import { listCreatorPerformance, type CreatorWithWorks } from '@/api/creatorPerformance';
import { parseCreatorLink } from '../creatorLink';
import { ImportDataModal } from '../components/ImportDataModal';
import { ImportCampaignModal } from '../components/ImportCampaignModal';
import { metricsToRows } from '../campaignMetrics';
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
 * work-screenshot：从绑定 Campaign 的合作达人中选择达人 → 勾选作品 → 导入。
 * 保留「一键全部导入」快捷按钮。
 */
export function ReportWorkScreenshotImporter({ comp }: { comp: EditorComponent }) {
  const campaign = useEditorStore((s) => s.reportData.campaign);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [creators, setCreators] = useState<CreatorWithWorks[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

  const activeCampaignId = campaign?.id ?? selectedCampaign;

  // 未绑定 Campaign 时，拉取全部 mock campaign 供下拉兜底。
  useEffect(() => {
    if (campaign) return;
    let alive = true;
    listCampaigns()
      .then((list) => alive && setCampaigns(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [campaign]);

  // 切换 campaign 时加载达人作品列表。
  useEffect(() => {
    if (!activeCampaignId) {
      setCreators([]);
      return;
    }
    let alive = true;
    setLoading(true);
    listCreatorPerformance(activeCampaignId)
      .then((perfs) => {
        if (!alive) return;
        const mapped: CreatorWithWorks[] = perfs.map((p) => ({
          creatorId: p.creatorId,
          creatorName: p.creatorName,
          platform: p.platform,
          tier: p.tier,
          posts: p.posts.map((post) => ({
            postId: post.id,
            creatorId: p.creatorId,
            creatorName: p.creatorName,
            title: post.title,
            cover: post.cover ?? '',
            platform: post.platform,
            publishedAt: post.publishedAt,
          })),
        }));
        setCreators(mapped);
        // 默认全选达人
        setSelectedCreatorIds(new Set(mapped.map((c) => c.creatorId)));
        // 默认全选作品
        setSelectedPostIds(new Set(mapped.flatMap((c) => c.posts.map((p) => p.postId))));
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [activeCampaignId]);

  const allPosts = creators.flatMap((c) => c.posts);
  const selectedPosts = allPosts.filter((p) => selectedPostIds.has(p.postId));

  function toggleCreator(creatorId: string) {
    const creator = creators.find((c) => c.creatorId === creatorId);
    if (!creator) return;
    const next = new Set(selectedCreatorIds);
    if (next.has(creatorId)) {
      next.delete(creatorId);
      // 取消选中该达人的所有作品
      const postIds = new Set(creator.posts.map((p) => p.postId));
      setSelectedPostIds((prev) => {
        const np = new Set(prev);
        for (const id of postIds) np.delete(id);
        return np;
      });
    } else {
      next.add(creatorId);
      // 选中该达人的所有作品
      setSelectedPostIds((prev) => {
        const np = new Set(prev);
        for (const p of creator.posts) np.add(p.postId);
        return np;
      });
    }
    setSelectedCreatorIds(next);
  }

  function togglePost(postId: string) {
    const next = new Set(selectedPostIds);
    if (next.has(postId)) next.delete(postId);
    else next.add(postId);
    setSelectedPostIds(next);
  }

  function selectAll() {
    setSelectedCreatorIds(new Set(creators.map((c) => c.creatorId)));
    setSelectedPostIds(new Set(allPosts.map((p) => p.postId)));
  }

  function selectNone() {
    setSelectedCreatorIds(new Set());
    setSelectedPostIds(new Set());
  }

  function importSelected() {
    if (selectedPosts.length === 0) return;
    const images: WorkScreenshotItem[] = selectedPosts.map((p) => ({
      src: p.cover,
      caption: `${p.creatorName} · ${p.title}`,
    }));
    updateComponentData(comp.id, { images });
    commit();
  }

  async function importAll() {
    if (!activeCampaignId || loading) return;
    setLoading(true);
    try {
      const perfs = await listCreatorPerformance(activeCampaignId);
      const images: WorkScreenshotItem[] = [];
      for (const p of perfs) {
        for (const post of p.posts) {
          images.push({ src: post.cover ?? '', caption: `${p.creatorName} · ${post.title}` });
        }
      }
      if (images.length) {
        updateComponentData(comp.id, { images });
        commit();
      }
    } finally {
      setLoading(false);
    }
  }

  const noCampaign = !campaign && !selectedCampaign;

  return (
    <FieldGroup title="从达人数据导入">
      {noCampaign ? (
        <div className="space-y-1">
          <div className="text-[11px] text-foreground-muted">未绑定 Campaign，可选一个：</div>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
          >
            <option value="">选择 Campaign…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          {/* 快捷：一键全部导入 */}
          <button
            onClick={importAll}
            disabled={loading}
            className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? '加载中…' : `⚡ 一键导入全部作品（${allPosts.length}）`}
          </button>

          {/* 达人列表 */}
          {creators.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-foreground-secondary">选择达人</span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[11px] text-accent-primary hover:underline">
                    全选
                  </button>
                  <button onClick={selectNone} className="text-[11px] text-foreground-muted hover:underline">
                    清空
                  </button>
                </div>
              </div>
              {creators.map((c) => (
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
                      {c.platform} · {c.tier} · {c.posts.length}作品
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* 作品缩略图选择 */}
          {selectedPosts.length > 0 || allPosts.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-foreground-secondary">作品预览（勾选要导入的）</div>
              <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto">
                {allPosts
                  .filter((p) => selectedCreatorIds.has(p.creatorId))
                  .map((p) => (
                    <label
                      key={p.postId}
                      className="group relative cursor-pointer overflow-hidden rounded border border-border-subtle"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPostIds.has(p.postId)}
                        onChange={() => togglePost(p.postId)}
                        className="absolute left-1 top-1 z-10 h-3 w-3 accent-accent-primary"
                      />
                      {p.cover ? (
                        <img
                          src={p.cover}
                          alt={p.title}
                          className="h-16 w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-16 items-center justify-center bg-surface-secondary text-[10px] text-foreground-muted">
                          无封面
                        </div>
                      )}
                      <div className="truncate px-1 py-0.5 text-[10px] text-foreground-secondary">
                        {p.title}
                      </div>
                    </label>
                  ))}
              </div>
            </div>
          ) : null}

          {/* 导入选中作品 */}
          {selectedPosts.length > 0 && (
            <button
              onClick={importSelected}
              className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
            >
              ⚡ 导入选中的 {selectedPosts.length} 个作品
            </button>
          )}
        </>
      )}
    </FieldGroup>
  );
}

/**
 * creator-avatar-card：从「数据配置」面板已选达人中选一个，一键填充头像卡字段。
 */
export function ReportCreatorAvatarImporter({ comp }: { comp: EditorComponent }) {
  const creators = useEditorStore((s) => s.reportData.creators ?? []);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected);
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
  const creators = useEditorStore((s) => s.reportData.creators ?? []);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected);
    if (!cr || !cr.stats?.length) return;
    updateComponentData(comp.id, { stats: cr.stats.map((s) => ({ ...s })) });
    commit();
    setSelected('');
  }

  const selectedCreator = creators.find((c) => c.id === selected);
  const hasStats = (selectedCreator?.stats?.length ?? 0) > 0;

  return (
    <FieldGroup title="从项目数据导入">
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
  const creators = useEditorStore((s) => s.reportData.creators ?? []);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
 * creator-works-list：选一个达人 → 用其 name/platform/followers 等填充作品列表行。
 * 因为 reportData 不含作品列表，这里生成达人基本信息行。
 */
export function ReportCreatorWorksImporter({ comp }: { comp: EditorComponent }) {
  const creators = useEditorStore((s) => s.reportData.creators ?? []);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected);
    if (!cr) return;
    const data = comp.data as { headers?: string[]; rows?: string[][] };
    const headers = data.headers?.length
      ? data.headers
      : ['Cover', 'Title', 'Shares', 'Likes', 'Comments'];
    // 在已有 rows 基础上追加一行达人信息
    const newRow = ['', `${cr.name} · 精选作品`, cr.followers ?? '--', cr.engagement ?? '--', '--'];
    const rows = [...(data.rows ?? []), newRow];
    updateComponentData(comp.id, { headers, rows });
    commit();
    setSelected('');
  }

  return (
    <FieldGroup title="从项目数据导入">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人追加一行…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{c.platform}）
          </option>
        ))}
      </select>
      {selected && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 追加达人信息行
        </button>
      )}
    </FieldGroup>
  );
}
