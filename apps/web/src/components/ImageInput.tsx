import { useRef, useState } from 'react';
import { uploadImage } from '@/api/uploads';
import { CropModal } from './CropModal';

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** 裁剪输出宽高比（如头像 1）。不传=自由。 */
  aspect?: number;
}

/** 图片 URL 输入：文本框 + 上传(裁剪) + 缩略预览。上传后自动填入 URL。 */
export function ImageInput({ value, onChange, aspect }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function pick() {
    setError('');
    fileRef.current?.click();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPending(f);
    e.target.value = ''; // 允许重复选同一文件
  }

  async function onCropped(blob: Blob) {
    setPending(null);
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(blob);
      onChange(url);
    } catch (e) {
      // ★ 显式报错(不再静默):区分鉴权/网络/服务端,给出可行动文案
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) setError('登录已过期，请刷新页面重新登录后再上传');
      else if (status === 413) setError('图片超过 10MB 限制，请压缩后重试');
      else if (status && status >= 500) setError('上传服务异常，请稍后重试');
      else setError('上传失败，请检查网络后重试');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          placeholder="https://… 或点上传"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
        />
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className="flex-none rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
          title="从本地上传并裁剪"
        >
          {uploading ? '上传中' : '上传'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
      {(value || error) && (
        <div className="flex items-center gap-2">
          {value && (
            <img src={value} alt="" className="max-h-16 rounded border border-border-subtle object-contain" draggable={false} />
          )}
          {error && <span className="text-[11px] text-red">{error}</span>}
        </div>
      )}
      {pending && (
        <CropModal file={pending} aspect={aspect} onConfirm={onCropped} onClose={() => setPending(null)} />
      )}
    </div>
  );
}
