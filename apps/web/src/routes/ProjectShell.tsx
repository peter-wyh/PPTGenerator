import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ProjectDetail } from '@mediakit/shared';
import { projectsApi } from '@/api/projects';
import { Editor } from '@/editor/Editor';

export function ProjectShell() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return <Editor detail={project} />;
}
