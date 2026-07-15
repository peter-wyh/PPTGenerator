import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreatorAudienceProfile } from '@/editor/components/report/CreatorAudienceProfile';
import type { CreatorAudienceProfileData } from '@mediakit/shared';

describe('CreatorAudienceProfile', () => {
  it('无启用模块时显示占位', () => {
    render(<CreatorAudienceProfile data={{ variant: 'grid-3', modules: [] }} />);
    expect(screen.getByText(/No audience modules enabled/i)).toBeInTheDocument();
  });

  it('selected=false 的模块不渲染', () => {
    const data: CreatorAudienceProfileData = {
      variant: 'grid-3',
      modules: [
        { key: 'gender', selected: false, items: [{ label: 'F', value: 70 }] },
        { key: 'age', selected: true, items: [{ label: '18-24', value: 35 }] },
      ],
    };
    render(<CreatorAudienceProfile data={data} />);
    expect(screen.getByText('年龄占比')).toBeInTheDocument();
    expect(screen.queryByText('性别占比')).not.toBeInTheDocument();
  });

  it('渲染年龄/城市的横条标签与百分比', () => {
    const data: CreatorAudienceProfileData = {
      variant: 'grid-2',
      modules: [
        { key: 'age', selected: true, items: [{ label: '18-24', value: 35 }, { label: '25-34', value: 42 }] },
        { key: 'city', selected: true, items: [{ label: 'New York', value: 22 }] },
      ],
    };
    render(<CreatorAudienceProfile data={data} />);
    expect(screen.getByText('18-24')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('New York')).toBeInTheDocument();
    expect(screen.getByText('22%')).toBeInTheDocument();
  });

  it('空 items 的模块显示 No data', () => {
    const data: CreatorAudienceProfileData = {
      variant: 'stacked',
      modules: [{ key: 'city', selected: true, items: [] }],
    };
    render(<CreatorAudienceProfile data={data} />);
    expect(screen.getByText('城市排行')).toBeInTheDocument();
    expect(screen.getAllByText(/No data/i).length).toBeGreaterThan(0);
  });

  it('gender 渲染大数字 + 标签(非环形)', () => {
    const data: CreatorAudienceProfileData = {
      variant: 'grid-2',
      modules: [
        { key: 'gender', selected: true, items: [{ label: 'Female', value: 44, color: '#EC4899' }, { label: 'Male', value: 56, color: '#3B82F6' }] },
      ],
    };
    const { container } = render(<CreatorAudienceProfile data={data} />);
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(screen.getByText('56%')).toBeInTheDocument();
    // 大数字用 inline color(非环形 svg 切片)
    expect(container.querySelector('svg.recharts-surface')).toBeNull();
  });
});
