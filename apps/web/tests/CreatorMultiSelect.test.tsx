import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatorMultiSelect } from '@/editor/components/CreatorMultiSelect';
import type { Creator } from '@mediakit/shared';

const creators: Creator[] = [
  { id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] },
  { id: 'cre-sofia', name: 'Sofia', handle: '@sofia', platform: 'TikTok', tier: 'macro', followers: '500K', engagement: '7%', category: 'Beauty', region: 'US', metrics: [] },
];

describe('CreatorMultiSelect', () => {
  it('列出全部达人;勾选 → onChange 回传 id 数组', async () => {
    const onChange = vi.fn();
    render(<CreatorMultiSelect creators={creators} selected={[]} onChange={onChange} />);
    expect(screen.getByText('Mia')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Mia/));
    expect(onChange).toHaveBeenCalledWith(['cre-mia']);
  });
  it('selected 预勾选', () => {
    render(<CreatorMultiSelect creators={creators.slice(0, 1)} selected={['cre-mia']} onChange={() => {}} />);
    expect((screen.getByLabelText(/Mia/) as HTMLInputElement).checked).toBe(true);
  });
  it('空达人库显示占位', () => {
    render(<CreatorMultiSelect creators={[]} selected={[]} onChange={() => {}} />);
    expect(screen.getByText('达人库为空')).toBeInTheDocument();
  });
});
