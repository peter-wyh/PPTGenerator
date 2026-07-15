import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '@/editor/store';
import { ReportCreatorMetaStripImporter } from '@/editor/property-panel/importers';
import type { ProjectDetail, ReportCreator } from '@mediakit/shared';

const creator: ReportCreator = {
  id: 'cre-mia',
  name: 'Mia Chen',
  platform: 'TikTok',
  tier: 'mega',
  category: 'Beauty',
  region: 'US / UK',
};

const project: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: 'Page 1', components: [], creatorId: 'cre-mia' }],
  createdAt: '',
  updatedAt: '',
};

describe('ReportCreatorMetaStripImporter — 基础信息一键填充', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(project, 'p');
    useEditorStore.getState().setReportData({ creators: [creator] });
    useEditorStore.getState().addComponent('meta-strip');
    useEditorStore.getState().select(useEditorStore.getState().currentComponents()[0].id);
  });

  it('按达人字段填充 CATEGORY / REGION / TIER 三行', async () => {
    const comp = useEditorStore.getState().currentComponents()[0];
    render(<ReportCreatorMetaStripImporter comp={comp} />);

    const user = userEvent.setup();
    const btn = await screen.findByRole('button', { name: /导入到基础信息/ });
    await user.click(btn);

    const data = useEditorStore.getState().currentComponents()[0].data as { rows?: string[][] };
    expect(data.rows).toEqual([
      ['tag', 'CATEGORY', 'Beauty'],
      ['target', 'REGION', 'US / UK'],
      ['trophy', 'TIER', 'Mega'],
    ]);
  });
});
