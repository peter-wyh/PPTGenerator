/**
 * 上游达人（Creator / Influencer）接口。
 * Phase A: 完全走后端 DB（/api/v1/campaigns/creators），不再 fallback mock / DataRecord。
 * metrics 为达人自身频道 KPI（Avg Reach/Impressions/Follower Growth/CPM）。
 */
import type { Creator } from '@mediaket/shared';
import type { CollaborationData } from '@mediaket/shared';
import { campaignsApi, dtoToCreator } from './campaignsApi';
import { getCampaign } from './campaigns';
import { getCollaboration } from './collaborations';
import type { CreatorWorkPost } from './analytics/creatorPerformance';

export type { Creator };

/** 从后端 DB 拉取达人列表。 */
export async function listCreators(): Promise<Creator[]> {
  const dtos = await campaignsApi.listCreators();
  return dtos.map(dtoToCreator);
}

/** 按 id 取单个达人；不存在返回 undefined。 */
export async function getCreator(id: string): Promise<Creator | undefined> {
  try {
    const dto = await campaignsApi.getCreator(id);
    return dtoToCreator(dto);
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
      const posts: CreatorWorkPost[] = (collab?.deliverables ?? []).map((d, i) => {
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
          daily: d.daily,
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
 * 完全从 CampaignCreator 中间表查询。
 */
export async function listCampaignCollaborators(campaignId: string): Promise<Creator[]> {
  const dtos = await campaignsApi.listLinks(campaignId);
  const creators: Creator[] = [];
  for (const link of dtos) {
    if (link.creator) {
      creators.push(dtoToCreator(link.creator));
    }
  }
  return creators;
}

// 兼容旧引用：如果 campaign 没有 creatorIds，返回空数组
void getCampaign;
