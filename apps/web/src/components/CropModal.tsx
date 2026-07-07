import { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface Props {
  /** 待裁剪图片（本地选择的文件）。 */
  file: File;
  /** 输出宽高比；不传=自由比例（可任意拖角点改比例）。 */
  aspect?: number;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
}

/** 把显示像素裁剪区（按 naturalWidth/width 缩放回原图）绘到 canvas，输出 blob。 */
async function cropToBlob(img: HTMLImageElement, px: PixelCrop): Promise<Blob> {
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  const sx = px.x * scaleX;
  const sy = px.y * scaleY;
  const sw = px.width * scaleX;
  const sh = px.height * scaleY;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 失败'))), 'image/png');
  });
}

/** 图片裁剪浮层：react-image-crop 选区（可拖动框 + 角点 resize）→ canvas 裁出 blob。 */
export function CropModal({ file, aspect, onConfirm, onClose }: Props) {
  const [src, setSrc] = useState('');
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 图片加载后给一个默认居中选区；aspect 模式下自动符合比例。
  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const initial =
        aspect != null
          ? centerCrop(
              makeAspectCrop({ unit: '%', width: 80 }, aspect, width, height),
              width,
              height,
            )
          : { unit: '%' as const, x: 10, y: 10, width: 80, height: 80 };
      setCrop(initial);
    },
    [aspect],
  );

  async function confirm() {
    const img = imgRef.current;
    if (!img || !completedCrop || !completedCrop.width || !completedCrop.height) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(img, completedCrop);
      onConfirm(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-xl bg-surface-primary p-4 shadow-lg">
        <div className="flex h-[420px] w-full items-center justify-center overflow-hidden rounded-lg bg-black">
          {src && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              keepSelection
            >
              <img
                ref={imgRef}
                src={src}
                onLoad={onImageLoad}
                alt="待裁剪"
                style={{ maxHeight: '100%', maxWidth: '100%' }}
              />
            </ReactCrop>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-foreground-secondary">
            {aspect ? `锁定比例 ${aspect}` : '拖动选区、拽角点调整大小（自由比例）'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover">
              取消
            </button>
            <button
              onClick={confirm}
              disabled={busy || !completedCrop}
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
