import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecipeEditor } from '@/editor/components/recipe-editor/RecipeEditor';
import { htmlTemplatesApi } from '@/api/htmlTemplates';

vi.mock('@/api/htmlTemplates', () => ({
  htmlTemplatesApi: {
    reRender: vi.fn().mockResolvedValue('<html><body>rendered</body></html>'),
    saveRecipeConfig: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

describe('RecipeEditor · 风格层', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('改主色 → debounce 后调 reRender(tokenOverrides 含 brandPrimary)', async () => {
    render(
      <RecipeEditor
        versionId="v1"
        recipeId="campaign-report"
        campaignId="camp-everyday-bf"
        reportContent={{}}
        tokenOverrides={{}}
        manifestOverrides={{}}
      />,
    );

    // 主色输入框(aria-label="主色")改值
    fireEvent.change(screen.getByLabelText('主色'), {
      target: { value: '#3b82f6' },
    });

    // debounce(500ms)后 reRender 应被调用,且 tokenOverrides 含 brandPrimary
    await waitFor(() => {
      expect(htmlTemplatesApi.reRender).toHaveBeenCalled();
    });
    const lastCall = (htmlTemplatesApi.reRender as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(lastCall?.tokenOverrides).toMatchObject({ brandPrimary: '#3b82f6' });
  });
});

describe('RecipeEditor · 结构层', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('勾选「隐藏趋势图」→ manifest.hidden 含 trend', async () => {
    render(
      <RecipeEditor
        versionId="v1"
        recipeId="campaign-report"
        campaignId="camp-everyday-bf"
        reportContent={{}}
        tokenOverrides={{}}
        manifestOverrides={{}}
      />,
    );

    // StructurePanel 里 trend 的 checkbox(aria-label="显示 趋势")
    fireEvent.click(screen.getByLabelText('显示 趋势'));

    await waitFor(() => {
      expect(htmlTemplatesApi.reRender).toHaveBeenCalled();
    });
    const lastCall = (htmlTemplatesApi.reRender as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(lastCall?.manifestOverrides?.hidden).toContain('trend');
  });
});

describe('RecipeEditor · 保存', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('点保存 → 调 saveRecipeConfig(versionId, cfg)', async () => {
    const onSaved = vi.fn();
    render(
      <RecipeEditor
        versionId="v9"
        recipeId="campaign-report"
        campaignId="camp-everyday-bf"
        reportContent={{ header: { brand: { name: 'X' } } }}
        tokenOverrides={{ brandPrimary: '#fff' }}
        manifestOverrides={{ hidden: ['kpi'] }}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByText(/保存/));
    await waitFor(() => {
      expect(htmlTemplatesApi.saveRecipeConfig).toHaveBeenCalledWith(
        'v9',
        expect.objectContaining({
          tokenOverrides: { brandPrimary: '#fff' },
          manifestOverrides: { hidden: ['kpi'] },
        }),
      );
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
