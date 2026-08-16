import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useEditorStore } from '@/editor/store';
import { PropertyPanel } from '@/editor/property-panel';
import type { ProjectDetail } from '@mediakit/shared';

const emptyProject: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

function panel() {
  return render(
    <MemoryRouter>
      <PropertyPanel />
    </MemoryRouter>,
  );
}

function addAndSelectCard() {
  const store = useEditorStore.getState();
  store.loadProject(emptyProject, 'p');
  store.addComponent('creator-avatar-card');
  const id = store.currentComponents()[0].id;
  store.updateComponentData(id, { tier: 'micro' });
  store.select(id);
  return id;
}

describe('CreatorLinkImporter', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(emptyProject, 'p');
  });

  it('解析 TikTok 链接后写入字段，并保留 variant/tier', async () => {
    addAndSelectCard();
    panel();
    // 现行 UI:数据来源切换器,先切到 URL 模式才出现解析输入框
    await userEvent.click(screen.getByRole('button', { name: '🔗 URL' }));
    const input = screen.getByPlaceholderText('粘贴链接…');
    await userEvent.type(input, 'https://www.tiktok.com/@miaglowup');
    await userEvent.click(screen.getByRole('button', { name: '🔍 解析' }));

    await waitFor(() => {
      const comp = useEditorStore.getState().currentComponents()[0];
      expect((comp.data as { followers?: string }).followers).toBeTruthy();
    });

    const data = useEditorStore.getState().currentComponents()[0].data as unknown as Record<string, unknown>;
    expect(data.platform).toBe('tiktok');
    expect(data.tier).toBe('micro'); // 保留
    expect(data.variant).toBe('horizontal'); // 保留
    expect(typeof data.handle).toBe('string');
    expect(typeof data.likes).toBe('string');
    expect(typeof data.engagement).toBe('string');
    expect(data.sourceUrl).toBe('https://www.tiktok.com/@miaglowup');
  });

  it('不支持的平台显示错误且不动数据', async () => {
    addAndSelectCard();
    panel();
    await userEvent.click(screen.getByRole('button', { name: '🔗 URL' }));
    await userEvent.type(screen.getByPlaceholderText('粘贴链接…'), 'https://www.xiaohongshu.com/u/a');
    await userEvent.click(screen.getByRole('button', { name: '🔍 解析' }));
    expect(await screen.findByText(/解析失败/)).toBeInTheDocument();
    const data = useEditorStore.getState().currentComponents()[0].data as unknown as Record<string, unknown>;
    expect(data.followers).toBeUndefined();
  });

  it('空输入提示错误', async () => {
    addAndSelectCard();
    panel();
    await userEvent.click(screen.getByRole('button', { name: '🔗 URL' }));
    await userEvent.click(screen.getByRole('button', { name: '🔍 解析' }));
    expect(await screen.findByText('请输入 URL')).toBeInTheDocument();
  });
});
