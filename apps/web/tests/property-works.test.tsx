import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEditorStore } from '@/editor/store';
import { PropertyPanel } from '@/editor/PropertyPanel';
import type {
  CommentWordcloudData,
  ProjectDetail,
  WorkMetricsData,
  WorkScreenshotData,
} from '@mediakit/shared';

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
    expect(screen.getAllByPlaceholderText('说明').length).toBe(3); // 默认 3 张
    expect(screen.getByRole('button', { name: /添加图片/ })).toBeInTheDocument();
  });

  it('edits a caption into data.images[i].caption', () => {
    setup('work-screenshot');
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getAllByPlaceholderText('说明')[0], { target: { value: '代表作 A' } });
    const data = useEditorStore.getState().currentComponents()[0].data as WorkScreenshotData;
    expect(data.images[0].caption).toBe('代表作 A');
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
