/**
 * AI 网关调用共享工具：可重试的 chat/completions fetch 封装。
 *
 * 设计：
 * - 仅对「值得重试」的失败重试：HTTP 429 / 5xx / 网络层中断（terminated、ECONNRESET 等）
 * - 用户主动取消（AbortError 且非超时）不重试
 * - 指数退避：2s → 8s，最多 3 次尝试（1 次原始 + 2 次重试）
 * - SSE 场景不适用（首 chunk 已转发给客户端后无法重放）
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: any; // string 或多模态数组
}

export interface ChatCompletionOptions {
  apiUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  /** 整体超时（含重试总时长不叠加，每次尝试独立计时）。 */
  timeoutMs: number;
  /** 日志前缀，如 '[AI Generate]'。 */
  logPrefix: string;
  /** 外部取消信号（如 SSE 客户端断开）。 */
  externalSignal?: AbortSignal;
  maxRetries?: number;
}

export interface ChatCompletionResult {
  response: Response;
  attempts: number;
  elapsedMs: number;
}

const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);

function isRetryableNetworkError(err: any): boolean {
  const msg = String(err?.message || '');
  return (
    /terminated|other side closed|fetch failed|socket|ECONNRESET|ETIMEDOUT|connect/i.test(msg) ||
    err?.code === 'ECONNRESET' ||
    err?.code === 'ETIMEDOUT' ||
    (typeof err?.code === 'string' && err.code.startsWith('UND_ERR'))
  );
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

/**
 * 带重试的 chat/completions 调用。
 * 返回 Response（未消费 body，调用方自行 json()/text()）。
 */
export async function fetchChatCompletionWithRetry(
  opts: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const maxRetries = opts.maxRetries ?? 2;
  const startedAt = Date.now();
  let lastErr: any;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    // 每次尝试独立的超时 AbortController + 外部信号桥接
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), opts.timeoutMs);
    const onExternalAbort = () => abortController.abort();
    opts.externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
      const response = await fetch(`${opts.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          temperature: opts.temperature,
          max_tokens: opts.maxTokens,
          stream: false,
        }),
        signal: abortController.signal,
      });

      // HTTP 层可重试错误：读 body（释放连接）后重试
      if (RETRYABLE_HTTP.has(response.status) && attempt <= maxRetries) {
        const errText = await response.text().catch(() => '');
        console.warn(
          `${opts.logPrefix} HTTP ${response.status} (attempt ${attempt}/${maxRetries + 1}), retrying...`,
          { errText: errText.slice(0, 300) },
        );
        await sleep(2 ** attempt * 1000, opts.externalSignal); // 2s, 4s
        continue;
      }

      return { response, attempts: attempt, elapsedMs: Date.now() - startedAt };
    } catch (err: any) {
      // 用户主动取消（外部信号触发）→ 直接抛出不重试
      if (opts.externalSignal?.aborted) throw err;
      // 本地超时 AbortError：复杂报告生成慢，重试大概率同样超时 → 不重试直接抛
      if (err?.name === 'AbortError' && !isRetryableNetworkError(err)) throw err;

      lastErr = err;
      if (isRetryableNetworkError(err) && attempt <= maxRetries) {
        console.warn(
          `${opts.logPrefix} 网络中断 (attempt ${attempt}/${maxRetries + 1}), retrying...`,
          { name: err?.name, code: err?.code, message: String(err?.message || '').slice(0, 200) },
        );
        await sleep(2 ** attempt * 1000, opts.externalSignal);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
      opts.externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }

  throw lastErr ?? new Error('fetchChatCompletionWithRetry: exhausted retries');
}
