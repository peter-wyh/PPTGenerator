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
}

/**
 * React 错误边界 —— 捕获子树渲染异常，显示友好降级 UI 而非白屏。
 * 全局级（main.tsx）和区域级（Canvas / PropertyPanel）各包裹一层。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const label = this.props.label ?? '页面';
    const compact = this.props.compact;

    if (compact) {
      return (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-xs text-gray-500">
            「{label}」渲染出错
          </p>
          <button
            onClick={this.handleReset}
            className="rounded px-2 py-1 text-xs text-gray-600 underline hover:text-gray-900"
          >
            重试
          </button>
        </div>
      );
    }

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 p-8">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            😵 {label}遇到了问题
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            渲染过程中发生了错误。你可以尝试重试，或刷新页面。
          </p>
          <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-gray-100 p-3 text-left text-xs text-red-600">
            {error.message}
          </pre>
          <div className="flex justify-center gap-3">
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
