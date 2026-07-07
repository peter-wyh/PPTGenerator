import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';

interface Props {
  /** 待裁剪图片（本地选择的文件）。 */
  file: File;
  /** 输出宽高比；不传=自由比例。 */
  aspect?: number;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
}

/** 把裁剪区（原图像素坐标）绘到 canvas，输出 blob。 */
async function cropToBlob(img: HTMLImageElement, area: Area): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 失败')), 'image/png'));
  });
}

/** 图片裁剪浮层：react-easy-crop 选区 → canvas 裁出 blob。 */
export function CropModal({ file, aspect, onConfirm, onClose }: Props) {
  const [src, setSrc] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_a: Area, pixels: Area) => setArea(pixels), []);

  async function confirm() {
    if (!area) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      const blob = await cropToBlob(img, area);
      onConfirm(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-xl bg-surface-primary p-4 shadow-lg">
        <div className="relative h-[420px] w-full overflow-hidden rounded-lg bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-foreground-secondary">
            缩放
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover">
              取消
            </button>
            <button
              onClick={confirm}
              disabled={busy || !area}
              className="rounded-lg bg-accent-primary px-4 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy ? '处理中…' : '确认裁剪'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
