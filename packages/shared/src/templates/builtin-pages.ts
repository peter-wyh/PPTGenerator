/**
 * 内置模版的真实页面树（前后端共享）。
 *
 * 用于 `templates.service.defaultTemplatePages()`（服务端）和需要
 * 「真实初始页面」的前端入口。返回一个包含真实组件（标题文本 +
 * 背景色 + 占位文本块）的最简页面树，而非单空白页，以便新模版/
 * 项目落地后即可见可编辑。
 *
 * 设计取舍：
 * - ID 生成交给调用方注入（idGenerator），避免 shared 包依赖 node:crypto
 *   或浏览器 crypto；前后端各自传 randomUUID 实现即可。
 * - 组件数据保持类型安全：使用 ComponentData 联合的合法成员。
 */
import type { EditorComponent } from '../types/editor';
import type { Page } from '../types/page';

/** ID 生成器契约：返回唯一字符串。 */
export type IdGenerator = () => string;

/**
 * 默认 ID 生成器：优先 crypto.randomUUID，降级到时间戳+随机。
 * 前端 / 服务端（Node ≥ 14.17 内置 globalThis.crypto）均可直接使用。
 */
export const defaultIdGenerator: IdGenerator = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * 构造内置模版的真实默认页面树。
 *
 * 当前返回 2 页：
 * 1. 封面页：浅灰背景 + 大标题 + 副标题（pageType=cover）
 * 2. 内容页：数据概览骨架，含标题 + 占位文本（pageType=overview）
 *
 * @param idGen 可选 ID 生成器；缺省用 defaultIdGenerator。
 */
export function builtinDefaultPages(idGen: IdGenerator = defaultIdGenerator): Page[] {
  const coverTitle: EditorComponent = {
    id: idGen(),
    type: 'text',
    x: 120,
    y: 240,
    w: 1000,
    h: 120,
    data: {
      content: '报告标题',
      fontSize: 56,
      fontWeight: 700,
      color: '#111827',
    },
  };
  const coverSubtitle: EditorComponent = {
    id: idGen(),
    type: 'text',
    x: 120,
    y: 380,
    w: 1000,
    h: 50,
    data: {
      content: '副标题 / 日期 / 品牌',
      fontSize: 20,
      color: '#6b7280',
    },
  };

  const overviewTitle: EditorComponent = {
    id: idGen(),
    type: 'text',
    x: 80,
    y: 50,
    w: 1120,
    h: 50,
    data: {
      content: '数据概览',
      fontSize: 32,
      fontWeight: 700,
      color: '#111827',
    },
  };
  const overviewPlaceholder: EditorComponent = {
    id: idGen(),
    type: 'text',
    x: 80,
    y: 130,
    w: 1120,
    h: 460,
    data: {
      content: '在此添加内容…',
      fontSize: 16,
      color: '#9ca3af',
    },
  };

  return [
    {
      id: idGen(),
      name: '封面',
      pageType: 'cover',
      bgColor: '#f9fafb',
      components: [coverTitle, coverSubtitle],
    },
    {
      id: idGen(),
      name: '第 1 页',
      pageType: 'overview',
      components: [overviewTitle, overviewPlaceholder],
    },
  ];
}
