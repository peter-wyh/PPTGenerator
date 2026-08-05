import { useState } from 'react';
import { useEditorStore } from '../../store';
import { lookupApi } from '@/api/lookup';
import type { EditorComponent, PageHeaderData } from '@mediakit/shared';

interface Props {
  comp: EditorComponent;
}

export function PageHeaderSyncButton({ comp }: Props) {
  const [loading, setLoading] = useState(false);
  const projectMeta = useEditorStore((s) => s.projectMeta);
  const blCode = projectMeta?.businessLine;

  if (!blCode) return null;

  const sync = async () => {
    setLoading(true);
    try {
      // 获取所有业务线，找到匹配 code 的
      const allBL = await lookupApi.listBusinessLines();
      const bl = allBL.find((b) => b.code === blCode);
      if (!bl) {
        alert(`未找到业务线 "${blCode}"，请先在数据管理中创建`);
        return;
      }

      // 获取该业务线下的广告主
      const advertisers = await lookupApi.listAdvertisers({ businessLineId: bl.id });
      const firstAdv = advertisers[0];

      const state = useEditorStore.getState();
      const { pages, currentPageId } = state;
      if (!currentPageId) return;
      const page = pages.find((p) => p.id === currentPageId);
      if (!page) return;

      const target = page.components.find((c) => c.id === comp.id);
      if (!target) return;

      const data = { ...(target.data as PageHeaderData) };
      // 右侧 = 业务线
      data.rightLogo = {
        src: bl.logo || '',
        text: bl.name,
        initials: bl.code,
      };
      // 左侧 = 第一个广告主（如果有）
      if (firstAdv) {
        data.leftLogo = {
          src: firstAdv.logo || '',
          text: firstAdv.name,
          initials: firstAdv.name.slice(0, 2).toUpperCase(),
        };
      }
      state.updateComponent(comp.id, { data });
    } catch (err) {
      console.error('Sync page-header failed:', err);
      alert('同步失败，请检查网络或数据管理配置');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={sync}
      disabled={loading}
      className="w-full rounded-lg border border-accent-primary/40 bg-accent-primary/5 px-3 py-2 text-xs font-medium text-accent-primary hover:bg-accent-primary/10 disabled:opacity-50"
    >
      {loading ? '⏳ 同步中…' : '🔄 从数据管理同步品牌 Logo'}
    </button>
  );
}
