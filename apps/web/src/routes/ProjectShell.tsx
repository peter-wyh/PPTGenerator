import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { ProjectDetail } from '@mediakit/shared';
import { projectsApi } from '@/api/projects';
import { Editor } from '@/editor/Editor';

type SeedState = { seeded?: boolean } | null;

export function ProjectShell() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 来自 Projects.tsx 创建流的 seeded 提示（仅 create-flow 设置；从模板新建不设置）。
  // 清掉 history.state，刷新后不再重现。
  const seeded = (location.state as SeedState)?.seeded;
  useEffect(() => {
    if (seeded !== undefined && window.history.state?.usr?.seeded !== undefined) {
      window.history.replaceState({}, '');
    }
  }, [seeded]);

  const [showSeedHint, setShowSeedHint] = useState(seeded !== undefined);

  useEffect(() => {
    if (!id) return;
    setError(null);
    setProject(null);
    projectsApi
      .get(id)
      .then(setProject)
      .catch(() => setError('项目加载失败或不存在'));
  }, [id]);

  if (error) return <div className="p-8 text-sm text-red">{error}</div>;
  if (!project) return <div className="p-8 text-sm text-foreground-muted">加载中…</div>;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showSeedHint && seeded !== undefined && (
        <SeedHintBanner seeded={seeded} onDismiss={() => setShowSeedHint(false)} />
      )}
      <Editor detail={project} />
    </div>
  );
}

function SeedHintBanner({ seeded, onDismiss }: { seeded: boolean; onDismiss: () => void }) {
  return (
    <div
      className={
        'flex items-center justify-between gap-3 px-4 py-2 text-xs ' +
        (seeded
          ? 'border-b border-accent-primary/30 bg-accent-primary/5 text-foreground-secondary'
          : 'border-b border-border-subtle bg-surface-hover text-foreground-secondary')
      }
      role="status"
    >
      <span>
        {seeded ? '已套用默认模板的页面骨架与样式' : '未配置该业务线的默认模板,已创建空白项目'}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded px-2 py-0.5 text-foreground-muted hover:bg-surface-hover hover:text-foreground-secondary"
      >
        知道了
      </button>
    </div>
  );
}
