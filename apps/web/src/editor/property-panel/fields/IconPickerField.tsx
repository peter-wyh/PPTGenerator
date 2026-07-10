import { useState } from 'react';
import type { EditorComponent, IconWeight } from '@mediakit/shared';
import { REGISTRY } from '../../registry';
import { IconPickerOverlay, ICON_WEIGHT_OPTIONS } from '../../icons/IconPickerOverlay';
import { IconKit } from '../../icons/IconKit';
import { useDataUpdate } from '../helpers';

/** 图标字段：预览 + 选择(overlay) + 清除 + weight 下拉。仅用于启用图标的变体。 */
export function IconPickerField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as { icon?: string; iconWeight?: IconWeight };
  const def = REGISTRY[comp.type];
  const currentVariantId = (comp.data as { variant?: string }).variant ?? def.variants?.[0]?.id;
  const variantDef = def.variants?.find((v) => v.id === currentVariantId);
  const variantIconCfg = variantDef?.icon;

  // 回退顺序：data.iconWeight → variant.defaultWeight → 'regular'
  const weight: IconWeight = data.iconWeight ?? variantIconCfg?.defaultWeight ?? 'regular';
  // 显示的图标：data.icon → variant.defaultKey
  const effectiveKey = data.icon ?? variantIconCfg?.defaultKey;
  const [open, setOpen] = useState(false);

  return (
    <div className="block text-xs text-foreground-secondary">
      <div className="mb-1">图标</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-foreground-primary hover:bg-surface-hover"
          title="选择图标"
        >
          <IconKit name={effectiveKey} weight={weight} size={20} />
        </button>
        <button
          onClick={() => setOpen(true)}
          className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          选择
        </button>
        {data.icon && (
          <button
            onClick={() => update('icon', undefined)}
            className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            清除
          </button>
        )}
        <select
          value={weight}
          onChange={(e) => update('iconWeight', e.target.value)}
          className="ml-auto rounded border border-border-default px-1 py-1 text-xs text-foreground-primary"
          title="图标风格"
        >
          {ICON_WEIGHT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {open && (
        <IconPickerOverlay
          value={data.icon}
          weight={weight}
          onPick={(key) => {
            update('icon', key);
            setOpen(false);
          }}
          onClear={() => {
            update('icon', undefined);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
