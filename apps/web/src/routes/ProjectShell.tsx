import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ProjectDetail } from '@mediakit/shared';
import { projectsApi } from '@/api/projects';

/**
 * M0 占位：仅加载并展示项目名 + 尺寸。
 * 编辑器内核（画布 / REGISTRY / 7 基础组件 / 属性面板 / 自动保存）在 M1 落地。
 */
export function ProjectShell() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    projectsApi
      .get(id)
      .then(setProject)
      .catch(() => setError('项目加载失败或不存在'));
  }, [id]);

  if (error) return <div className="p-8 text-sm text-red">{error}</div>;
  if (!project) return <div className="p-8 text-sm text-foreground-muted">加载中…</div>;

  return (
    <div className="p-8">
      <h1 className="font-headings text-xl font-semibold text-foreground-primary">{project.name}</h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        {project.width}×{project.height} · {project.pages.length} 页
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-border-default bg-surface-primary p-10 text-center text-sm text-foreground-muted">
        画布编辑器将在 M1 里程碑落地。
      </div>
    </div>
  );
}
