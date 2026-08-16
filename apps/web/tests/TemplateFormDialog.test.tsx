import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateFormDialog } from '@/components/TemplateFormDialog';

// 业务线列表来自数据库(lookupApi),测试环境 mock
vi.mock('@/api/lookup', () => ({
  lookupApi: {
    listBusinessLines: vi.fn().mockResolvedValue([
      { id: 'bl-ft', code: 'FT', name: 'Fanstoshop' },
      { id: 'bl-sm', code: 'SM', name: 'SmileKOLs' },
    ]),
    listAdvertisers: vi.fn().mockResolvedValue([]),
    listMerchants: vi.fn().mockResolvedValue([]),
  },
}));

describe('TemplateFormDialog — 模版类型级联', () => {
  it('未选场景时不显示模版类型;选场景后出现对应选项', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TemplateFormDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    // P1-15: 渲染类型为第一步,选定后其余配置才展示
    await user.click(screen.getByText('多页 PPT'));
    expect(screen.queryByText('模版类型')).not.toBeTruthy();
    await user.selectOptions(screen.getByLabelText('场景'), 'media-kit');
    expect(screen.getByText('模版类型')).toBeInTheDocument();
    expect(screen.getByText('品牌版')).toBeInTheDocument();
  });

  it('提交时 meta 带 templateType', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TemplateFormDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('模板名称'), '周报模板');
    await user.click(screen.getByText('多页 PPT'));
    await user.selectOptions(screen.getByLabelText('业务线'), 'FT');
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    await user.selectOptions(screen.getByLabelText('模版类型'), 'monthly');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0][0];
    expect(values.meta.templateType).toBe('monthly');
    expect(values.meta.scenario).toBe('campaign-report');
  });

  it('切换场景后模版类型重置(不残留旧值)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TemplateFormDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('模板名称'), 'T');
    await user.click(screen.getByText('多页 PPT'));
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    await user.selectOptions(screen.getByLabelText('模版类型'), 'monthly'); // campaign-report 的值
    // 切到 media-kit:monthly 对 media-kit 无效,应被重置
    await user.selectOptions(screen.getByLabelText('场景'), 'media-kit');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0][0];
    expect(values.meta.scenario).toBe('media-kit');
    expect(values.meta.templateType).toBeUndefined(); // 不残留 'monthly'
  });
});
