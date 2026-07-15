interface Props {
  name: string;
  avatar?: string;
  size: number;
}

/** 达人头像:有 URL 显图,无则首字母圆形兜底。列表(小)与详情浮窗(大)共用。 */
export function CreatorAvatar({ name, avatar, size }: Props) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        draggable={false}
        style={{ width: size, height: size }}
        className="flex-none rounded-full object-cover"
      />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-primary/10 text-primary"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {name?.slice(0, 1) || '?'}
    </div>
  );
}
