// kpi-board 默认图标：按指标名关键词匹配 catalog key。纯字符串匹配，无外部依赖。

interface Rule {
  re: RegExp;
  icon: string;
}

// 顺序敏感：先 cart 再 currency，避免「销量」误判为金额；sales→currency、销量→cart 分开。
// percent 规则只用「率」，避免「环比/对比」里的「比」误匹配。
const RULES: Rule[] = [
  { re: /转化|conversion|convert|order|订单|purchase|购买|销量|成交|cart/i, icon: 'cart' },
  { re: /曝光|impression|view|reach|展示|观看|播放|play/i, icon: 'eye' },
  { re: /点击|click|tap/i, icon: 'target' },
  { re: /粉丝|follower|fan|关注|受众|audience/i, icon: 'users' },
  { re: /点赞|like|heart|互动|engagement/i, icon: 'heart' },
  { re: /分享|share/i, icon: 'share' },
  { re: /评论|comment|chat/i, icon: 'chat' },
  { re: /roas|roi|cvr|ctr|rate|ratio|率/i, icon: 'percent' },
  { re: /gmv|revenue|sales|销售|commission|spend|cost|aov|收入|营收|佣金|花费|消耗|客单|金额|预算|投放|费用|成本/i, icon: 'currency' },
  { re: /增长|trend|上升|growth/i, icon: 'trend-up' },
  { re: /达成|trophy|完成/i, icon: 'trophy' },
  { re: /热度|hot|fire|热门/i, icon: 'fire' },
];

const FALLBACK = 'target';

/** 按指标名返回默认图标 catalog key；无匹配回退 'target'。 */
export function defaultIconFor(label: string): string {
  for (const { re, icon } of RULES) {
    if (re.test(label)) return icon;
  }
  return FALLBACK;
}
