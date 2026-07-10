import { describe, it, expect } from 'vitest';

/**
 * PropertyPanel 拆分后的模块完整性 smoke test。
 * 确认各子模块导出的函数/组件可被正常 import，无循环依赖或缺失导出。
 */

describe('property-panel 模块拆分', () => {
  it('helpers 导出 readValue / useDataUpdate / VariantSelector / FieldGroup / withAt', async () => {
    const mod = await import('@/editor/property-panel/helpers');
    expect(typeof mod.readValue).toBe('function');
    expect(typeof mod.useDataUpdate).toBe('function');
    expect(typeof mod.VariantSelector).toBe('function');
    expect(typeof mod.FieldGroup).toBe('function');
    expect(typeof mod.withAt).toBe('function');
  });

  it('constants 导出 LABELS / GRADIENT_ANGLE_PRESETS / SHAPE_OPTIONS / ALIGN_BUTTONS', async () => {
    const mod = await import('@/editor/property-panel/constants');
    expect(mod.LABELS).toBeDefined();
    expect(Array.isArray(mod.GRADIENT_ANGLE_PRESETS)).toBe(true);
    expect(Array.isArray(mod.SHAPE_OPTIONS)).toBe(true);
    expect(Array.isArray(mod.ALIGN_BUTTONS)).toBe(true);
  });

  it('fields 导出通用字段组件', async () => {
    const mod = await import('@/editor/property-panel/fields');
    expect(typeof mod.NumberField).toBe('function');
    expect(typeof mod.FieldEditor).toBe('function');
    expect(typeof mod.TableField).toBe('function');
    expect(typeof mod.TableCellIconPicker).toBe('function');
  });

  it('custom-fields 导出自定义面板组件', async () => {
    const mod = await import('@/editor/property-panel/custom-fields');
    expect(typeof mod.BusinessFields).toBe('function');
    expect(typeof mod.KpiBoardFields).toBe('function');
    expect(typeof mod.ShapeFields).toBe('function');
    expect(typeof mod.CommentWordcloudFields).toBe('function');
    expect(typeof mod.WorkScreenshotFields).toBe('function');
    expect(typeof mod.WorkMetricsFields).toBe('function');
    expect(typeof mod.StrategyBlockFields).toBe('function');
    expect(typeof mod.ImageGroupFields).toBe('function');
    expect(typeof mod.CreatorStatsFields).toBe('function');
  });

  it('importers 导出导入器组件', async () => {
    const mod = await import('@/editor/property-panel/importers');
    expect(typeof mod.ChartImportButton).toBe('function');
    expect(typeof mod.KpiImportButton).toBe('function');
    expect(typeof mod.ImportCampaignButton).toBe('function');
    expect(typeof mod.CreatorLinkImporter).toBe('function');
    expect(typeof mod.ReportWorkScreenshotImporter).toBe('function');
    expect(typeof mod.ReportCreatorAvatarImporter).toBe('function');
    expect(typeof mod.ReportCreatorStatsImporter).toBe('function');
    expect(typeof mod.ReportCreatorListImporter).toBe('function');
    expect(typeof mod.ReportCreatorWorksImporter).toBe('function');
  });

  it('PropertyPanel 主组件可导入', async () => {
    const mod = await import('@/editor/property-panel/PropertyPanel');
    expect(typeof mod.PropertyPanel).toBe('function');
  });

  it('index barrel 导出 PropertyPanel', async () => {
    const mod = await import('@/editor/property-panel');
    expect(typeof mod.PropertyPanel).toBe('function');
  });
});
