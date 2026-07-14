import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore, allReportCreators } from '@/editor/store';
import { ReportCreatorAvatarImporter } from '@/editor/property-panel/importers';
import type { ProjectDetail, ReportCreator, ReportDataContext } from '@mediakit/shared';

/**
 * 回归：从「项目关联达人」一键填充头像卡时，avatar 必须带入。
 * 历史 bug：ReportCreatorAvatarImporter.apply() 漏映射 avatar，
 * 且上游 Creator → ReportCreator 链路也未携带 avatar，导致导入的达人无头像。
 */
const AVATAR = 'https://example.com/mia.png';
const creator: ReportCreator = {
  id: 'cre-mia',
  name: 'Mia Chen',
  platform: 'TikTok',
  tier: 'mega',
  avatar: AVATAR,
};

const project: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  // 页面绑定该达人 → 导入器自动预选，无需手动下拉
  pages: [{ id: 'pg', name: 'Page 1', components: [], creatorId: 'cre-mia' }],
  createdAt: '',
  updatedAt: '',
};

describe('ReportCreatorAvatarImporter — 头像卡一键填充', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(project, 'p');
    useEditorStore.getState().setReportData({ creators: [creator] });
    useEditorStore.getState().addComponent('creator-avatar-card');
    useEditorStore.getState().select(useEditorStore.getState().currentComponents()[0].id);
  });

  it('填充时把 avatar 一并写入头像卡', async () => {
    const comp = useEditorStore.getState().currentComponents()[0];
    // 绑定达人页 → 新增组件即被页面绑定级联填充，avatar 已带入
    expect((comp.data as { avatar?: string }).avatar).toBe(AVATAR);

    render(<ReportCreatorAvatarImporter comp={comp} />);

    const user = userEvent.setup();
    const btn = await screen.findByRole('button', { name: /导入到头像卡/ });
    await user.click(btn);

    const data = useEditorStore.getState().currentComponents()[0].data as { avatar?: string; name?: string };
    expect(data.avatar).toBe(AVATAR);
    expect(data.name).toBe('Mia Chen');
  });
});

describe('allReportCreators — 旧数据头像回填', () => {
  it('缺 avatar 的达人（修复前持久化的旧项目）按 name 回填 picsum 头像', () => {
    const rd: ReportDataContext = {
      creators: [{ id: 'cre-old', name: 'Old Creator', platform: 'TikTok', tier: 'macro' }],
    };
    const [c] = allReportCreators(rd);
    expect(c.avatar).toMatch(/^https:\/\/picsum\.photos\//);
  });

  it('已有 avatar 的达人保持不变（不覆盖）', () => {
    const rd: ReportDataContext = {
      creators: [{ id: 'cre-x', name: 'X', avatar: 'https://example.com/x.png', platform: 'TikTok', tier: 'macro' }],
    };
    expect(allReportCreators(rd)[0].avatar).toBe('https://example.com/x.png');
  });
});
