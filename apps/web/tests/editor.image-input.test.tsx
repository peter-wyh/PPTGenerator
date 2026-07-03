import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/api/uploads', () => ({
  uploadImage: vi.fn().mockResolvedValue('http://localhost:4000/uploads/x.png'),
}));

// react-easy-crop 在 jsdom 下无尺寸；用轻量桩，只把裁剪确认按钮暴露出来。
vi.mock('@/components/CropModal', () => ({
  CropModal: ({ onConfirm }: { onConfirm: (b: Blob) => void }) => (
    <div>
      <span>crop-mock</span>
      <button onClick={() => onConfirm(new Blob(['x']))}>确认裁剪</button>
    </div>
  ),
}));

import { ImageInput } from '@/components/ImageInput';
import { uploadImage } from '@/api/uploads';

describe('ImageInput', () => {
  beforeEach(() => vi.clearAllMocks());

  it('渲染文本框 + 上传按钮', () => {
    render(<ImageInput value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText(/https/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上传' })).toBeInTheDocument();
  });

  it('选文件 → 裁剪确认 → 上传 → onChange 收到 url', async () => {
    const onChange = vi.fn();
    render(<ImageInput value="" onChange={onChange} />);
    // 触发文件选择：模拟 change 后弹 CropModal。
    const fileInput = screen
      .getByRole('button', { name: '上传' })
      .closest('div')?.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    // CropModal 出现。
    await waitFor(() => expect(screen.getByText('crop-mock')).toBeInTheDocument());
    fireEvent.click(screen.getByText('确认裁剪'));
    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('http://localhost:4000/uploads/x.png'));
  });
});
