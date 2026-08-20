/** 应用 Logo：报告文档 + 数据折线 + AI 闪光（蓝紫渐变，与 AI 功能视觉语言一致）。 */
export function Logo({ size = 24, withText = false }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mk-logo-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#mk-logo-grad)" />
        {/* 报告文档 */}
        <rect x="9" y="6" width="14" height="20" rx="2.5" fill="#fff" fillOpacity="0.96" />
        {/* 标题条 */}
        <rect x="12" y="10" width="8" height="2" rx="1" fill="#6366F1" fillOpacity="0.85" />
        {/* 文本行 */}
        <rect x="12" y="14.5" width="8" height="1.4" rx="0.7" fill="#C7CEDC" />
        <rect x="12" y="17.5" width="5.5" height="1.4" rx="0.7" fill="#C7CEDC" />
        {/* 数据折线 */}
        <polyline
          points="12,24.5 15,21.5 17.5,23 20,20"
          stroke="#A855F7"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="20" r="1.3" fill="#A855F7" />
        {/* AI 闪光 */}
        <path
          d="M25.5 4.5 L26.3 6.7 L28.5 7.5 L26.3 8.3 L25.5 10.5 L24.7 8.3 L22.5 7.5 L24.7 6.7 Z"
          fill="#FDE68A"
          stroke="#A855F7"
          strokeWidth="0.6"
        />
      </svg>
      {withText && (
        <span className="font-headings text-xl font-semibold tracking-tight text-foreground-primary">
          Report Generator
        </span>
      )}
    </span>
  );
}
