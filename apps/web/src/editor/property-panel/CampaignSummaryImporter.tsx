import { useEffect, useRef, useState } from 'react';
import type { Campaign, CampaignSummaryData, EditorComponent } from '@mediakit/shared';
import { useEditorStore } from '../store';
import { campaignsApi, dtoToCampaign } from '@/api/campaignsApi';
import { getCampaignSummary } from '@/api/analytics/affiliate';
import { parseFile } from '../datasource/parse';
import { FieldGroup } from './helpers';
import { toast } from '@/components/Toast';

/**
 * 业绩看板（campaign-summary）统一数据导入面板。
 * 支持三种数据源：
 * 1. 从项目已绑定 Campaign 一键导入
 * 2. 切换其他 Campaign（按业务线过滤）导入
 * 3. 从 Excel/CSV 文件导入指标表格
 */

type Tab = 'campaign' | 'excel';

export function CampaignSummaryImporter({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const commit = useEditorStore((s) => s.commit);
  const boundCampaign = useEditorStore((s) => s.reportData.campaign);
  const projectBl = useEditorStore((s) => s.projectMeta?.businessLine);

  const [tab, setTab] = useState<Tab>('campaign');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(boundCampaign?.id ?? '');
  const [importing, setImporting] = useState(false);

  // Excel state
  const fileRef = useRef<HTMLInputElement>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  // 拉取 campaign 列表（按业务线过滤）
  useEffect(() => {
    let alive = true;
    setCampaignsLoading(true);
    const opts: { businessLineCode?: string } = {};
    if (projectBl) opts.businessLineCode = projectBl;
    campaignsApi
      .list(opts)
      .then((dtos) => {
        if (!alive) return;
        const list = dtos.map(dtoToCampaign);
        setCampaigns(list);
        // 预选已绑定 campaign
        if (!selectedCampaignId && boundCampaign?.id) {
          setSelectedCampaignId(boundCampaign.id);
        } else if (!selectedCampaignId && list.length > 0) {
          setSelectedCampaignId(list[0].id);
        }
      })
      .catch(() => {
        if (alive) setCampaigns([]);
      })
      .finally(() => alive && setCampaignsLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectBl]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? boundCampaign ?? null;

  /** 从 Campaign 拉取 summary 数据并填充到组件 */
  async function importFromCampaign() {
    if (!selectedCampaignId) return;
    setImporting(true);
    try {
      const s = getCampaignSummary(selectedCampaignId);
      const patch: CampaignSummaryData = {
        ...(comp.data as CampaignSummaryData),
        campaignName: s.campaignName,
        period: s.period,
        metrics: [
          { label: 'Spend', value: s.totalSpend },
          { label: 'Revenue', value: s.totalRevenue },
          { label: 'ROAS', value: s.roas },
          { label: 'Commission', value: s.totalCommission },
        ],
        customerSplit: {
          newCustomers: s.newCustomers,
          returningCustomers: s.returningCustomers,
          newCustomerRate: s.newCustomerRate,
        },
      };
      setComponentData(comp.id, patch);
      commit();
      toast.success(`已导入「${selectedCampaign?.name ?? 'Campaign'}」数据`);
    } catch {
      toast.error('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  }

  /** 从 Excel/CSV 解析指标数据 */
  async function handleExcel(file: File) {
    setExcelError(null);
    try {
      const sheets = await parseFile(file);
      const sheet = sheets[0];
      if (!sheet || sheet.columns.length === 0) {
        setExcelError('文件为空或无表头');
        return;
      }
      // 期望至少 2 列：指标名 + 数值（可选：对比）
      const headers = sheet.columns;
      const rows = sheet.rows;
      const metrics: { label: string; value: string; compare?: string }[] = rows.map((r) => ({
        label: String(r[headers[0]] ?? ''),
        value: String(r[headers[1]] ?? ''),
        compare: headers[2] ? String(r[headers[2]] ?? '') : undefined,
      }));

      const patch: CampaignSummaryData = {
        ...(comp.data as CampaignSummaryData),
        metrics,
      };
      setComponentData(comp.id, patch);
      commit();
      toast.success(`已从 Excel 导入 ${metrics.length} 项指标`);
    } catch {
      setExcelError('解析失败，请检查文件格式（首行表头，后续为数据行）');
    }
  }

  return (
    <FieldGroup title="数据导入">
      {/* Tab 切换 */}
      <div className="mb-2 flex gap-1">
        <button
          onClick={() => setTab('campaign')}
          className={`rounded px-2 py-1 text-xs ${
            tab === 'campaign'
              ? 'bg-accent-primary text-white'
              : 'border border-border-default text-foreground-secondary hover:bg-surface-hover'
          }`}
        >
          Campaign 数据
        </button>
        <button
          onClick={() => setTab('excel')}
          className={`rounded px-2 py-1 text-xs ${
            tab === 'excel'
              ? 'bg-accent-primary text-white'
              : 'border border-border-default text-foreground-secondary hover:bg-surface-hover'
          }`}
        >
          Excel 导入
        </button>
      </div>

      {/* Campaign Tab */}
      {tab === 'campaign' && (
        <div className="space-y-2">
          {/* 已绑定 Campaign 快捷提示 */}
          {boundCampaign && (
            <p className="text-[10px] text-accent-primary">
              🔗 项目绑定：{boundCampaign.name}
            </p>
          )}

          {campaignsLoading && (
            <p className="text-[11px] text-foreground-muted">加载 Campaign 列表…</p>
          )}

          {!campaignsLoading && campaigns.length === 0 && (
            <p className="text-[11px] text-foreground-muted">
              {projectBl
                ? `没有业务线「${projectBl}」的 Campaign 数据`
                : '没有可用的 Campaign，请先在数据管理中添加'}
            </p>
          )}

          {/* Campaign 选择器 */}
          {campaigns.length > 0 && (
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.businessLine ? ` (${c.businessLine})` : ''}
                </option>
              ))}
            </select>
          )}

          {/* 预览选中 Campaign 的指标 */}
          {selectedCampaign && selectedCampaign.metrics && selectedCampaign.metrics.length > 0 && (
            <div className="rounded border border-border-default p-1.5">
              <div className="mb-1 text-[10px] text-foreground-muted">
                预览（{selectedCampaign.metrics.length} 项指标）
              </div>
              <table className="w-full text-[11px]">
                <tbody>
                  {selectedCampaign.metrics.slice(0, 5).map((mm) => (
                    <tr key={mm.label}>
                      <td className="text-left text-foreground-secondary">{mm.label}</td>
                      <td className="text-right text-foreground-primary">{mm.value}</td>
                      {mm.compare && (
                        <td
                          className="text-right"
                          style={{
                            color: mm.compare.trim().startsWith('-')
                              ? 'var(--color-danger, #dc2626)'
                              : 'var(--color-success, #16a34a)',
                          }}
                        >
                          {mm.compare}
                        </td>
                      )}
                    </tr>
                  ))}
                  {selectedCampaign.metrics.length > 5 && (
                    <tr>
                      <td colSpan={3} className="text-center text-foreground-muted">
                        … 共 {selectedCampaign.metrics.length} 项
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 导入按钮 */}
          <button
            onClick={importFromCampaign}
            disabled={!selectedCampaignId || importing}
            className="w-full rounded bg-accent-primary px-2 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
          >
            {importing ? '导入中…' : '⚡ 导入 Campaign 数据'}
          </button>

          <p className="text-[10px] text-foreground-muted">
            {projectBl
              ? `已按业务线「${projectBl}」过滤`
              : '未设置业务线，显示全部 Campaign'}
          </p>
        </div>
      )}

      {/* Excel Tab */}
      {tab === 'excel' && (
        <div className="space-y-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded border border-border-default px-2 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            📂 导入 Excel/CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleExcel(f);
              if (fileRef.current) fileRef.current.value = '';
            }}
          />
          {excelError && <div className="text-xs text-red">{excelError}</div>}
          <div className="text-[10px] text-foreground-muted">
            格式：首行表头（指标 · 数值 · 对比），后续每行一项 KPI。覆盖当前看板指标。
          </div>
        </div>
      )}
    </FieldGroup>
  );
}
