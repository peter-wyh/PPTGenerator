/**
 * ★ localhost 域归一化（与 upload/storage.ts 的防御同款哲学）：
 * base 是 http://localhost[:port] / http://127.0.0.1[:port] 时返回 ''（相对路径）。
 *
 * 报告 HTML 在 srcDoc iframe 中渲染，相对 /uploads、/vendor 经父页面同源反代访问，
 * 本地 dev / 测试环境 / 生产 / 分享链接 任意环境下都通；localhost 绝对地址一旦
 * 离开本机（报告同步到测试库、分享给客户）全部裂图。
 *
 * 生产环境配了真实域名（PUBLIC_BASE_URL）时原样返回，行为不变。
 */
export function devSafeBase(baseUrl: string | undefined | null): string {
  const b = (baseUrl || '').trim().replace(/\/+$/, '');
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(b) ? '' : b;
}
