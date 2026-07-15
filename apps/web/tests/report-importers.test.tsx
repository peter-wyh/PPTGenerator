import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEditorStore } from '@/editor/store';
import type { CollaborationData, CollaborationDeliverable } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/collaborations', () => ({ getCollaboration: vi.fn() }));
import { getCollaboration } from '@/api/collaborations';
import {
  ReportWorkMetricsImporter,
  ReportCommentWordcloudImporter,
  ReportWorkAudienceImporter,
  ReportCreatorWorksImporter,
  buildWorksTable,
} from '@/editor/property-panel/importers';

const emptyProject = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
} as never;

beforeEach(() => {
  useEditorStore.getState().loadProject(emptyProject, 'p');
  vi.clearAllMocks();
});

describe('ReportWorkMetricsImporter', () => {
  it('imports chosen deliverable metrics (+workName=contentType) into comp.data', async () => {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    store.addComponent('work-metrics');
    const comp = store.currentComponents()[0];
    const collab: CollaborationData = {
      id: collaborationId('camp-1', 'cre-1'),
      campaignId: 'camp-1',
      creatorId: 'cre-1',
      deliverables: [{ contentType: 'post', metrics: [{ label: '播放', value: '1.2M', color: '#f00' }] }],
    };
    vi.mocked(getCollaboration).mockResolvedValueOnce(collab);
    render(<ReportWorkMetricsImporter comp={comp} />);
    await waitFor(() => expect(screen.getByText('导入效果数据')).toBeInTheDocument());
    fireEvent.click(screen.getByText('导入效果数据'));
    const data = useEditorStore.getState().currentComponents()[0].data as {
      metrics: { label: string; value: string; color?: string }[];
      workName: string;
    };
    expect(data.metrics).toEqual([{ label: '播放', value: '1.2M', color: '#f00' }]);
    expect(data.workName).toBe('post');
  });
});

describe('ReportCommentWordcloudImporter', () => {
  it('imports chosen deliverable wordcloud into comp.data.words', async () => {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    store.addComponent('comment-wordcloud');
    const comp = store.currentComponents()[0];
    const wordCollab: CollaborationData = {
      id: collaborationId('camp-1', 'cre-1'),
      campaignId: 'camp-1',
      creatorId: 'cre-1',
      deliverables: [{ contentType: 'post', wordcloud: [{ text: '种草', weight: 80, sentiment: 'pos' }] }],
    };
    vi.mocked(getCollaboration).mockResolvedValueOnce(wordCollab);
    render(<ReportCommentWordcloudImporter comp={comp} />);
    await waitFor(() => expect(screen.getByText('导入评论词云')).toBeInTheDocument());
    fireEvent.click(screen.getByText('导入评论词云'));
    const data = useEditorStore.getState().currentComponents()[0].data as {
      words: { text: string; weight: number; sentiment: string }[];
    };
    expect(data.words).toEqual([{ text: '种草', weight: 80, sentiment: 'pos' }]);
  });
});

describe('ReportWorkAudienceImporter', () => {
  it('imports chosen deliverable audience into comp.data.audience', async () => {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    store.addComponent('creator-work-metrics');
    const comp = store.currentComponents()[0];
    const audCollab: CollaborationData = {
      id: collaborationId('camp-1', 'cre-1'),
      campaignId: 'camp-1',
      creatorId: 'cre-1',
      deliverables: [{ contentType: 'post', audience: { genderSplit: [{ label: '女', value: 70 }] } }],
    };
    vi.mocked(getCollaboration).mockResolvedValueOnce(audCollab);
    render(<ReportWorkAudienceImporter comp={comp} />);
    await waitFor(() => expect(screen.getByText('导入画像')).toBeInTheDocument());
    fireEvent.click(screen.getByText('导入画像'));
    const data = useEditorStore.getState().currentComponents()[0].data as {
      audience: { genderSplit: { label: string; value: number }[] };
    };
    expect(data.audience.genderSplit).toEqual([{ label: '女', value: 70 }]);
  });
});

describe('buildWorksTable', () => {
  const deliverables: CollaborationDeliverable[] = [
    {
      contentType: 'post',
      screenshots: [{ src: 'p.jpg' }],
      metrics: [{ label: '曝光', value: '1.2M' }, { label: '点赞', value: '86K' }],
      audience: { genderSplit: [{ label: '女', value: 70 }] },
    },
    {
      contentType: 'reels',
      screenshots: [{ src: 'r.jpg' }],
      metrics: [{ label: '曝光', value: '500K' }],
      audience: { genderSplit: [{ label: '男', value: 60 }] },
    },
  ];
  it('headers = 封面/类型 + 首个 deliverable 的 metric labels', () => {
    expect(buildWorksTable(deliverables).headers).toEqual(['封面', '类型', '曝光', '点赞']);
  });
  it('rows 每行 = 封面/类型/metric值（按 label，缺失→空），与 deliverables 同序同长', () => {
    const { rows } = buildWorksTable(deliverables);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['p.jpg', 'post', '1.2M', '86K']);
    expect(rows[1]).toEqual(['r.jpg', 'reels', '500K', '']);
  });
  it('insights 与 deliverables 同序同长，对齐 audience', () => {
    const { insights } = buildWorksTable(deliverables);
    expect(insights).toHaveLength(2);
    expect(insights[0]).toEqual({ genderSplit: [{ label: '女', value: 70 }] });
  });
  it('无 audience 的 deliverable → insights[i] = {}', () => {
    expect(buildWorksTable([{ contentType: 'post' }]).insights[0]).toEqual({});
  });
});

describe('ReportCreatorWorksImporter', () => {
  const collab: CollaborationData = {
    id: collaborationId('camp-1', 'cre-1'),
    campaignId: 'camp-1',
    creatorId: 'cre-1',
    deliverables: [
      { contentType: 'post', screenshots: [{ src: 'p.jpg' }], metrics: [{ label: '曝光', value: '1.2M' }], audience: { genderSplit: [{ label: '女', value: 70 }] } },
      { contentType: 'reels', screenshots: [{ src: 'r.jpg' }], metrics: [{ label: '曝光', value: '500K' }] },
    ],
  };

  async function setupImport(type: 'creator-works-list' | 'creator-works-table') {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    store.addComponent(type);
    const comp = store.currentComponents()[0];
    vi.mocked(getCollaboration).mockResolvedValue(collab);
    render(<ReportCreatorWorksImporter comp={comp} />);
    const btn = await screen.findByRole('button', { name: /导入作品列表/ });
    fireEvent.click(btn);
    return () =>
      useEditorStore.getState().currentComponents()[0].data as {
        headers: string[];
        rows: string[][];
        insights: { genderSplit?: { label: string; value: number }[] }[];
      };
  }

  it('creator-works-list: 写入对齐的 headers/rows/insights', async () => {
    const getData = await setupImport('creator-works-list');
    const data = getData();
    expect(data.headers).toEqual(['封面', '类型', '曝光']);
    expect(data.rows).toEqual([
      ['p.jpg', 'post', '1.2M'],
      ['r.jpg', 'reels', '500K'],
    ]);
    expect(data.insights).toHaveLength(2);
    expect(data.insights[0]?.genderSplit).toEqual([{ label: '女', value: 70 }]);
  });

  it('creator-works-table: 同样写入对齐数据', async () => {
    const getData = await setupImport('creator-works-table');
    const data = getData();
    expect(data.rows).toHaveLength(2);
    expect(data.insights).toHaveLength(2);
  });
});
