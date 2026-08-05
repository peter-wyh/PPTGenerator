import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 区域名称，显示在降级 UI 中 */
  label?: string;
  /** 是否使用紧凑布局（侧栏/面板级） */
  compact?: boolean;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React 错误边界 —— 捕获子树渲染异常，显示友好降级 UI 而非白屏。
 * 全局级（main.tsx）和区域级（Canvas / PropertyPanel）各包裹一层。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info });
    console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  /** 从 componentStack 中提取出错的组件名。 */
  private extractComponentName(stack?: string | null): string | null {
    if (!stack) return null;
    // stack 格式: "\n    at PieChartComponent (http://...)\n    at ComponentRenderer2 ..."
    const match = stack.match(/at\s+<*(\w+)>*\s*\(/);
    return match?.[1] ?? null;
  }

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    const label = this.props.label ?? '页面';
    const compact = this.props.compact;
    const compName = this.extractComponentName(errorInfo?.componentStack);
    const shortError = error.message?.slice(0, 120) || '未知错误';

    if (compact) {
      return (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 p-4 text-center">
          <p className="text-xs text-gray-500">
            「{label}」渲染出错
          </p>
          {compName && (
            <p className="text-[10px] text-red-400">
              组件: {compName}
            </p>
          )}
          <p className="max-w-xs truncate text-[10px] text-gray-400" title={shortError}>
            {shortError}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-1 rounded px-2 py-1 text-xs text-gray-600 underline hover:text-gray-900"
          >
            重试
          </button>
        </div>
      );
    }

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center skin-gap-lg p-8">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-lg skin-fw-heading text-gray-800">
            😵 {label}遇到了问题
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            渲染过程中发生了错误{compName ? `（组件: ${compName}）` : ''}。你可以尝试重试，或刷新页面。
          </p>
          <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-gray-100 p-3 text-left text-xs text-red-600">
            {shortError}
          </pre>
          <div className="flex justify-center skin-gap-md">
            <button
              onClick={this.handleReset}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              重试
            </button>
            <button
              onClick={this.handleReload}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
