import type { Config } from 'tailwindcss';

/**
 * 把 demo.html 的 :root 设计 token 移植为 CSS 变量（见 src/index.css），
 * Tailwind 颜色 / 圆角 / 阴影再引用这些变量，保持单一 token 源。
 * 主色 #FF5C00。
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          primary: 'var(--surface-primary)',
          inverse: 'var(--surface-inverse)',
          subtle: 'var(--surface-subtle)',
          hover: 'var(--surface-hover)',
        },
        foreground: {
          primary: 'var(--foreground-primary)',
          secondary: 'var(--foreground-secondary)',
          muted: 'var(--foreground-muted)',
          inverse: 'var(--foreground-inverse)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          secondary: 'var(--accent-secondary)',
        },
        // 品牌色（幻灯片内容引用）：随项目主题变化（编辑器根节点覆盖 --color-*）。
        // accent.* = 编辑器 chrome 固定强调色（选中框/面板高亮），不随品牌色变。
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        green: 'var(--green)',
        red: 'var(--red)',
        'red-bg': 'var(--red-bg)',
        'red-border': 'var(--red-border)',
        blue: 'var(--blue)',
        yellow: 'var(--yellow)',
        purple: 'var(--purple)',
      },
      fontFamily: {
        headings: ['Funnel Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        data: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        lg: '8px',
        xl: '12px',
        '3xl': '24px',
      },
      boxShadow: {
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
} satisfies Config;
