import { useEffect, useState } from 'react';
import type { CollaborationDeliverable } from '@mediakit/shared';
import { useEditorStore, allReportCreators } from '@/editor/store';
import { getCollaboration } from '@/api/collaborations';
import { FieldGroup } from './helpers';

/**
 * 通用「从达人合作导入」UI：选 creator → 拉 getCollaboration → 选 contentType → 回调该 deliverable。
 * 无战役/无达人/无合作记录各有空态。creator 优先取页面绑定达人，否则取 reportData 第一个。
 */
export function DeliverablePicker({
  pickLabel,
  onPick,
}: {
  pickLabel: string;
  onPick: (d: CollaborationDeliverable) => void;
}) {
  const campaign = useEditorStore((s) => s.reportData.campaign);
  const pageCreatorId = useEditorStore((s) => {
    const p = s.pages.find((pg) => pg.id === s.currentPageId);
    return p?.creatorId;
  });
  const creators = allReportCreators(useEditorStore((s) => s.reportData));
  const campaignId = campaign?.id ?? '';

  const [creatorId, setCreatorId] = useState(pageCreatorId ?? creators[0]?.id ?? '');
  const [deliverables, setDeliverables] = useState<CollaborationDeliverable[] | null>(null); // null=加载中
  const [contentType, setContentType] = useState('');

  useEffect(() => {
    setContentType('');
    if (!campaignId || !creatorId) {
      setDeliverables([]);
      return;
    }
    let alive = true;
    setDeliverables(null);
    getCollaboration(campaignId, creatorId).then((c) => {
      if (!alive) return;
      const ds = c?.deliverables ?? [];
      setDeliverables(ds);
      const firstType = ds[0]?.contentType ?? '';
      setContentType(firstType);
      // 自动导入：换达人时自动选中第一个作品并触发 onPick
      if (firstType) {
        const chosen = ds.find((d) => d.contentType === firstType);
        if (chosen) onPick(chosen);
      }
    });
    return () => {
      alive = false;
    };
  }, [campaignId, creatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!campaignId) {
    return (
      <FieldGroup title="从达人合作导入">
        <p className="text-xs text-foreground-muted">先在「数据配置」选择战役。</p>
      </FieldGroup>
    );
  }
  if (creators.length === 0) {
    return (
      <FieldGroup title="从达人合作导入">
        <p className="text-xs text-foreground-muted">请先在「数据配置」选择达人。</p>
      </FieldGroup>
    );
  }

  const chosen = (deliverables ?? []).find((d) => d.contentType === contentType);

  return (
    <FieldGroup title="从达人合作导入">
      <select
        value={creatorId}
        onChange={(e) => setCreatorId(e.target.value)}
        className="w-full rounded border border-border-default px-1.5 py-1 text-xs"
      >
        {creators.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {deliverables === null ? (
        <p className="text-xs text-foreground-muted">加载…</p>
      ) : deliverables.length === 0 ? (
        <p className="text-xs text-foreground-muted">该达人暂无合作数据。先在「数据管理」录入或「导入演示数据」。</p>
      ) : (
        <>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="w-full rounded border border-border-default px-1.5 py-1 text-xs"
          >
            {deliverables.map((d) => (
              <option key={d.contentType} value={d.contentType}>{d.contentType}</option>
            ))}
          </select>
          <button
            onClick={() => chosen && onPick(chosen)}
            disabled={!chosen}
            className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
          >
            {pickLabel}
          </button>
        </>
      )}
    </FieldGroup>
  );
}
