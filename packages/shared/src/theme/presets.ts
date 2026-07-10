/**
 * 主题运行时常量：预置字体清单、默认图表配色、默认主题、风格预设、达人指标库。
 * 类型来自 ../types/theme。
 */
import type { FontOption, ProjectTheme, StylePreset } from '../types/theme';

/** 预置字体清单。 */
export const FONT_OPTIONS: FontOption[] = [
  {
    key: 'noto-sans-sc',
    label: '思源黑体',
    category: 'text',
    stack: "'Noto Sans SC', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
  },
  {
    key: 'inter',
    label: 'Inter',
    category: 'number',
    stack: "'Inter', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  },
  {
    key: 'funnel-sans',
    label: 'Funnel Sans',
    category: 'heading',
    stack: "'Funnel Sans', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Funnel+Sans:wght@400;700;800&display=swap',
  },
  {
    key: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    category: 'text',
    stack: "'IBM Plex Sans', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap',
  },
  {
    key: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    category: 'number',
    stack: "'IBM Plex Mono', monospace",
    loadUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    category: 'number',
    stack: "'Roboto', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  },
  {
    key: 'noto-serif-sc',
    label: '思源宋体',
    category: 'heading',
    stack: "'Noto Serif SC', serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap',
  },
];

/** 默认图表配色（6 色）。 */
export const DEFAULT_CHART_PALETTE = [
  '#FF5C00',
  '#3B82F6',
  '#22C55E',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
];

/** 默认主题：与原硬编码值对齐（ACCENT=#FF5C00, INK=#1A1A1A, Inter）。 */
export const DEFAULT_THEME: ProjectTheme = {
  color: {
    primary: '#FF5C00',
    secondary: '#FF8533',
    chartPalette: [...DEFAULT_CHART_PALETTE],
    neutralText: '#1A1A1A',
    neutralBg: '#FFFFFF',
  },
  font: {
    text: 'noto-sans-sc',
    number: 'inter',
    heading: undefined,
  },
  density: 'standard',
  radius: 'small',
  layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },
  branding: {
    logo: '',
    title: '',
    subtitle: '',
    logoHeight: 32,
    logoRadius: 0,
  },
  background: { type: 'none' },
  preset: 'business-sober',
};

/** 整体风格预设清单（8 个）。 */
export const STYLE_PRESETS: StylePreset[] = [
  {
    key: 'business-sober',
    name: '商务沉稳',
    description: '橙色主品牌色 + 思源黑体 + 标准密度',
    theme: {
      color: {
        primary: '#FF5C00',
        secondary: '#FF8533',
        chartPalette: ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EC4899'],
        neutralText: '#1A1A1A',
        neutralBg: '#FFFFFF',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: undefined },
      density: 'standard',
      radius: 'small',
      layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },
      preset: 'business-sober',
    },
  },
  {
    key: 'tech-minimal',
    name: '科技简约',
    description: '蓝色主品牌色 + Inter/IBM Plex Mono + 紧凑密度',
    theme: {
      color: {
        primary: '#2563EB',
        secondary: '#60A5FA',
        chartPalette: ['#2563EB', '#06B6D4', '#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B'],
        neutralText: '#0F172A',
        neutralBg: '#F8FAFC',
      },
      font: { text: 'inter', number: 'ibm-plex-mono', heading: 'inter' },
      density: 'compact',
      radius: 'sharp',
      layout: { safeMargin: 40, gridSize: 8, showGrid: true, showSafeArea: true },
      preset: 'tech-minimal',
    },
  },
  {
    key: 'vibrant-trendy',
    name: '活力潮流',
    description: '粉红主品牌色 + Funnel Sans + 宽松密度',
    theme: {
      color: {
        primary: '#EC4899',
        secondary: '#F472B6',
        chartPalette: ['#EC4899', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6', '#06B6D4'],
        neutralText: '#1A1A1A',
        neutralBg: '#FFFFFF',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: 'funnel-sans' },
      density: 'spacious',
      radius: 'large',
      layout: { safeMargin: 64, gridSize: 12, showGrid: true, showSafeArea: true },
      preset: 'vibrant-trendy',
    },
  },
  {
    key: 'minimal-elegant',
    name: '极简素雅',
    description: '深灰主品牌色 + 思源黑体/思源宋体 + 标准密度',
    theme: {
      color: {
        primary: '#1A1A1A',
        secondary: '#6B7280',
        chartPalette: ['#1A1A1A', '#6B7280', '#9CA3AF', '#D1D5DB', '#374151', '#4B5563'],
        neutralText: '#1A1A1A',
        neutralBg: '#FAFAFA',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: 'noto-serif-sc' },
      density: 'standard',
      radius: 'small',
      layout: { safeMargin: 56, gridSize: 10, showGrid: true, showSafeArea: true },
      preset: 'minimal-elegant',
    },
  },
  {
    key: 'affiliate-bold',
    name: '联盟带货',
    description: '紫蓝霓虹高对比 + 圆角发光卡片，联盟营销报告风格',
    theme: {
      color: {
        primary: '#6366F1',
        secondary: '#8B5CF6',
        chartPalette: ['#6366F1', '#8B5CF6', '#3B82F6', '#EC4899', '#F59E0B', '#22D3EE'],
        neutralText: '#FFFFFF',
        neutralBg: '#0F0B2E',
      },
      font: { text: 'inter', number: 'ibm-plex-mono', heading: 'funnel-sans' },
      density: 'spacious',
      radius: 'large',
      layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },
      preset: 'affiliate-bold',
    },
  },
  {
    key: 'magazine-editorial',
    name: '杂志编辑',
    description: '高对比黑白 + 思源宋体大标题 + 红色强调，杂志编辑风格',
    theme: {
      color: {
        primary: '#DC2626',
        secondary: '#1A1A1A',
        chartPalette: ['#1A1A1A', '#DC2626', '#6B7280', '#9CA3AF', '#374151', '#D1D5DB'],
        neutralText: '#1A1A1A',
        neutralBg: '#FFFFFF',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: 'noto-serif-sc' },
      density: 'spacious',
      radius: 'sharp',
      layout: { safeMargin: 64, gridSize: 12, showGrid: true, showSafeArea: true },
      preset: 'magazine-editorial',
    },
  },
  {
    key: 'dark-dashboard',
    name: '暗色看板',
    description: '深色背景 + 青绿数据色 + 等宽数字，数据看板风格',
    theme: {
      color: {
        primary: '#00D9A3',
        secondary: '#0F3460',
        chartPalette: ['#00D9A3', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#22D3EE'],
        neutralText: '#E5E7EB',
        neutralBg: '#1A1A2E',
      },
      font: { text: 'inter', number: 'ibm-plex-mono', heading: 'inter' },
      density: 'compact',
      radius: 'small',
      layout: { safeMargin: 40, gridSize: 8, showGrid: true, showSafeArea: true },
      preset: 'dark-dashboard',
    },
  },
  {
    key: 'playful-pastel',
    name: '粉彩活力',
    description: '柔和粉彩背景 + 圆润大圆角，活泼亲和风格',
    theme: {
      color: {
        primary: '#EC4899',
        secondary: '#8B5CF6',
        chartPalette: ['#F472B6', '#A78BFA', '#6EE7B7', '#FBBF24', '#60A5FA', '#FCA5A5'],
        neutralText: '#3B0764',
        neutralBg: '#FFF8F0',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: 'funnel-sans' },
      density: 'spacious',
      radius: 'large',
      layout: { safeMargin: 56, gridSize: 12, showGrid: true, showSafeArea: true },
      preset: 'playful-pastel',
    },
  },
];

/** 常用达人指标库（属性面板勾选筛选用）。 */
export const CREATOR_METRIC_CATALOG: {
  key: string;
  label: string;
  color: string;
  placeholder: string;
}[] = [
  { key: 'followers', label: 'Followers', color: '#FF5C00', placeholder: '1.28M' },
  { key: 'engagement', label: 'Engagement Rate', color: '#3B82F6', placeholder: '8.7%' },
  { key: 'reach', label: 'Avg. Reach', color: '#22C55E', placeholder: '640K' },
  { key: 'impressions', label: 'Impressions', color: '#8B5CF6', placeholder: '12.6M' },
  { key: 'cpm', label: 'CPM', color: '#EC4899', placeholder: '¥120' },
  { key: 'cpe', label: 'CPE', color: '#14B8A6', placeholder: '¥3.2' },
  { key: 'completion', label: 'Completion Rate', color: '#F59E0B', placeholder: '42%' },
  { key: 'growth', label: 'Follower Growth', color: '#6366F1', placeholder: '+38K' },
];
