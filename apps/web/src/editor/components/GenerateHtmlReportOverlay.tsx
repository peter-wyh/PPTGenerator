import { useState, useEffect, useCallback, useRef } from 'react';
import { htmlTemplatesApi, type HtmlVersionSummary } from '@/api/htmlTemplates';
import { Button } from '@/components/Button';

import { AiGenerateForm } from './AiGenerateForm';
import { useBusinessLineCodes } from '@/editor/useBusinessLineLogo';

interface Props {
  /** 已有报告 ID（从报告列表入口时传入）。 */
  projectId?: string;
  /** Campaign ID（必传：Campaign 列表入口直接传 campaignId）。 */
  campaignId?: string;
  /** Campaign 名称（用于默认报告名）。 */
  campaignName?: string;
  /** 报告实际时间范围（优先于 campaign 全局起止日期）。 */
  reportPeriod?: { startDate?: string; endDate?: string };
  onClose: () => void;
  onSaved?: (projectId: string) => void;
}

const CREATOR_SUGGESTIONS = ['alex', 'stella', 'reese', 'stacey'];
const selectCls = 'w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary';

/**
 * 生成 HTML 报告 Overlay：
 *  - 模板模式：选择 HTML 模板 → 自动填充 campaign 数据
 *  - AI 模式：输入提示词 → DeepSeek 生成完整 HTML
 *  - 预览（iframe）、复制源码、下载、保存到报告
 *  - 业务线 design.md 回显与二次编辑
 */
export function GenerateHtmlReportOverlay({ projectId, campaignId, campaignName, reportPeriod, onClose, onSaved }: Props) {
  const BUSINESS_LINES = useBusinessLineCodes(); // 数据库唯一来源
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 保存表单状态
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportBL, setReportBL] = useState('');
  const [reportCreator, setReportCreator] = useState('');

  // ★ 多版本管理
  const [versions, setVersions] = useState<HtmlVersionSummary[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // ★ 加载已有版本（已有报告模式）
  useEffect(() => {
    if (!projectId) return;
    htmlTemplatesApi
      .listHtmlVersions(projectId)
      .then((vs) => {
        setVersions(vs);
        const active = vs.find((v) => v.isActive);
        setActiveVersionId(active?.id || vs[0]?.id || null);
      })
      .catch(() => {});
  }, [projectId]);

  const handleGenerate = useCallback(
    async (vals: { mode: 'ai' | 'recipe'; prompt: string; designMd: string }) => {
      setLoading(true);
      setError('');
      setGeneratedHtml('');
      try {
        const html = await htmlTemplatesApi.generate({
          mode: vals.mode,
          prompt: vals.mode === 'ai' ? vals.prompt : undefined,
          campaignId,
          designMd: vals.mode === 'ai' && vals.designMd.trim() ? vals.designMd.trim() : undefined,
          reportPeriod,
        });
        setGeneratedHtml(html);
      } catch (e: any) {
        const status = e?.response?.status;
        const bizMsg = e?.response?.data?.error?.message || e?.response?.data?.message;
        if (bizMsg) setError(bizMsg);
        else if (status === 500) setError('AI 生成超时或服务异常，请稍后重试（报告越复杂耗时越长）');
        else if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') setError('请求超时，请重试');
        else setError(e?.message || '生成失败，请重试');
      } finally {
        setLoading(false);
      }
    },
    [campaignId, reportPeriod],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedHtml]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${projectId || campaignId || 'campaign'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedHtml, projectId, campaignId]);

  // 保存：已有报告 → 弹出版本对话框（覆盖/新增）；Campaign 入口 → 创建新报告
  const handleClickSave = useCallback(() => {
    if (projectId) {
      // 已有报告 — 弹出多版本保存对话框
      setShowSaveDialog(true);
    } else {
      // Campaign 模式 — 先填表单
      setReportName(`${campaignName ?? 'Campaign'} HTML 报告`);
      setShowSaveForm(true);
    }
  }, [projectId, campaignName]);

  // 执行保存（多版本模式）
  const doSaveVersion = useCallback(
    async (mode: 'overwrite' | 'new', versionName?: string) => {
      if (!projectId) return;
      setLoading(true);
      setError('');
      setShowSaveDialog(false);
      try {
        const result = await htmlTemplatesApi.saveHtml(projectId, generatedHtml, {
          mode,
          name: versionName,
        });
        setSaved(true);
        setActiveVersionId(result.versionId);
        // 重新加载版本列表
        const vs = await htmlTemplatesApi.listHtmlVersions(projectId);
        setVersions(vs);
        setTimeout(() => onSaved?.(projectId), 1200);
      } catch (e: any) {
        setError(e?.response?.data?.error?.message || '保存失败');
      } finally {
        setLoading(false);
      }
    },
    [projectId, generatedHtml, onSaved],
  );

  // Campaign 入口 — 创建新报告并保存
  const doSaveNewProject = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError('');
    try {
      const result = await htmlTemplatesApi.saveHtmlAsProject({
        html: generatedHtml,
        campaignId,
        name: reportName.trim() || `${campaignName ?? 'Campaign'} HTML 报告`,
        businessLine: reportBL || undefined,
        creator: reportCreator || undefined,
      });
      setSaved(true);
      setShowSaveForm(false);
      setTimeout(() => onSaved?.(result.projectId), 1200);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  }, [campaignId, campaignName, generatedHtml, reportName, reportBL, reportCreator, onSaved]);

  const handleSaveFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    void doSaveNewProject();
  }, [doSaveNewProject]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-surface-primary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <h2 className="text-lg skin-fw-heading text-foreground-primary">
            ⚡ 生成 HTML 报告{campaignName ? ` — ${campaignName}` : ''}
          </h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground-primary">✕</button>
        </div>

        {/* Body: left config / right preview */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — config */}
          <div className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-r border-border-default p-5">
            <AiGenerateForm
              campaignId={campaignId}
              onGenerate={handleGenerate}
              generating={loading && !generatedHtml}
              error={error && !showSaveForm ? error : undefined}
            />
          </div>

          {/* Right panel — preview / source */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            {generatedHtml ? (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
                  <div className="flex skin-gap-sm">
                    <Button variant="ghost" onClick={handleCopy} className="px-2 py-1 text-xs">
                      {copied ? '✓ 已复制' : '📋 复制源码'}
                    </Button>
                    <Button variant="ghost" onClick={handleDownload} className="px-2 py-1 text-xs">
                      💾 下载 HTML
                    </Button>
                  </div>
                  <Button variant="primary" onClick={handleClickSave} loading={loading} disabled={loading} className="px-3 py-1 text-xs">
                    {saved ? '💾 另存/覆盖' : projectId ? '保存到报告' : '保存为新报告'}
                  </Button>
                </div>
                {/* iframe preview */}
                <iframe
                  ref={iframeRef}
                  srcDoc={generatedHtml}
                  title="HTML Report Preview"
                  className="h-full w-full flex-1 border-0 bg-white"
                  sandbox="allow-same-origin allow-scripts"
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-foreground-muted">
                <div className="text-center">
                  <div className="mb-3 text-5xl opacity-30">📄</div>
                  <p className="text-sm">选择生成方式，点击「生成报告」预览</p>
                </div>
              </div>
            )}

            {/* 保存报告信息弹窗（Campaign 模式） */}
            {showSaveForm && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                <form
                  onSubmit={handleSaveFormSubmit}
                  className="w-full max-w-md rounded-xl bg-surface-primary p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-headings text-base skin-fw-heading text-foreground-primary">保存报告信息</h3>
                  <p className="mt-1 text-xs text-foreground-muted">填写报告基本信息，保存后可在报告管理中查看。</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm skin-fw-body text-foreground-secondary">报告名称</label>
                      <input
                        className={selectCls}
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        placeholder="例如：WANDER Summer Travel 投放结案"
                        autoFocus
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm skin-fw-body text-foreground-secondary">业务线</label>
                      <select
                        className={selectCls}
                        value={reportBL}
                        onChange={(e) => setReportBL(e.target.value)}
                      >
                        <option value="">（可选）</option>
                        {BUSINESS_LINES.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm skin-fw-body text-foreground-secondary">创建人</label>
                      <input
                        className={selectCls}
                        list="gen-html-creator-suggestions"
                        value={reportCreator}
                        onChange={(e) => setReportCreator(e.target.value)}
                        placeholder="输入创建人姓名"
                      />
                      <datalist id="gen-html-creator-suggestions">
                        {CREATOR_SUGGESTIONS.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    {error && (
                      <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</p>
                    )}
                  </div>
                  <div className="mt-6 flex justify-end skin-gap-sm">
                    <Button type="button" variant="secondary" onClick={() => setShowSaveForm(false)} disabled={loading}>
                      取消
                    </Button>
                    <Button type="submit" loading={loading} disabled={!reportName.trim()}>
                      {saved ? '✓ 已保存' : '保存报告'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────── 多版本保存对话框（覆盖/新增版本） ────── */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-xl bg-surface-primary p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-medium text-foreground-primary">保存报告</h3>
            <div className="space-y-3">
              <button
                onClick={() => doSaveVersion('overwrite')}
                className="w-full rounded-lg border border-border-default p-3 text-left transition hover:bg-surface-hover"
              >
                <div className="text-sm font-medium text-foreground-primary">📋 覆盖当前版本</div>
                <div className="mt-0.5 text-xs text-foreground-muted">
                  {activeVersionId
                    ? `替换「${versions.find((v) => v.id === activeVersionId)?.name || '当前版本'}」`
                    : '覆盖当前内容'}
                </div>
              </button>
              <button
                onClick={() => {
                  const name = window.prompt('请输入新版本名称', `新版本 ${new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}`);
                  if (name) doSaveVersion('new', name);
                }}
                className="w-full rounded-lg border border-border-default p-3 text-left transition hover:bg-surface-hover"
              >
                <div className="text-sm font-medium text-foreground-primary">➕ 新增版本</div>
                <div className="mt-0.5 text-xs text-foreground-muted">保存为新版本，不影响已有版本</div>
              </button>
            </div>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="mt-4 w-full rounded-lg py-2 text-xs text-foreground-muted hover:bg-surface-hover"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
