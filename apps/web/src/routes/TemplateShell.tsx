import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ProjectDetail } from '@mediakit/shared';
import { templatesApi } from '@/api/templates';
import { Editor } from '@/editor/Editor';

/**
 * 模板编辑外壳：与 ProjectShell 对称，但通过 templatesApi 加载并以模板模式进入编辑器，
 * 使 save() 落库到 templates。
 */
export function TemplateShell() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setError(null);
    setDetail(null);
    templatesApi
      .get(id)
      // TemplateDetail 与 ProjectDetail 结构兼容（编辑器只读 id/name/pages/width/height/meta）。
      .then((t) => setDetail(t as unknown as ProjectDetail))
      .catch(() => setError('模板加载失败或不存在'));
  }, [id]);

  if (error) return <div className="p-8 text-sm text-red">{error}</div>;
  if (!detail) return <div className="p-8 text-sm text-foreground-muted">加载中…</div>;

  return <Editor detail={detail} mode="template" />;
}
