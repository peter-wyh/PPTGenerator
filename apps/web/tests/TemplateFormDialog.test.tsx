import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateFormDialog } from '@/components/TemplateFormDialog';

describe('TemplateFormDialog — 模版类型级联', () => {
  it('未选场景时不显示模版类型;选场景后出现对应选项', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TemplateFormDialog open onSubmit={onSubmit} onCancel={() => {}} />);

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
