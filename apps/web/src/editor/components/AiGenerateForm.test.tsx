import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiGenerateForm } from './AiGenerateForm';

vi.mock('@/api/htmlTemplates', () => ({
  htmlTemplatesApi: {
    getModuleCoverage: vi.fn().mockResolvedValue({
      requested: { start: '2026-07-01', end: '2026-07-31' },
      modules: [
        { key: 'dailyTrend', label: '核心趋势', status: 'ok', detail: '31 天' },
        { key: 'topProducts', label: '热销商品', status: 'missing', detail: '缺订单行项目' },
      ],
    }),
    getDesignGuide: vi.fn().mockResolvedValue({
      designMd: '# brand guide',
      businessLineName: 'WANDER',
      businessLineCode: 'WD',
      guideName: 'DG 默认指南',
      guideId: 'g1',
    }),
    getStructuralGuides: vi.fn().mockResolvedValue([
      { id: 'g1', name: 'campaign-report 结构指南', updatedAt: '2026-08-27' },
      { id: 'g2', name: '月报结构指南', updatedAt: '2026-08-27' },
    ]),
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

    await waitFor(() => expect(htmlTemplatesApi.getDesignGuide).toHaveBeenCalledWith('c1', undefined));
    await waitFor(() => expect((screen.getByDisplayValue('默认要求') as HTMLTextAreaElement)).toBeTruthy());

    expect(screen.getByText('生成方式')).toBeTruthy();
    expect(screen.getByText('用户提示词')).toBeTruthy();
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

  it('结构指南选择器:切「月报结构指南」→ onGenerate 携带 guideId', async () => {
    const onGenerate = vi.fn();
    render(<AiGenerateForm campaignId="c1" onGenerate={onGenerate} />);
    await waitFor(() => expect(htmlTemplatesApi.getDesignGuide).toHaveBeenCalledWith('c1', undefined));
    // 展开指南折叠面板（结构指南下拉在面板内;默认不叠加）
    fireEvent.click(screen.getByText('业务线指南'));
    fireEvent.change(screen.getByDisplayValue('不叠加（仅视觉规范）'), { target: { value: 'g2' } });
    fireEvent.click(screen.getByRole('button', { name: /生成报告/ }));
    const arg = onGenerate.mock.calls[0][0];
    expect(arg.guideId).toBe('g2');
  });

  it('recipe 模式点生成 → onGenerate mode=recipe, prompt/designMd 为空串', async () => {
    const onGenerate = vi.fn();
    render(<AiGenerateForm campaignId="c1" onGenerate={onGenerate} />);
    await waitFor(() => expect(htmlTemplatesApi.getDesignGuide).toHaveBeenCalledWith('c1', undefined));
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
