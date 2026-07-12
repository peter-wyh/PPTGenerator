import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** 出错时的回调（可用于上报）。 */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 全局 ErrorBoundary —— 捕获子树渲染异常，展示友好降级 UI 而非白屏。
 *
 * 用法：
 *   <ErrorBoundary>  <App />  </ErrorBoundary>
 *   <ErrorBoundary fallback={<CustomFallback />}>  <Editor />  </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info);
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-gray-50 p-8">
          <div className="text-4xl">😵</div>
          <h1 className="text-lg font-semibold text-gray-800">页面渲染出错</h1>
          <p className="max-w-md text-center text-sm text-gray-500">
            {this.state.error?.message ?? '未知错误'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
