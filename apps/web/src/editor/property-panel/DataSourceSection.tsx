/**
 * DataSourceSection：通用数据来源切换器。
 *
 * 三种模式互斥：手动填写 / URL 解析 / 项目数据导入。
 * 模式选择写入 comp.data._dataSource。
 * 模式对应 UI 由当前配置驱动：
 *  - manual  → 不渲染额外 UI（字段编辑在下方"内容"分区统一展示）
 *  - url     → 渲染 URL 输入框 + 解析按钮，调用 dataSource.urlResolver
 *  - project → 渲染 dataSource.projectImporter 组件
 */
import { useState, useEffect } from 'react';
import type { EditorComponent, DataSourceMode } from '@mediakit/shared';
import type { DataSourceConfig } from '../registry';
import { useEditorStore } from '../store';
import { FieldGroup } from './helpers';

const MODE_LABELS: Record<DataSourceMode, { label: string; icon: string }> = {
  manual: { label: '手动', icon: '✏️' },
  url: { label: 'URL', icon: '🔗' },
  project: { label: '项目', icon: '📥' },
};

export function DataSourceSection({
  comp,
  config,
}: {
  comp: EditorComponent;
  config: DataSourceConfig;
}) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);

  const currentMode = ((comp.data as { _dataSource?: DataSourceMode })._dataSource ?? 'project') as DataSourceMode;
  const modes: DataSourceMode[] = config.modes.length > 0 ? config.modes : ['manual'];

  function switchMode(mode: DataSourceMode) {
    updateComponentData(comp.id, { _dataSource: mode });
    commit();
  }

  // ── URL 解析子组件 ──
  let urlSection: React.ReactNode = null;
  if (currentMode === 'url' && config.urlResolver) {
    urlSection = (
      <UrlResolverSection comp={comp} resolver={config.urlResolver} />
    );
  }

  // ── 项目导入子组件 ──
  let projectSection: React.ReactNode = null;
  if (currentMode === 'project' && config.projectImporter) {
    const Importer = config.projectImporter;
    projectSection = <Importer comp={comp} />;
  }

  // 单模式无需切换器
  if (modes.length <= 1) {
    return (
      <FieldGroup title="数据来源">
        {urlSection}
        {projectSection}
      </FieldGroup>
    );
  }

  return (
    <FieldGroup title="数据来源">
      {/* 模式切换 chip */}
      <div className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 rounded border px-2 py-1 text-xs transition ${
              currentMode === m
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {MODE_LABELS[m].icon} {MODE_LABELS[m].label}
          </button>
        ))}
      </div>

      {/* 模式对应内容 */}
      {currentMode === 'manual' && (
        <p className="text-[11px] text-foreground-muted">
          在下方「内容」分区手动编辑各字段
        </p>
      )}
      {urlSection}
      {projectSection}
    </FieldGroup>
  );
}

/** URL 解析子区域：输入框 + 解析按钮 */
function UrlResolverSection({
  comp,
  resolver,
}: {
  comp: EditorComponent;
  resolver: (url: string) => Promise<Record<string, unknown>>;
}) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as { sourceUrl?: string };
  const [url, setUrl] = useState(data.sourceUrl ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(data.sourceUrl ?? '');
  }, [data.sourceUrl]);

  async function onParse() {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus('error');
      setError('请输入 URL');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const patch = await resolver(trimmed);
      updateComponentData(comp.id, { ...patch, sourceUrl: trimmed });
      commit();
      setStatus('idle');
    } catch {
      setStatus('error');
      setError('解析失败，请检查链接或平台是否支持');
    }
  }

  return (
    <>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="粘贴链接…"
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
      />
      <button
        onClick={onParse}
        disabled={status === 'loading'}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-50"
      >
        {status === 'loading' ? '解析中…' : '🔍 解析'}
      </button>
      {status === 'error' && (
        <div className="text-xs text-red-500">{error}</div>
      )}
    </>
  );
}
