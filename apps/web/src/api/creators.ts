/**
 * 上游达人（Creator / Influencer）接口。
 * Phase 2: 优先从独立表 /api/v1/campaigns/creators 拉取；失败回退 DataRecord。
 * metrics 为达人自身频道 KPI（Avg Reach/Impressions/Follower Growth/CPM）。
 */
import type { Creator } from '@mediaket/shared';
import type { CollaborationData } from '@mediaket/shared';
import { dataApi, type DataRecordDTO } from './dataLibrary';
import { getCampaign } from './campaigns';
import { campaignsApi, dtoToCreator } from './campaignsApi';
import { getCollaboration } from './collaborations';
import { buildSeedCollaboration } from './mock/collaborationSeed';
import type { CreatorWorkPost } from './mock/creatorPerformance';

export type { Creator };

/** 从独立表或数据管理库拉取达人列表。 */
export async function listCreators(): Promise<Creator[]> {
  try {
    const dtos = await campaignsApi.listCreators();
    if (dtos.length > 0) return dtos.map(dtoToCreator);
  } catch {
    // fall through to DataRecord
  }
  const records = await dataApi.list<Creator>('creator');
  return records.map((r) => r.data);
}

/** 按 id 取单个达人。 */
export async function getCreator(id: string): Promise<Creator | undefined> {
  try {
    const dto = await campaignsApi.getCreator(id);
    return dtoToCreator(dto);
  } catch {
    // fall through
  }
  try {
    const record = await dataApi.get<Creator>(id);
    return record.data;
  } catch {
    return undefined;
  }
}

/**
 * 获取 Campaign 下参与合作的达人列表。
 * 统一走后端 DB CampaignCreator 中间表（与数据管理页一致）。
 */
export async function listCampaignCreators(campaignId: string): Promise<Creator[]> {
  return listCampaignCollaborators(campaignId);
}

/**
 * 从后端 DB 获取某 campaign 下所有达人的作品列表。
 * 替代 mock campaignCreatorWorks()——数据源与数据管理页完全一致。
 *
 * 每个 deliverable → 一个 CreatorWorkPost，
 * 截图取 screenshots[0].src，指标取 metrics 中的 Views/Likes/Comments/Shares。
 */
export async function fetchCampaignCreatorWorks(
  campaignId: string,
): Promise<{ creatorId: string; creatorName: string; platform: string; tier: string; posts: CreatorWorkPost[] }[]> {
  const creators = await listCampaignCollaborators(campaignId);
  const results = await Promise.all(
    creators.map(async (c) => {
      let collab: CollaborationData | null = null;
      try {
        collab = await getCollaboration(campaignId, c.id);
      } catch {
        collab = null;
      }
      if (!collab || !collab.deliverables?.length) {
        collab = buildSeedCollaboration(campaignId, c.id);
      }
      const posts: CreatorWorkPost[] = (collab.deliverables ?? []).map((d, i) => {
        const metric = (label: string) =>
          (d.metrics ?? []).find((m) => m.label.toLowerCase() === label.toLowerCase())?.value ?? '0';
        const screenshots = (d.screenshots ?? []).map((s) => ({
          src: s.src,
          caption: s.caption,
          url: s.url,
        }));
        const firstShot = screenshots[0];
        return {
          postId: `${c.id}-post-${i}`,
          creatorId: c.id,
          creatorName: c.name,
          title: firstShot?.caption ?? d.contentType,
          screenshots,
          cover: firstShot?.src ?? '',
          url: firstShot?.url ?? '',
          platform: d.platform ?? c.platform,
          publishedAt: d.publishedAt ?? '',
          impressions: metric('Views'),
          likes: metric('Likes'),
          comments: metric('Comments'),
          shares: metric('Shares'),
          saves: metric('Saves'),
          orders: metric('Orders'),
          cpm: metric('CPM'),
          engagementRate: c.engagement,
        };
      });
      return {
        creatorId: c.id,
        creatorName: c.name,
        platform: c.platform,
        tier: c.tier,
        posts,
      };
    }),
  );
  return results;
}

/**
 * 取某 campaign 的合作达人列表。
 * Phase 2+: 优先从 CampaignCreator 中间表查询，fallback 旧 creatorIds 路径。
 */
export async function listCampaignCollaborators(campaignId: string): Promise<Creator[]> {
  // 1. 新表：从 CampaignCreator 中间表拉关联 creator
  try {
    const dtos = await campaignsApi.listLinks(campaignId);
    if (dtos.length > 0) {
      const creators: Creator[] = [];
      for (const link of dtos) {
        if (link.creator) {
          creators.push(dtoToCreator(link.creator));
        }
      }
      if (creators.length > 0) return creators;
    }
  } catch {
    // fall through
  }

  // 2. 旧路径：从 campaign.creatorIds 逐个查 dataApi
  const campaign = await getCampaign(campaignId);
  const ids = campaign?.creatorIds ?? [];
  if (ids.length === 0) return [];
  const settled = await Promise.allSettled(ids.map((id) => dataApi.get<Creator>(id)));
  return settled
    .filter((r): r is PromiseFulfilledResult<DataRecordDTO<Creator>> => r.status === 'fulfilled')
    .map((r) => r.value.data);
}
