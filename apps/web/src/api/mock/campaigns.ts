/**
 * Campaign mock data (demo).
 * Extracted from original api/campaigns.ts to keep data & generation logic centralized.
 * metrics are no longer hardcoded but rolled up from creator performance (campaign = Σ creators),
 * keeping self-consistency with creator details (creatorPerformance.cps).
 *
 * **Multi-platform support**: each campaign now declares a `platforms` array with per-platform
 * collaboration types. The legacy `platform` field is kept as the primary platform for backward compat.
 */
import type { Campaign } from '@mediakit/shared';
import { rollupCampaignMetrics, campaignPlatforms } from './creatorPerformance';

/** Campaign static mock list with multi-platform configuration. */
export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-glowlab-q4',
    name: 'GlowLab Q4 Sensitive Skin Serum Launch',
    advertiser: 'GlowLab',
    businessLine: 'FT',
    platform: 'TikTok',
    platforms: campaignPlatforms('camp-glowlab-q4'),
    startDate: '2026-10-12',
    endDate: '2026-11-10',
    budget: '¥300K',
    status: 'Active',
    owner: 'alex',
    metrics: rollupCampaignMetrics('camp-glowlab-q4'),
  },
  {
    id: 'camp-lumiere-launch',
    name: 'LUMIÈRE Anti-Aging Cream Launch',
    advertiser: 'LUMIÈRE',
    businessLine: 'SM',
    platform: 'TikTok',
    platforms: campaignPlatforms('camp-lumiere-launch'),
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    budget: '¥520K',
    status: 'Completed',
    owner: 'stella',
    metrics: rollupCampaignMetrics('camp-lumiere-launch'),
  },
  {
    id: 'camp-nova-home-618',
    name: 'NOVA Home 618 Home Goods Mega Sale',
    advertiser: 'NOVA Home',
    businessLine: 'CX',
    platform: 'Instagram',
    platforms: campaignPlatforms('camp-nova-home-618'),
    startDate: '2026-05-20',
    endDate: '2026-06-20',
    budget: '¥780K',
    status: 'Completed',
    owner: 'reese',
    metrics: rollupCampaignMetrics('camp-nova-home-618'),
  },
  {
    id: 'camp-motion-spring',
    name: 'MOTION Spring Sports Seeding Campaign',
    advertiser: 'MOTION',
    businessLine: 'DG',
    platform: 'YouTube',
    platforms: campaignPlatforms('camp-motion-spring'),
    startDate: '2026-03-01',
    endDate: '2026-04-15',
    budget: '¥260K',
    status: 'Completed',
    owner: 'stacey',
    metrics: rollupCampaignMetrics('camp-motion-spring'),
  },
  {
    id: 'camp-everyday-bf',
    name: 'EVERYDAY Black Friday Gift Explosion',
    advertiser: 'EVERYDAY',
    businessLine: 'KN',
    platform: 'TikTok',
    platforms: campaignPlatforms('camp-everyday-bf'),
    startDate: '2026-11-20',
    endDate: '2026-12-25',
    budget: '¥440K',
    status: 'Planning',
    owner: 'alex',
    metrics: rollupCampaignMetrics('camp-everyday-bf'),
  },
  {
    id: 'camp-wander-summer',
    name: 'WANDER Summer Travel Content Marketing',
    advertiser: 'WANDER',
    businessLine: 'DM',
    platform: 'YouTube',
    platforms: campaignPlatforms('camp-wander-summer'),
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    budget: '¥360K',
    status: 'Active',
    owner: 'stella',
    metrics: rollupCampaignMetrics('camp-wander-summer'),
  },
];
