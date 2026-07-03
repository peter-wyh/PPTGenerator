import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEditorStore } from '@/editor/store';
import { getDefaultData } from '@/editor/defaults';
import { REGISTRY } from '@/editor/registry';
import { TEMPLATES } from '@/editor/templates';
import type { ProjectDetail, CreatorStatsStripData } from '@mediakit/shared';
import {
  CreatorAvatarCard,
  CreatorStatsStrip,
  CreatorWorksList,
} from '@/editor/components/CreatorComponents';

const emptyProject: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

describe('creator business components — render', () => {
  it('avatar card renders name + platform + tier, falls back to initial when no avatar', () => {
    render(
      <CreatorAvatarCard
        data={{ variant: 'horizontal', avatar: '', name: 'Mia Chen', platform: 'tiktok', tier: 'macro', intro: 'hi' }}
      />,
    );
    expect(screen.getByText('Mia Chen')).toBeInTheDocument();
    expect(screen.getByText('TikTok')).toBeInTheDocument();
    expect(screen.getByText(/Macro/)).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument(); // 头像占位 = 名字首字母
  });

  it('avatar card renders KPI line when followers/likes/engagement present (horizontal & vertical)', () => {
    const data = {
      variant: 'horizontal' as const,
      avatar: '',
      name: 'Mia',
      platform: 'tiktok' as const,
      tier: 'macro' as const,
      intro: 'hi',
      followers: '1.28M',
      likes: '12.4M',
      engagement: '8.7%',
    };
    const { rerender } = render(<CreatorAvatarCard data={data} />);
    expect(screen.getByText(/粉丝 1\.28M/)).toBeInTheDocument();
    expect(screen.getByText(/获赞 12\.4M/)).toBeInTheDocument();
    expect(screen.getByText(/互动 8\.7%/)).toBeInTheDocument();

    // 切到竖排同样展示
    rerender(<CreatorAvatarCard data={{ ...data, variant: 'vertical' }} />);
    expect(screen.getByText(/粉丝 1\.28M/)).toBeInTheDocument();
  });

  it('avatar card omits KPI line when no stats, and compact never shows it', () => {
    const { rerender } = render(
      <CreatorAvatarCard
        data={{ variant: 'horizontal', avatar: '', name: 'Mia', platform: 'tiktok', tier: 'macro', intro: 'hi' }}
      />,
    );
    expect(screen.queryByText(/粉丝/)).toBeNull();

    rerender(
      <CreatorAvatarCard
        data={{
          variant: 'compact',
          avatar: '',
          name: 'Mia',
          platform: 'tiktok',
          tier: 'macro',
          intro: 'hi',
          followers: '1.28M',
        }}
      />,
    );
    expect(screen.queryByText(/粉丝/)).toBeNull();
  });

  it('stats strip renders each stat label + value', () => {
    render(
      <CreatorStatsStrip
        data={{
          variant: 'cards',
          stats: [
            { label: '粉丝', value: '1.28M', color: '#FF5C00' },
            { label: '互动率', value: '8.7%', color: '#3B82F6' },
          ],
        }}
      />,
    );
    expect(screen.getByText('粉丝')).toBeInTheDocument();
    expect(screen.getByText('1.28M')).toBeInTheDocument();
    expect(screen.getByText('互动率')).toBeInTheDocument();
  });

  it('stats strip hides items with selected:false', () => {
    render(
      <CreatorStatsStrip
        data={{
          variant: 'cards',
          stats: [
            { label: '粉丝', value: '1.28M', color: '#FF5C00' },
            { label: '互动率', value: '8.7%', color: '#3B82F6', selected: false },
          ],
        }}
      />,
    );
    expect(screen.getByText('粉丝')).toBeInTheDocument();
    expect(screen.queryByText('互动率')).not.toBeInTheDocument();
  });

  it('stats strip shows all items when selected absent (backward compat)', () => {
    render(
      <CreatorStatsStrip
        data={{
          variant: 'metric',
          stats: [
            { label: '粉丝', value: '1M', color: '#FF5C00' },
            { label: '曝光', value: '2M', color: '#8B5CF6' },
          ],
        }}
      />,
    );
    expect(screen.getByText('粉丝')).toBeInTheDocument();
    expect(screen.getByText('曝光')).toBeInTheDocument();
  });

  it('works list renders title + cover placeholder when no cover url', () => {
    render(
      <CreatorWorksList
        data={{
          variant: 'cards',
          headers: ['封面', '标题', '转', '赞', '评'],
          rows: [['', '7 天肌肤日记', '1.2K', '86K', '2.4K']],
        }}
      />,
    );
    expect(screen.getByText('7 天肌肤日记')).toBeInTheDocument();
    expect(screen.getByText('作品封面')).toBeInTheDocument(); // 缺封面占位
  });

  it('every variant of every component renders without throwing', () => {
    const avatarBase = { avatar: '', name: 'Mia', platform: 'tiktok', tier: 'macro', intro: 'x' } as const;
    for (const v of ['horizontal', 'vertical', 'compact'] as const) {
      const { unmount } = render(<CreatorAvatarCard data={{ variant: v, ...avatarBase }} />);
      expect(screen.getByText('Mia')).toBeInTheDocument();
      unmount();
    }
    const statsBase = { stats: [{ label: '粉丝', value: '1M', color: '#FF5C00' }] };
    for (const v of ['cards', 'plain', 'metric'] as const) {
      const { unmount } = render(<CreatorStatsStrip data={{ variant: v, ...statsBase }} />);
      expect(screen.getByText('粉丝')).toBeInTheDocument();
      unmount();
    }
    const worksBase = { headers: ['封面', '标题', '转'], rows: [['', 't', '1']] };
    for (const v of ['cards', 'row', 'compact'] as const) {
      const { unmount } = render(<CreatorWorksList data={{ variant: v, ...worksBase }} />);
      expect(screen.getByText('t')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('creator business components — defaults / registry', () => {
  it('getDefaultData returns expected shapes (incl. variant)', () => {
    expect(getDefaultData('creator-avatar-card')).toMatchObject({ variant: 'horizontal', name: expect.any(String) });

    const stats = getDefaultData('creator-stats-strip') as { variant: string; stats: unknown[] };
    expect(stats.variant).toBe('cards');
    expect(Array.isArray(stats.stats)).toBe(true);

    const works = getDefaultData('creator-works-list') as { variant: string; headers: string[]; rows: string[][] };
    expect(works.variant).toBe('cards');
    expect(works.headers.length).toBe(5);
  });

  it('REGISTRY has the 3 creator types with variants', () => {
    for (const t of ['creator-avatar-card', 'creator-stats-strip', 'creator-works-list'] as const) {
      expect(REGISTRY[t]).toBeDefined();
      expect(REGISTRY[t].variants?.length).toBeGreaterThanOrEqual(2);
    }
    // avatar-card / works-list 仍走通用 propertySchema；stats-strip 改由自定义区块负责。
    expect(REGISTRY['creator-avatar-card'].propertySchema.length).toBeGreaterThan(0);
    expect(REGISTRY['creator-works-list'].propertySchema.length).toBeGreaterThan(0);
  });

  it('creator-stats-strip default stats carry catalog keys + selected:true', () => {
    const data = getDefaultData('creator-stats-strip') as CreatorStatsStripData;
    const keys = data.stats.map((s) => s.key);
    expect(keys).toEqual(['followers', 'engagement', 'reach', 'impressions']);
    expect(data.stats.every((s) => s.selected === true)).toBe(true);
  });
});

describe('creator business components — added via addComponent (first-class type)', () => {
  beforeEach(() => useEditorStore.getState().loadProject(emptyProject, 'p'));

  it('addComponent drops a creator-avatar-card onto the current page', () => {
    useEditorStore.getState().addComponent('creator-avatar-card');
    const comps = useEditorStore.getState().currentComponents();
    expect(comps).toHaveLength(1);
    expect(comps[0].type).toBe('creator-avatar-card');
    expect(comps[0].data).toHaveProperty('name');
  });
});

describe('creator-page template', () => {
  it('composes title + 3 creator components', () => {
    const tpl = TEMPLATES.find((t) => t.id === 'creator-page');
    expect(tpl).toBeDefined();
    const comps = tpl!.components();
    expect(comps.length).toBeGreaterThanOrEqual(4);
    const types = comps.map((c) => c.type);
    expect(types).toContain('creator-avatar-card');
    expect(types).toContain('creator-stats-strip');
    expect(types).toContain('creator-works-list');
    expect(types.filter((t) => t === 'text').length).toBeGreaterThanOrEqual(1);
  });
});
