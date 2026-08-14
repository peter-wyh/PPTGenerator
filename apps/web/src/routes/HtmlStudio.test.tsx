import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ── mock 路由 hooks（避免 MemoryRouter 包裹） ──
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'p1' }), useNavigate: () => vi.fn() };
});

// ── mock API：projects（默认带业务线/广告主/周期） ──
// NOTE: vi.mock 工厂被提升到文件顶部，fullProject 必须定义在工厂内部，否则 TDZ 报错。
vi.mock('@/api/projects', () => {
  const fullProject = {
    id: 'p1',
    name: '季度复盘',
    width: 1920,
    height: 1080,
    pages: [],
    meta: {
      businessLine: 'DG',
      advertiser: '花西子',
      scenarioSub: 'monthly',
      reportPeriod: { month: '2026-08', startDate: '2026-08-01', endDate: '2026-08-31' },
    },
  };
  return {
    projectsApi: {
      get: vi.fn().mockResolvedValue(fullProject),
      getHtml: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(fullProject),
    },
  };
});

// ── mock API：html-templates（无版本 → AI 模式，不进 RecipeEditor） ──
vi.mock('@/api/htmlTemplates', () => ({
  htmlTemplatesApi: {
    listHtmlVersions: vi.fn().mockResolvedValue([]),
    getHtmlVersion: vi.fn().mockResolvedValue(null),
  },
}));

// ── mock 重子组件，隔离表头行为 ──
vi.mock('@/editor/components/AiGenerateForm', () => ({
  AiGenerateForm: () => <div data-testid="ai-form" />,
}));

// ── mock toast ──
vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { projectsApi } from '@/api/projects';
import { HtmlStudio } from './HtmlStudio';

beforeEach(() => vi.clearAllMocks());

describe('HtmlStudio 表头基础信息', () => {
  it('从 meta 透出 业务线/广告主/周期 标签', async () => {
    render(<HtmlStudio />);
    await waitFor(() => expect(projectsApi.get).toHaveBeenCalledWith('p1'));
    expect(screen.getByText('DG')).toBeTruthy();
    expect(screen.getByText('花西子')).toBeTruthy();
    expect(screen.getByText('2026年8月')).toBeTruthy();
  });

  it('meta 缺字段时不渲染对应标签', async () => {
    (projectsApi.get as unknown as Mock).mockResolvedValueOnce({
      id: 'p1',
      name: '空报告',
      width: 1920,
      height: 1080,
      pages: [],
      meta: {},
    });
    render(<HtmlStudio />);
    await waitFor(() => expect(projectsApi.get).toHaveBeenCalled());
    expect(screen.queryByText('DG')).toBeNull();
    expect(screen.queryByText('花西子')).toBeNull();
    expect(screen.queryByText('2026年8月')).toBeNull();
  });
});
