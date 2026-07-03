import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEditorStore } from '@/editor/store';
import { getDefaultData } from '@/editor/defaults';
import { REGISTRY } from '@/editor/registry';
import { TEMPLATES } from '@/editor/templates';
import type { ProjectDetail } from '@mediakit/shared';
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
        data={{ avatar: '', name: 'Mia Chen', platform: 'tiktok', tier: 'macro', intro: 'hi' }}
      />,
    );
    expect(screen.getByText('Mia Chen')).toBeInTheDocument();
    expect(screen.getByText('TikTok')).toBeInTheDocument();
    expect(screen.getByText(/Macro/)).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument(); // 头像占位 = 名字首字母
  });

  it('stats strip renders each stat label + value', () => {
    render(
      <CreatorStatsStrip
        data={{
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

  it('works list renders title + cover placeholder when no cover url', () => {
    render(
      <CreatorWorksList
        data={{
          headers: ['封面', '标题', '转', '赞', '评'],
          rows: [['', '7 天肌肤日记', '1.2K', '86K', '2.4K']],
        }}
      />,
    );
    expect(screen.getByText('7 天肌肤日记')).toBeInTheDocument();
    expect(screen.getByText('作品封面')).toBeInTheDocument(); // 缺封面占位
  });
});

describe('creator business components — defaults / registry', () => {
  it('getDefaultData returns expected shapes', () => {
    const avatar = getDefaultData('creator-avatar-card');
    expect(avatar).toHaveProperty('name');
    expect(avatar).toHaveProperty('platform');

    const stats = getDefaultData('creator-stats-strip') as { stats: unknown[] };
    expect(Array.isArray(stats.stats)).toBe(true);
    expect(stats.stats.length).toBeGreaterThan(0);

    const works = getDefaultData('creator-works-list') as { headers: string[]; rows: string[][] };
    expect(works.headers.length).toBe(5);
    expect(works.rows.length).toBeGreaterThan(0);
  });

  it('REGISTRY has the 3 creator types with non-empty propertySchema', () => {
    for (const t of ['creator-avatar-card', 'creator-stats-strip', 'creator-works-list'] as const) {
      expect(REGISTRY[t]).toBeDefined();
      expect(REGISTRY[t].propertySchema.length).toBeGreaterThan(0);
    }
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
