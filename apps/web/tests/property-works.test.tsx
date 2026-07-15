import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEditorStore } from '@/editor/store';
import { PropertyPanel } from '@/editor/property-panel';
import type {
  CommentWordcloudData,
  ProjectDetail,
  ReportCampaign,
  ReportCreator,
  WorkMetricsData,
  WorkScreenshotData,
} from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';
import { getCollaboration } from '@/api/collaborations';

vi.mock('@/api/collaborations', () => ({ getCollaboration: vi.fn() }));

const emptyProject: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

function setup(type: 'work-screenshot' | 'work-metrics' | 'comment-wordcloud') {
  const store = useEditorStore.getState();
  store.loadProject(emptyProject, 'p');
  store.addComponent(type);
  const id = store.currentComponents()[0].id;
  store.select(id);
  return id;
}

describe('WorkScreenshotFields', () => {
  beforeEach(() => useEditorStore.getState().loadProject(emptyProject, 'p'));

  it('renders a caption input per image + add-image button', () => {
    setup('work-screenshot');
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    expect(screen.getAllByPlaceholderText('说明').length).toBe(27); // default 27 images (camp-glowlab-q4, 10 creators)
    expect(screen.getByRole('button', { name: /添加图片/ })).toBeInTheDocument();
  });

  it('edits a caption into data.images[i].caption', () => {
    setup('work-screenshot');
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getAllByPlaceholderText('说明')[0], { target: { value: 'Best work A' } });
    const data = useEditorStore.getState().currentComponents()[0].data as WorkScreenshotData;
    expect(data.images[0].caption).toBe('Best work A');
  });

  it('mosaic 组合版式 picker writes mosaicLayout on click', () => {
    const store = useEditorStore.getState();
    store.loadProject(emptyProject, 'p');
    store.addComponent('work-screenshot');
    const id = store.currentComponents()[0].id;
    store.select(id);
    store.updateComponentData(id, { style: 'mosaic' });
    store.commit();

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    const btn = screen.getByRole('button', { name: '1大3小' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    const data = useEditorStore.getState().currentComponents()[0].data as WorkScreenshotData;
    expect(data.mosaicLayout).toBe('hero-4');
  });

  it('mosaic 组合版式 disables layouts when too few images', () => {
    const store = useEditorStore.getState();
    store.loadProject(emptyProject, 'p');
    store.addComponent('work-screenshot');
    const id = store.currentComponents()[0].id;
    store.select(id);
    store.updateComponentData(id, { style: 'mosaic', images: [{ src: 'a' }, { src: 'b' }] });
    store.commit();

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    // 仅 2 张：1大3小(需4)、九宫格(需9) 应禁用；自动(需1) 可用
    expect(screen.getByRole('button', { name: '1大3小' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '九宫格' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '自动' })).not.toBeDisabled();
  });

  it('mosaic 组合版式 shows the 2大4小 and 阶梯 options when enough images', () => {
    const store = useEditorStore.getState();
    store.loadProject(emptyProject, 'p');
    store.addComponent('work-screenshot');
    const id = store.currentComponents()[0].id;
    store.select(id);
    store.updateComponentData(id, { style: 'mosaic' });
    store.commit();

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    // 默认 27 张 → 2大4小(需6)、阶梯(需7) 均可用
    expect(screen.getByRole('button', { name: '2大4小' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '阶梯' })).not.toBeDisabled();
  });

  it('imports screenshots from a bound collaboration deliverable', async () => {
    vi.mocked(getCollaboration).mockResolvedValue({
      id: collaborationId('camp-glowlab-q4', 'cre-mia'),
      campaignId: 'camp-glowlab-q4',
      creatorId: 'cre-mia',
      deliverables: [{ contentType: 'post', screenshots: [{ src: 'shot-1.jpg' }, { src: 'shot-2.jpg' }] }],
    });

    const store = useEditorStore.getState();
    store.loadProject(emptyProject, 'p');
    store.setReportData({
      campaign: { id: 'camp-glowlab-q4', name: 'GlowLab Q4' } as unknown as ReportCampaign,
      creators: [
        { id: 'cre-mia', name: 'Mia', platform: 'tiktok', handle: '@mia' },
      ] as ReportCreator[],
    });
    store.addComponent('work-screenshot');
    const id = store.currentComponents()[0].id;
    store.select(id);
    store.updateComponentData(id, { images: [] });
    store.commit();

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    const importBtn = await screen.findByRole('button', { name: '导入截图' });
    fireEvent.click(importBtn);

    await waitFor(() => {
      const data = useEditorStore.getState().currentComponents()[0].data as WorkScreenshotData;
      expect(data.images).toEqual([{ src: 'shot-1.jpg' }, { src: 'shot-2.jpg' }]);
    });
  });
});

describe('WorkMetricsFields', () => {
  beforeEach(() => useEditorStore.getState().loadProject(emptyProject, 'p'));

  it('renders a value input per metric + add-metric button', () => {
    setup('work-metrics');
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    expect(screen.getAllByPlaceholderText('数值').length).toBe(6); // 默认 6 指标
    expect(screen.getByRole('button', { name: /添加指标/ })).toBeInTheDocument();
  });

  it('edits a metric value into data.metrics[i].value', () => {
    setup('work-metrics');
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getAllByPlaceholderText('数值')[0], { target: { value: '2.5M' } });
    const data = useEditorStore.getState().currentComponents()[0].data as WorkMetricsData;
    expect(data.metrics[0].value).toBe('2.5M');
  });
});

describe('CommentWordcloudFields', () => {
  beforeEach(() => useEditorStore.getState().loadProject(emptyProject, 'p'));

  it('renders a word input per word + add-word button', () => {
    setup('comment-wordcloud');
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    expect(screen.getAllByPlaceholderText('词').length).toBe(8); // 默认 8 词
    expect(screen.getByRole('button', { name: /添加词/ })).toBeInTheDocument();
  });

  it('edits a word text into data.words[i].text', () => {
    setup('comment-wordcloud');
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getAllByPlaceholderText('词')[0], { target: { value: '神仙' } });
    const data = useEditorStore.getState().currentComponents()[0].data as CommentWordcloudData;
    expect(data.words[0].text).toBe('神仙');
  });
});
