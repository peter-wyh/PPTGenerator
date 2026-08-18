/**
 * RecipeEditor — Recipe 报告四层编辑器(DataPanel/ContentPanel/StylePanel/StructurePanel)。
 *
 * 工作模式:
 *  - 任一层的 onChange → 更新本地 state(content/tokens/manifest) → debounce 500ms
 *    调 htmlTemplatesApi.reRender(不保存)刷新右侧 iframe 预览。
 *  - 「保存」按钮 → 调 htmlTemplatesApi.saveRecipeConfig(versionId, cfg) 把当前三层
 *    配置落到 HtmlVersion,后端会重渲染并写回 html。
 *  - DataPanel「重新生成」:有 versionId 时走 recomputeRecipe(period) 持久化(后端按新
 *    时间段重跑 mapCampaign 并落库),onRecomputed→onSaved 让父组件 reloadVersion,
 *    配合父组件传入的 key(含 updatedAt)让本编辑器重挂载注入新 reportContent。
 *    无 versionId 时降级走 generate({mode:'recipe'}) 仅刷新预览。
 *
 * 四层 default 值由父组件从 HtmlVersionDetail 注入(reportContent/tokenOverrides/manifestOverrides)。
 */
import { useState, useEffect, useCallback } from 'react';
import { htmlTemplatesApi, type ManifestOverrides, type RecipeDataCoverage } from '@/api/htmlTemplates';
import { DataPanel } from './DataPanel';
import { ContentPanel } from './ContentPanel';
import { StylePanel } from './StylePanel';
import { StructurePanel } from './StructurePanel';

interface Props {
  versionId: string;
  recipeId: string;
  campaignId?: string;
  reportPeriod?: { startDate?: string; endDate?: string };
  reportContent: unknown;
  tokenOverrides: Record<string, unknown>;
  manifestOverrides: ManifestOverrides;
  onSaved?: () => void;
}

export function RecipeEditor(props: Props) {
  const [content, setContent] = useState<Record<string, unknown>>(
    (props.reportContent as Record<string, unknown>) ?? {},
  );
  const [tokens, setTokens] = useState<Record<string, unknown>>(props.tokenOverrides ?? {});
  const [manifest, setManifest] = useState<ManifestOverrides>(props.manifestOverrides ?? {});
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // 「宁缺勿假」数据覆盖,从 reportContent 提取传给 DataPanel
  const coverage = (props.reportContent as { dataCoverage?: RecipeDataCoverage } | null | undefined)?.dataCoverage;

  // debounce reRender — 任意一层变化都触发(失败不阻塞编辑)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const html = await htmlTemplatesApi.reRender({
          recipeId: props.recipeId,
          campaignId: props.campaignId,
          reportContent: content,
          tokenOverrides: tokens,
          manifestOverrides: manifest,
        });
        setPreviewHtml(html);
        setPreviewError('');
      } catch {
        setPreviewError('预览渲染失败');
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, tokens, manifest, props.recipeId, props.campaignId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await htmlTemplatesApi.saveRecipeConfig(props.versionId, {
        reportContent: content,
        tokenOverrides: tokens,
        manifestOverrides: manifest,
      });
      props.onSaved?.();
    } finally {
      setSaving(false);
    }
  }, [content, tokens, manifest, props.versionId, props.onSaved]);

  // 重新生成 → 只刷新预览(全量 HTML 来自 generate,不落 content state)
  const handleRegenerated = useCallback((html: string) => {
    setPreviewHtml(html);
  }, []);

  return (
    <div className="flex h-full gap-3 overflow-hidden">
      {/* 左:四层面板 */}
      <div className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto p-3">
        <DataPanel
          campaignId={props.campaignId}
          reportPeriod={props.reportPeriod}
          versionId={props.versionId}
          coverage={coverage}
          onRecomputed={() => props.onSaved?.()}
          onRegenerated={handleRegenerated}
        />
        <ContentPanel content={content} onChange={setContent} />
        <StylePanel tokens={tokens} onChange={setTokens} />
        <StructurePanel manifest={manifest} onChange={setManifest} />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-accent-primary px-3 py-2 text-sm text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
        >
          {saving ? '保存中…' : '💾 保存'}
        </button>
        {previewError && (
          <p className="rounded bg-red/10 px-2 py-1 text-[11px] text-red">{previewError}</p>
        )}
      </div>

      {/* 右:实时预览 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <iframe
          srcDoc={previewHtml}
          sandbox="allow-same-origin allow-scripts"
          title="Recipe Report Preview"
          className="h-full w-full flex-1 rounded-lg border border-border-default bg-white"
        />
      </div>
    </div>
  );
}
