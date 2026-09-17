/**
 * MultiImageInput — 多图上传/管理（0916，广告位截图多张）。
 * 复用 ImageInput 的单图上传(选文件→裁剪→上传→得 URL)链路；
 * 在其上包一层数组管理：逐张追加 + 每张删除 + 批量排队上传。
 */
import { useRef, useState } from 'react';
import { uploadImage } from '@/api/uploads';
import { CropModal } from './CropModal';

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
}

/** 批量选中的待裁剪队列：{file, done?} */
interface PendingFile {
  file: File;
  /** 已上传完成的 URL（仍在队列=还没轮到裁剪确认）。 */
}

export function MultiImageInput({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function pick() {
    setError('');
    fileRef.current?.click();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setQueue((q) => [...q, ...files.map((file) => ({ file }))]);
    e.target.value = '';
  }

  /** 裁剪确认：上传该张并追加到数组，继续队列下一张。 */
  async function onCropped(blob: Blob) {
    setBusy(true);
    setError('');
    try {
      const url = await uploadImage(blob);
      onChange([...value, url]);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) setError('登录已过期，请刷新页面重新登录后再上传');
      else if (status === 413) setError('图片超过 10MB 限制，请压缩后重试');
      else if (status && status >= 500) setError('上传服务异常，请稍后重试');
      else setError('上传失败，请检查网络后重试');
      // 失败也出队，避免卡死队列
    } finally {
      setQueue((q) => q.slice(1));
      setBusy(false);
    }
  }

  function removeAt(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  const cur = queue[0];

  return (
    <div className="w-52 space-y-1">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((u, i) => (
            <span key={`${u}:${i}`} className="relative">
              <img src={u} alt={`截图${i + 1}`} className="max-h-12 rounded border border-border-subtle object-contain" draggable={false} />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface-primary text-[10px] leading-none text-red shadow border border-border-default"
                title="删除此张"
              >×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
          title="可多选文件，逐张裁剪后依次上传"
        >
          {busy ? `上传中(${value.length})` : value.length ? '再加一张' : '上传截图'}
        </button>
        {queue.length > 1 && <span className="text-[10px] text-foreground-muted">队列 {queue.length} 张</span>}
        {error && <span className="text-[11px] text-red">{error}</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPick} className="hidden" />
      {cur && (
        <CropModal file={cur.file} onConfirm={onCropped} onClose={() => setQueue((q) => q.slice(1))} />
      )}
    </div>
  );
}
