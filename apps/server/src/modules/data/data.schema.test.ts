import { describe, it, expect } from 'vitest';
import {
  campaignRecordDataSchema,
  creatorRecordDataSchema,
  collaborationRecordDataSchema,
  dataSchemaForKind,
  kindSchema,
  createDataSchema,
  importDataSchema,
  updateDataSchema,
} from './data.schema';

const validCampaign = {
  id: 'camp-x',
  name: 'Campaign X',
  advertiser: 'GlowLab',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  budget: '$100K',
};
const validCreator = {
  id: 'cre-x',
  name: 'Mia',
  handle: '@mia',
  platform: 'TikTok',
  tier: 'mega',
  followers: '1.28M',
  engagement: '8.7%',
  category: 'Beauty',
  region: 'US',
};

describe('data.schema · kindSchema', () => {
  it('接受 campaign / creator,拒绝其它', () => {
    expect(kindSchema.parse('campaign')).toBe('campaign');
    expect(kindSchema.parse('creator')).toBe('creator');
    expect(() => kindSchema.parse('product')).toThrow();
  });
});

describe('data.schema · campaignRecordDataSchema(镜像 Campaign)', () => {
  it('合法 campaign(含可选 metrics/platforms)通过', () => {
    const c = { ...validCampaign, status: 'Active', owner: 'alex', metrics: [{ label: 'GMV', value: '$1', compare: '+1%' }], platforms: [{ platform: 'TikTok', collaborationType: 'Content' }] };
    expect(campaignRecordDataSchema.parse(c)).toEqual(c);
  });
  it('缺必填 name → 报错', () => {
    const { name, ...bad } = validCampaign;
    expect(() => campaignRecordDataSchema.parse(bad)).toThrow();
  });
  it('metrics 项缺 compare → 报错(CampaignMetric 三字段必填)', () => {
    const c = { ...validCampaign, metrics: [{ label: 'GMV', value: '$1' }] };
    expect(() => campaignRecordDataSchema.parse(c)).toThrow();
  });
});

describe('data.schema · creatorRecordDataSchema(镜像 Creator)', () => {
  it('合法 creator(含 avatar + metrics[])通过', () => {
    const cr = { ...validCreator, avatar: 'https://x', metrics: [{ label: 'Avg Reach', value: '1M', compare: '' }] };
    expect(creatorRecordDataSchema.parse(cr)).toEqual(cr);
  });
  it('缺 metrics → 报错(Creator.metrics 必填)', () => {
    const { metrics, ...bad } = { ...validCreator, metrics: [] } as Record<string, unknown>;
    void metrics;
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });
  it('缺必填 tier → 报错', () => {
    const { tier, ...bad } = validCreator;
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });

  const validMetrics = [{ label: 'Avg Reach', value: '1M', compare: '' }];
  const validCreatorWithRich = {
    ...validCreator,
    metrics: validMetrics,
    audience: {
      genderSplit: [{ label: 'Female', value: 53 }, { label: 'Male', value: 47 }],
      ageRange: [{ label: '25-34', value: 40 }],
      topCities: [{ label: '上海', value: 32, color: '#6366f1' }],
    },
    works: [
      { id: 'w1', title: 'Routine', cover: 'https://x/c.png', platform: 'TikTok', publishedAt: '2026-01-01', impressions: '1.2M', likes: '96K', comments: '1.2K', shares: '3K', engagementRate: '8.0%' },
    ],
    stats: [
      { key: 'followers', label: 'Followers', value: '1.28M', color: '#6366f1' },
      { label: 'Engagement', value: '8.7%', color: '#10b981' },
    ],
  };

  it('合法 creator 含 audience/works/stats → 通过', () => {
    expect(creatorRecordDataSchema.parse(validCreatorWithRich)).toEqual(validCreatorWithRich);
  });

  it('audience.genderSplit 项缺 label → 报错', () => {
    const bad = { ...validCreator, metrics: validMetrics, audience: { genderSplit: [{ value: 50 }] } };
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });

  it('works 项缺必填 id → 报错', () => {
    const bad = { ...validCreator, metrics: validMetrics, works: [{ title: 'no id' }] };
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });

  it('stats 项缺必填 color → 报错', () => {
    const bad = { ...validCreator, metrics: validMetrics, stats: [{ label: 'Followers', value: '1M' }] };
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });

  it('audience/works/stats 全缺(只基本字段)→ 仍通过(全可选)', () => {
    const cr = { ...validCreator, metrics: validMetrics };
    expect(creatorRecordDataSchema.parse(cr)).toEqual(cr);
  });
});

describe('data.schema · 端点入参 schema', () => {
  it('createDataSchema: kind + data(unknown)通过', () => {
    expect(createDataSchema.parse({ kind: 'campaign', data: validCampaign })).toEqual({ kind: 'campaign', data: validCampaign });
  });
  it('importDataSchema: kind + items[] 通过', () => {
    const r = importDataSchema.parse({ kind: 'creator', items: [validCreator] });
    expect(r.items).toHaveLength(1);
  });
  it('importDataSchema: items 非数组 → 报错', () => {
    expect(() => importDataSchema.parse({ kind: 'creator', items: {} })).toThrow();
  });
  it('updateDataSchema: { data } 通过', () => {
    expect(updateDataSchema.parse({ data: validCampaign })).toEqual({ data: validCampaign });
  });
});

describe('data.schema · campaignRecordDataSchema · creatorIds', () => {
  it('接受 creatorIds: string[]', () => {
    const c = { ...validCampaign, creatorIds: ['cre-mia', 'cre-sofia'] };
    expect(campaignRecordDataSchema.parse(c)).toEqual(c);
  });
  it('creatorIds 非数组(字符串)→ 报错', () => {
    const c = { ...validCampaign, creatorIds: 'cre-mia' };
    expect(() => campaignRecordDataSchema.parse(c)).toThrow();
  });
  it('无 creatorIds 仍通过(可选)', () => {
    expect(campaignRecordDataSchema.parse(validCampaign)).toEqual(validCampaign);
  });
});

describe('data.schema · collaborationRecordDataSchema', () => {
  const validCollab = {
    id: 'collab:c1:cr1',
    campaignId: 'c1',
    creatorId: 'cr1',
    deliverables: [
      { contentType: 'post', screenshots: [{ src: 'a.jpg' }], metrics: [{ label: '播放', value: '1.2M' }] },
      { contentType: 'reels', wordcloud: [{ text: '种草', weight: 80, sentiment: 'pos' }] },
    ],
  };
  it('合法 collaboration 通过', () => {
    expect(collaborationRecordDataSchema.parse(validCollab)).toEqual(validCollab);
  });
  it('kindSchema 接受 collaboration', () => {
    expect(kindSchema.parse('collaboration')).toBe('collaboration');
  });
  it('dataSchemaForKind(collaboration) 返回 collaboration schema', () => {
    expect(dataSchemaForKind('collaboration')).toBe(collaborationRecordDataSchema);
  });
  it('缺 id / campaignId / creatorId → 报错', () => {
    const { id, ...noId } = validCollab;
    expect(() => collaborationRecordDataSchema.parse(noId)).toThrow();
    expect(() => collaborationRecordDataSchema.parse({ ...validCollab, campaignId: '' })).toThrow();
    expect(() => collaborationRecordDataSchema.parse({ ...validCollab, creatorId: '' })).toThrow();
  });
  it('空 deliverables → 报错', () => {
    expect(() => collaborationRecordDataSchema.parse({ ...validCollab, deliverables: [] })).toThrow();
  });
  it('未知 contentType → 报错', () => {
    expect(() =>
      collaborationRecordDataSchema.parse({ ...validCollab, deliverables: [{ contentType: 'bogus' }] }),
    ).toThrow();
  });
});

describe('creatorRecordDataSchema rich fields', () => {
  const baseCreator = {
    id: 'cre-x', name: 'X', handle: '@x', platform: 'TikTok', tier: 'macro',
    followers: '100K', engagement: '7%', category: 'Beauty', region: 'US',
    metrics: [{ label: 'Avg Reach', value: '720K', compare: '' }],
  };

  it('accepts bio/tags/contact/rate', () => {
    const parsed = creatorRecordDataSchema.parse({
      ...baseCreator,
      bio: '简介文本',
      tags: ['美妆', '种草'],
      contact: { mcn: 'MCN-A', email: 'biz@x.com', phone: '+1-555', contactPerson: 'Ann' },
      rate: { currency: 'USD', post: '$1,000', video: '$3,000', live: '$8,000', note: '打包可议' },
    });
    expect(parsed.bio).toBe('简介文本');
    expect(parsed.tags).toEqual(['美妆', '种草']);
    expect(parsed.contact?.mcn).toBe('MCN-A');
    expect(parsed.rate?.video).toBe('$3,000');
  });

  it('accepts works with contentType/hashtags/productLink/attribution/duration/featured', () => {
    const parsed = creatorRecordDataSchema.parse({
      ...baseCreator,
      works: [{
        id: 'w1', title: 'T',
        contentType: 'video',
        hashtags: ['#glow'],
        productLink: 'https://shop.example.com/p',
        attribution: { clicks: '1.2K', orders: '34', gmv: '$2,100', ctr: '3.4%', cvr: '2.8%' },
        duration: '01:12', featured: true,
      }],
    });
    expect(parsed.works?.[0].contentType).toBe('video');
    expect(parsed.works?.[0].attribution?.gmv).toBe('$2,100');
    expect(parsed.works?.[0].featured).toBe(true);
  });

  it('rejects malformed contact (email too long)', () => {
    expect(() => creatorRecordDataSchema.parse({
      ...baseCreator,
      contact: { email: 'x'.repeat(400) },
    })).toThrow();
  });
});
