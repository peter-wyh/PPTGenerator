/**
 * 上游数据接口文档页面（/data/api-docs）。
 * 渲染 src/data/apiDocs.ts —— 单一事实源：接口变更时改数据文件并追加 changelog，本页自动反映。
 */
import { useState } from 'react';
import {
  API_DOC_CONVENTIONS,
  API_DOC_ENDPOINTS,
  API_DOC_CHANGELOG,
  API_DOC_UPDATED,
  API_DOC_VERSION,
  DOC_GROUPS,
} from '../data/apiDocs';

type Section = 'conventions' | 'endpoint' | 'changelog';

export function ApiDocsPage() {
  const [section, setSection] = useState<Section>('conventions');
  const [activeEndpoint, setActiveEndpoint] = useState<string>(API_DOC_ENDPOINTS[0]?.id ?? '');
  const endpoint = API_DOC_ENDPOINTS.find((e) => e.id === activeEndpoint);

  const navBtn = (active: boolean) =>
    `flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
      active
        ? 'bg-accent-primary/10 font-medium text-accent-primary'
        : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
    }`;

  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-foreground-secondary';
  const td = 'px-3 py-2 text-sm text-foreground-primary';

  return (
    <div className="flex h-full min-h-0">
      {/* 左侧导航 */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border-default bg-surface-primary">
        <nav className="flex-1 overflow-auto px-2 py-2">
          <button
            onClick={() => setSection('conventions')}
            className={navBtn(section === 'conventions')}
          >
            <span>通用约定</span>
          </button>
          <div className="mt-1 border-t border-border-subtle pt-1" />
          {DOC_GROUPS.map((g) => (
            <div key={g} className="mt-1">
              <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-tertiary">{g}</div>
              {API_DOC_ENDPOINTS.filter((e) => e.group === g).map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setSection('endpoint');
                    setActiveEndpoint(e.id);
                  }}
                  className={navBtn(section === 'endpoint' && activeEndpoint === e.id)}
                >
                  <span>{e.title}</span>
                  <span className={`ml-2 shrink-0 text-[10px] ${e.method === 'GET' ? 'text-blue-500' : 'text-foreground-tertiary'}`}>{e.method}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="mt-1 border-t border-border-subtle pt-1" />
          <button
            onClick={() => setSection('changelog')}
            className={navBtn(section === 'changelog')}
          >
            <span>变更日志</span>
          </button>
        </nav>
        <div className="border-t border-border-subtle px-3 py-2 text-[11px] text-foreground-tertiary">
          文档版本 {API_DOC_VERSION} · 更新于 {API_DOC_UPDATED}
        </div>
      </div>

      {/* 右侧内容 */}
      <div className="min-w-0 flex-1 overflow-auto px-6 py-6">
        {section === 'conventions' && (
          <div className="max-w-3xl">
            <h1 className="font-headings text-2xl font-semibold text-foreground-primary">上游数据接口文档</h1>
            <p className="mt-2 text-sm text-foreground-secondary">
              构造 Campaign 报告所需的全部上游数据，通过以下批量导入接口与数据管理接口提供。本文档即数据交付契约——
              字段、格式、合并语义以本页为准；接口迭代时同步更新并记录变更日志。
            </p>
            <div className="mt-6 rounded-lg border border-border-default bg-surface-secondary px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground-primary">通用约定</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {API_DOC_CONVENTIONS.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground-secondary">
                    <span className="mt-0.5 shrink-0 text-foreground-tertiary">·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <h2 className="mt-8 text-base font-semibold text-foreground-primary">接口一览与数据链路</h2>
            <p className="mt-1 text-xs text-foreground-secondary">按数据链路分类：达人 → 合作 → 订单 / 链接（导入）→ 统计中间层（物化）→ CPS 真源。</p>
            <div className="mt-3 flex flex-col gap-4">
              {DOC_GROUPS.map((g) => (
                <div key={g} className="overflow-hidden rounded-lg border border-border-default">
                  <div className="border-b border-border-subtle bg-surface-secondary px-3 py-1.5 text-xs font-semibold text-foreground-primary">{g}</div>
                  <table className="w-full border-collapse">
                    <tbody>
                      {API_DOC_ENDPOINTS.filter((e) => e.group === g).map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => {
                            setSection('endpoint');
                            setActiveEndpoint(e.id);
                          }}
                          className="cursor-pointer border-t border-border-subtle hover:bg-surface-hover"
                        >
                          <td className={`${td} w-16 font-mono text-[10px] ${e.method === 'GET' ? 'text-blue-500' : 'text-foreground-tertiary'}`}>{e.method}</td>
                          <td className={`${td} font-mono text-xs`}>{e.path}</td>
                          <td className={td}>{e.title}</td>
                          <td className={`${td} text-xs text-foreground-secondary`}>
                            {e.prerequisiteSummary ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'endpoint' && endpoint && (
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${endpoint.method === 'GET' ? 'bg-blue-500/10 text-blue-500' : 'bg-green/10 text-green'}`}>{endpoint.method}</span>
              <h1 className="font-headings text-xl font-semibold text-foreground-primary">{endpoint.title}</h1>
            </div>
            <p className="mt-2 font-mono text-xs text-foreground-secondary">{endpoint.path}</p>
            <p className="mt-3 text-sm text-foreground-primary">{endpoint.purpose}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 text-xs">
              <div className="rounded-lg border border-border-default bg-surface-secondary px-4 py-3">
                <span className="font-semibold text-foreground-primary">数据来源：</span>
                <span className="text-foreground-secondary">{endpoint.source}</span>
              </div>
              <div className="rounded-lg border border-border-default bg-surface-secondary px-4 py-3">
                <span className="font-semibold text-foreground-primary">前置依赖：</span>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {endpoint.prerequisites.map((p, i) => (
                    <li key={i} className="text-foreground-secondary">· {p}</li>
                  ))}
                </ul>
              </div>
            </div>

            {endpoint.semantics.length > 0 && (
              <div className="mt-3 rounded-lg border border-accent-primary/30 bg-accent-primary/5 px-4 py-3">
                <span className="text-xs font-semibold text-accent-primary">合并 / 幂等语义</span>
                <ul className="mt-1 flex flex-col gap-1">
                  {endpoint.semantics.map((s, i) => (
                    <li key={i} className="text-xs text-foreground-secondary">· {s}</li>
                  ))}
                </ul>
              </div>
            )}

            <h2 className="mt-6 text-sm font-semibold text-foreground-primary">请求字段</h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-border-default">
              <table className="w-full border-collapse">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className={th}>字段</th>
                    <th className={th}>类型</th>
                    <th className={th}>必填</th>
                    <th className={th}>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.fields.map((f) => (
                    <tr key={f.name} className="border-t border-border-subtle">
                      <td className={`${td} whitespace-nowrap font-mono text-xs`}>{f.name}</td>
                      <td className={`${td} whitespace-nowrap font-mono text-xs text-foreground-secondary`}>{f.type}</td>
                      <td className={td}>
                        {f.required ? (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">必填</span>
                        ) : (
                          <span className="text-[10px] text-foreground-tertiary">可选</span>
                        )}
                      </td>
                      <td className={`${td} text-xs text-foreground-secondary`}>{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-6 text-sm font-semibold text-foreground-primary">请求示例</h2>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-inverse px-4 py-3 font-mono text-xs leading-relaxed text-surface-primary">
              {endpoint.requestExample}
            </pre>
            <h2 className="mt-4 text-sm font-semibold text-foreground-primary">响应</h2>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-inverse px-4 py-3 font-mono text-xs text-surface-primary">
              {endpoint.response}
            </pre>
          </div>
        )}

        {section === 'changelog' && (
          <div className="max-w-3xl">
            <h1 className="font-headings text-2xl font-semibold text-foreground-primary">变更日志</h1>
            <p className="mt-2 text-sm text-foreground-secondary">接口文档的每次迭代在此留痕，最新在上。</p>
            <div className="mt-6 flex flex-col gap-6">
              {API_DOC_CHANGELOG.map((entry) => (
                <div key={entry.version} className="rounded-lg border border-border-default bg-surface-secondary px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold text-accent-primary">v{entry.version}</span>
                    <span className="text-xs text-foreground-tertiary">{entry.date}</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {entry.changes.map((c, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            c.kind === '新增'
                              ? 'bg-green/10 text-green'
                              : c.kind === '变更'
                                ? 'bg-blue-500/10 text-blue-500'
                                : c.kind === '修复'
                                  ? 'bg-orange-500/10 text-orange-500'
                                  : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {c.kind}
                        </span>
                        <span className="text-foreground-secondary">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApiDocsPage;
