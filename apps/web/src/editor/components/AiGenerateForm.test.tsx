import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiGenerateForm } from './AiGenerateForm';

vi.mock('@/api/htmlTemplates', () => ({
  htmlTemplatesApi: {
    getDesignGuide: vi.fn().mockResolvedValue({
      designMd: '# brand guide',
      businessLineName: 'WANDER',
      businessLineCode: 'WD',
      guideName: 'DG 默认指南',
      guideId: 'g1',
    }),
    getSystemPrompt: vi.fn().mockResolvedValue('# SYSTEM_PROMPT\nUse exact data.'),
  },
}));
vi.mock('@/report-presets', () => ({
  getPresetsForBL: vi.fn(() => [{ label: '默认', requirement: '默认要求', description: 'd' }]),
}));

import { htmlTemplatesApi } from '@/api/htmlTemplates';

beforeEach(() => vi.clearAllMocks());

describe('AiGenerateForm', () => {
  it('渲染 mode/模板/提示词/系统提示词,且点生成触发 onGenerate({mode,prompt,designMd})', async () => {
    const onGenerate = vi.fn();
    render(<AiGenerateForm campaignId="c1" onGenerate={onGenerate} />);

    await waitFor(() => expect(htmlTemplatesApi.getDesignGuide).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect((screen.getByDisplayValue('默认要求') as HTMLTextAreaElement)).toBeTruthy());

    expect(screen.getByText('生成方式')).toBeTruthy();
    expect(screen.getByText('提示词模板')).toBeTruthy();
    expect(screen.getByText('系统提示词')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /生成报告/ }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const arg = onGenerate.mock.calls[0][0];
    expect(arg.mode).toBe('ai');
    expect(arg.prompt).toBe('默认要求');
    expect(arg.designMd).toContain('brand guide');
  });

  it('点击「系统提示词」加载并展示 SYSTEM_PROMPT', async () => {
    render(<AiGenerateForm campaignId="c1" onGenerate={() => {}} />);
    expect(htmlTemplatesApi.getSystemPrompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('系统提示词'));
    await waitFor(() => expect(htmlTemplatesApi.getSystemPrompt).toHaveBeenCalled());
  });

  it('scenario 选择器:切「月报」→ onGenerate 携带 scenario', async () => {
    const onGenerate = vi.fn();
    render(<AiGenerateForm campaignId="c1" onGenerate={onGenerate} />);
    await waitFor(() => expect(htmlTemplatesApi.getDesignGuide).toHaveBeenCalledWith('c1'));
    fireEvent.change(screen.getByDisplayValue('通用（默认指南）'), { target: { value: '月报' } });
    fireEvent.click(screen.getByRole('button', { name: /生成报告/ }));
    const arg = onGenerate.mock.calls[0][0];
    expect(arg.scenario).toBe('月报');
  });

  it('recipe 模式点生成 → onGenerate mode=recipe, prompt/designMd 为空串', async () => {
    const onGenerate = vi.fn();
    render(<AiGenerateForm campaignId="c1" onGenerate={onGenerate} />);
    await waitFor(() => expect(htmlTemplatesApi.getDesignGuide).toHaveBeenCalledWith('c1'));
    // 切到 Recipe 模板
    fireEvent.click(screen.getByRole('button', { name: /Recipe/ }));
    // 点生成
    fireEvent.click(screen.getByRole('button', { name: /生成报告/ }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const arg = onGenerate.mock.calls[0][0];
    expect(arg.mode).toBe('recipe');
    expect(arg.prompt).toBe('');
    expect(arg.designMd).toBe('');
  });
});
