/**
 * 全局页眉/页脚渲染组件（非画布组件，由 Canvas 自动渲染在顶部/底部）。
 * 数据来源于 projectMeta.headerConfig / footerConfig。
 */
import type { GlobalHeaderConfig, GlobalFooterConfig, HeaderBackground, HeaderLogo } from '@mediakit/shared';

/* ------------------------------- 工具函数 ------------------------------- */

/** 解析 background 字段为 CSS background 值。 */
function resolveBg(bg?: string | HeaderBackground): string {
  if (!bg) return 'var(--color-neutral-bg, #ffffff)';
  if (typeof bg === 'string') return bg;
  switch (bg.type) {
    case 'gradient':
      return bg.gradient || 'linear-gradient(90deg, #1a1a2e, #16213e)';
    case 'image':
      return bg.image ? `url(${bg.image}) center/cover no-repeat` : '#ffffff';
    case 'color':
    default:
      return bg.color || '#ffffff';
  }
}

/** 判断背景是否为深色（用于决定文字颜色）。 */
function isDarkBg(bg?: string | HeaderBackground): boolean {
  if (!bg || typeof bg === 'string') {
    const hex = (bg || 'var(--color-neutral-bg, #ffffff)').replace('#', '');
    if (hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 140;
  }
  if (bg.type === 'gradient') return true;
  if (bg.type === 'image') return true;
  if (bg.type === 'color') return isDarkBg(bg.color);
  return false;
}

/** 渲染单个 logo。src 为空则不渲染（不显示占位）。 */
function HeaderLogoItem({ logo, dark }: { logo?: HeaderLogo; dark?: boolean }) {
  if (!logo) return null;
  const hasImg = logo.src && logo.src.trim();
  const hasText = logo.text && logo.text.trim();
  // 如果既没有图片也没有文字，返回 null（不显示占位 "?"）
  if (!hasImg && !hasText) return null;

  const height = logo.logoHeight ?? 28;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {hasImg ? (
        <img
          src={logo.src}
          alt={logo.text || ''}
          style={{ height, width: 'auto', maxWidth: 160, objectFit: 'contain' }}
        />
      ) : (
        <div
          style={{
            height,
            minWidth: height,
            borderRadius: 6,
            background: dark ? 'rgba(255,255,255,0.15)' : 'var(--color-primary, #e2503f)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {logo.initials || logo.text?.slice(0, 2) || ''}
        </div>
      )}
      {hasText && (
        <span style={{ fontSize: 13, fontWeight: 600, color: dark ? '#fff' : 'var(--color-neutral-text, #1a1a1a)' }}>
          {logo.text}
        </span>
      )}
    </div>
  );
}

/** × 连接符组件。 */
function Connector({ label = '×', dark }: { label?: string; dark?: boolean }) {
  return (
    <span
      style={{
        fontSize: 18,
        fontWeight: 300,
        color: dark ? 'rgba(255,255,255,0.5)' : 'var(--foreground-muted, #bbb)',
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------- 全局页眉 ------------------------------- */

export function GlobalHeader({
  config,
  width,
  pageIndex,
  totalPages,
}: {
  config: GlobalHeaderConfig;
  width: number;
  pageIndex?: number;
  totalPages?: number;
}) {
  if (!config.enabled) return null;

  const h = config.height ?? 56;
  const bg = resolveBg(config.background);
  const dark = isDarkBg(config.background);
  const opacity = typeof config.background === 'object' ? config.background.opacity : undefined;
  // opacity<1 时容器自身不画背景（透明），交由下方 zIndex:-1 遮罩层承载半透明背景，
  // 这样遮罩才能透过容器与页面 backdrop 合成出真正的半透明效果。
  const useOpacityMask = opacity !== undefined && opacity < 1;
  const preset = config.preset ?? 'split';
  const connector = config.connector ?? '×';

  const dateLabel = config.dateLabel
    ?.replace('{page}', String(pageIndex ?? ''))
    .replace('{total}', String(totalPages ?? ''));

  const textColor = dark ? '#fff' : 'var(--color-neutral-text, #1a1a1a)';
  const mutedColor = dark ? 'rgba(255,255,255,0.6)' : 'var(--foreground-muted, #626166)';

  // 底部边框
  const borderColor = config.borderColor === undefined ? 'var(--border-subtle, #ebebeb)' : config.borderColor;

  /** 根据 preset 渲染页眉内部内容。 */
  function renderContent() {
    switch (preset) {
      /* 左右分列：广告主 logo (左) × 业务线 logo (右) */
      case 'split': {
        const hasLeft = config.leftLogo && (config.leftLogo.src?.trim() || config.leftLogo.text?.trim());
        const hasRight = config.rightLogo && (config.rightLogo.src?.trim() || config.rightLogo.text?.trim());
        const showConnector = hasLeft && hasRight;
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <HeaderLogoItem logo={config.leftLogo} dark={dark} />
              {showConnector && <Connector label={connector} dark={dark} />}
              <HeaderLogoItem logo={config.rightLogo} dark={dark} />
            </div>
            {dateLabel && (
              <div style={{
                fontSize: 13, fontWeight: 500, color: mutedColor,
                background: dark ? 'rgba(255,255,255,0.1)' : 'var(--color-neutral-bg, #f5f7fa)',
                padding: '4px 16px', borderRadius: 6,
              }}>
                {dateLabel}
              </div>
            )}
          </>
        );
      }

      /* 左侧双 logo（×关联）+ 右侧报告标题 */
      case 'left-logos-right-text': {
        const hasLeft = config.leftLogo && (config.leftLogo.src?.trim() || config.leftLogo.text?.trim());
        const hasRight = config.rightLogo && (config.rightLogo.src?.trim() || config.rightLogo.text?.trim());
        const showConnector = hasLeft && hasRight;
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <HeaderLogoItem logo={config.leftLogo} dark={dark} />
              {showConnector && <Connector label={connector} dark={dark} />}
              <HeaderLogoItem logo={config.rightLogo} dark={dark} />
            </div>
            <div style={{ textAlign: 'right' }}>
              {config.titleText && (
                <div style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{config.titleText}</div>
              )}
              {dateLabel && (
                <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>{dateLabel}</div>
              )}
            </div>
          </>
        );
      }

      /* 左侧文案 + 右侧单 logo */
      case 'left-text-right-logo':
        return (
          <>
            <div style={{ textAlign: 'left' }}>
              {config.titleText && (
                <div style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{config.titleText}</div>
              )}
              {dateLabel && (
                <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>{dateLabel}</div>
              )}
            </div>
            <HeaderLogoItem logo={config.rightLogo} dark={dark} />
          </>
        );

      /* 左侧单 logo + 右侧文案 */
      case 'left-logo-right-text':
        return (
          <>
            <HeaderLogoItem logo={config.leftLogo} dark={dark} />
            <div style={{ textAlign: 'right' }}>
              {config.titleText && (
                <div style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{config.titleText}</div>
              )}
              {dateLabel && (
                <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>{dateLabel}</div>
              )}
            </div>
          </>
        );

      /* 纯居中文案 */
      case 'center-text':
        return (
          <div style={{ textAlign: 'center', width: '100%' }}>
            {config.titleText && (
              <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>{config.titleText}</div>
            )}
            {dateLabel && (
              <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>{dateLabel}</div>
            )}
          </div>
        );

      /* 自定义：沿用旧布局（左 logo / 日期 / 右 logo） */
      case 'custom':
      default:
        return (
          <>
            <HeaderLogoItem logo={config.leftLogo} dark={dark} />
            {dateLabel && (
              <div style={{
                fontSize: 13, fontWeight: 500, color: mutedColor,
                background: dark ? 'rgba(255,255,255,0.1)' : 'var(--color-neutral-bg, #f5f7fa)',
                padding: '4px 16px', borderRadius: 6,
              }}>
                {dateLabel}
              </div>
            )}
            <HeaderLogoItem logo={config.rightLogo} dark={dark} />
          </>
        );
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height: h,
        background: useOpacityMask ? 'transparent' : bg,
        borderBottom: borderColor !== 'transparent' ? `1px solid ${borderColor}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxSizing: 'border-box',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* 不透明度遮罩层：opacity<1 时容器透明，由这层承载半透明背景 */}
      {useOpacityMask && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: resolveBg(typeof config.background === 'object' ? { ...config.background, opacity: 1 } : config.background),
            opacity,
            zIndex: -1,
          }}
        />
      )}
      {renderContent()}
    </div>
  );
}

/* ------------------------------- 全局页脚 ------------------------------- */

export function GlobalFooter({
  config,
  canvasHeight,
  width,
  pageIndex,
  totalPages,
}: {
  config: GlobalFooterConfig;
  canvasHeight: number;
  width: number;
  pageIndex?: number;
  totalPages?: number;
}) {
  if (!config.enabled) return null;
  const h = config.height ?? 36;
  const bg = resolveBg(config.background);
  const dark = isDarkBg(config.background);

  const leftText = config.leftText || '© 2026 MediaKit';
  const rightText = (config.rightText || '{page}/{total}')
    .replace('{page}', String(pageIndex ?? ''))
    .replace('{total}', String(totalPages ?? ''));

  return (
    <div
      style={{
        position: 'absolute',
        top: canvasHeight - h,
        left: 0,
        width,
        height: h,
        background: bg,
        borderTop: '1px solid #ebebeb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxSizing: 'border-box',
        zIndex: 100,
        pointerEvents: 'none',
        fontSize: 11,
        color: dark ? 'rgba(255,255,255,0.6)' : '#999',
      }}
    >
      <span>{leftText}</span>
      <span>{rightText}</span>
    </div>
  );
}
