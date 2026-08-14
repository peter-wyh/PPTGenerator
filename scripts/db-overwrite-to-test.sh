#!/bin/bash
# scripts/db-overwrite-to-test.sh
#
# 以本地数据库为准，覆盖测试环境「数据」（结构不动，仅替换数据行）。
#   - mysqldump --replace → REPLACE INTO：主键(cuid)相同的行先删后插 = 覆盖
#   - 本地没有的测试库行 → 保留（不会误删测试环境独有数据）
#   - _prisma_migrations 不动（测试库迁移历史是它自己的运行状态）
#
# 用法：
#   LOCAL_ONLY=1 ./scripts/db-overwrite-to-test.sh
#     只连本地库生成覆盖 SQL，不碰测试库（用于产出交给运维的 .final.sql）
#
#   TEST_DATABASE_URL=mysql://user:pass@host:port/db  ./scripts/db-overwrite-to-test.sh
#     APPLY=0 (默认)    dry-run：备份测试库 + 生成覆盖 SQL + 行数对比，不灌入
#     APPLY=1           实际灌入测试库
#     KEEP_TEST_USERS=1 保留测试库 User 表不动（不覆盖账号/密码）
#     LOCAL_ENV=./.env  本地连接来源（默认仓库根 .env）
#
# 客户端：本地若宿主无 mysqldump/mysql，自动改走 `docker compose exec mysql …`
#         （本地 MySQL 在容器里）。测试库操作要求执行机已装 mysql/mysqldump client。
#
# 前置：测试库结构须已与本地对齐（12 正式迁移 + 8 张 drift 表）。见 docs/DATABASE_MIGRATION.sql。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_ENV="${LOCAL_ENV:-$ROOT/.env}"
APPLY="${APPLY:-0}"
LOCAL_ONLY="${LOCAL_ONLY:-0}"
KEEP_TEST_USERS="${KEEP_TEST_USERS:-0}"
OUT="$ROOT/scripts/.db-sync"
TS="$(date +%Y%m%d_%H%M%S)"

log()  { echo "=== $* ==="; }
warn() { echo "[warn] $*"; }
die()  { echo "[error] $*" >&2; exit 1; }

# ── 1. 本地连接（从 .env 读 MYSQL_*；宿主无 client 则走 docker exec）────
[ -f "$LOCAL_ENV" ] || die "找不到本地 env: $LOCAL_ENV"
# shellcheck disable=SC1090
set -a; source "$LOCAL_ENV"; set +a
: "${MYSQL_PORT:?.$LOCAL_ENV 缺 MYSQL_PORT}"
: "${MYSQL_USER:?.$LOCAL_ENV 缺 MYSQL_USER}"
: "${MYSQL_PASSWORD:?.$LOCAL_ENV 缺 MYSQL_PASSWORD}"
: "${MYSQL_DATABASE:?.$LOCAL_ENV 缺 MYSQL_DATABASE}"

if command -v mysqldump >/dev/null 2>&1 && command -v mysql >/dev/null 2>&1; then
  # 宿主有 client → 连映射端口
  LOCAL_DUMP=(mysqldump)
  LOCAL_MYSQL=(mysql)
  LOCAL_CONN=(-h 127.0.0.1 -P "$MYSQL_PORT" -u "$MYSQL_USER")
  export MYSQL_PWD="$MYSQL_PASSWORD"
  LOCAL_HOW="host client @ 127.0.0.1:$MYSQL_PORT"
else
  # 宿主无 client → docker compose exec 进 mysql 容器，连容器内 socket
  DC=(docker compose -f "$ROOT/docker-compose.yml" exec -T -e "MYSQL_PWD=$MYSQL_PASSWORD" mysql)
  LOCAL_DUMP=("${DC[@]}" mysqldump)
  LOCAL_MYSQL=("${DC[@]}" mysql)
  LOCAL_CONN=(-u "$MYSQL_USER")
  LOCAL_HOW="docker exec → mysql container"
fi

# ── 2. 测试库连接（LOCAL_ONLY=1 时跳过）──────────────────────
if [ "$LOCAL_ONLY" = "1" ]; then
  log "LOCAL_ONLY=1 → 只连本地库，不碰测试库"
else
  : "${TEST_DATABASE_URL:?请设置 TEST_DATABASE_URL=mysql://user:pass@host:port/db（或 LOCAL_ONLY=1 只生成本地 dump）}"
  url="${TEST_DATABASE_URL#*://}"             # user:pass@host:port/db[?...]
  url="${url%%\?*}"                           # 去掉 ?query
  userinfo="${url%%@*}"                       # user:pass
  hostinfo="${url#*@}"                        # host:port/db (或 host/db)
  TEST_USER="${userinfo%%:*}"
  TEST_PASS="${userinfo#*:}"                  # 密码可能含 ':'，取首个冒号后全部
  if [[ "$hostinfo" == *:* ]]; then
    TEST_HOST="${hostinfo%%:*}"
    after="${hostinfo#*:}"                    # port/db
    TEST_PORT="${after%%/*}"
  else
    TEST_HOST="${hostinfo%%/*}"
    TEST_PORT=3306
  fi
  TEST_NAME="${hostinfo##*/}"
  export MYSQL_PWD="$TEST_PASS"
  TEST=(-h "$TEST_HOST" -P "$TEST_PORT" -u "$TEST_USER")
fi

# ── 3. 自检打印 ──────────────────────────────────────────────
log "本地: $MYSQL_DATABASE  ($LOCAL_HOW)"
if [ "$LOCAL_ONLY" != "1" ]; then
  log "测试: $TEST_HOST:$TEST_PORT / $TEST_NAME"
  log "测试库 _prisma_migrations（应为 up to date，drift 表已补）："
  mysql "${TEST[@]}" "$TEST_NAME" \
    -e "SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY migration_name;" \
    || warn "读不到 _prisma_migrations —— 测试库可能还没 migrate deploy，REPLACE 大概率会失败"
fi

mkdir -p "$OUT"
BACKUP="$OUT/test_backup_$TS.sql"
DUMP="$OUT/local_overwrite_$TS.sql"
FINAL="$OUT/local_overwrite_$TS.final.sql"

# 按外键依赖拓扑排序（FK_CHECKS=0 时顺序无关，这里仅便于阅读行数对比）
TABLES=(User Merchant BusinessLine Advertiser Project HtmlVersion Template \
        DataRecord Creator Campaign CampaignCreator CreatorPerformance \
        Collaboration CpsPerformance ReportScheme HtmlTemplate)

# ── 4. 备份测试库（LOCAL_ONLY 跳过）──────────────────────────
if [ "$LOCAL_ONLY" != "1" ]; then
  log "备份测试库 → $BACKUP"
  mysqldump "${TEST[@]}" "$TEST_NAME" \
    --single-transaction --routines --triggers --no-tablespaces > "$BACKUP"
  [ -s "$BACKUP" ] || die "测试库备份为空，已中止（未做任何写入）"
fi

# ── 5. 从本地生成「以本地为准」的覆盖 SQL（REPLACE INTO）──────
IGNORE=(--ignore-table="$MYSQL_DATABASE._prisma_migrations")
[ "$KEEP_TEST_USERS" = "1" ] && IGNORE+=(--ignore-table="$MYSQL_DATABASE.User")

log "本地 dump → $DUMP"
#   --replace              INSERT → REPLACE INTO：同主键先删后插 = 覆盖
#   --complete-insert      带列名，防 drift 导致列错位
#   --no-create-info       不重建表，保留测试库结构
#   --set-gtid-purged=OFF  跨实例灌入不报 GTID 错
"${LOCAL_DUMP[@]}" "${LOCAL_CONN[@]}" "$MYSQL_DATABASE" \
  --single-transaction \
  --replace \
  --complete-insert \
  --no-create-info \
  --skip-triggers --no-tablespaces \
  --set-gtid-purged=OFF \
  "${IGNORE[@]}" > "$DUMP"
[ -s "$DUMP" ] || die "本地 dump 为空"

# ── 6. 包外键/唯一性检查开关，保证任意表顺序安全灌入 ─────────
{
  echo "SET FOREIGN_KEY_CHECKS=0;"
  echo "SET UNIQUE_CHECKS=0;"
  cat "$DUMP";
  echo "SET UNIQUE_CHECKS=1;"
  echo "SET FOREIGN_KEY_CHECKS=1;"
} > "$FINAL"

# ── 7. 行数对比（LOCAL_ONLY 时测试库列显示 —）────────────────
if [ "$LOCAL_ONLY" = "1" ]; then
  log "行数（仅本地；测试库列未连接）"
else
  log "行数对比（LOCAL → TEST；TEST 缺表显示 ?）"
fi
printf '%-22s %10s %10s\n' "TABLE" "LOCAL" "TEST"
for t in "${TABLES[@]}"; do
  l=$("${LOCAL_MYSQL[@]}" "${LOCAL_CONN[@]}" "$MYSQL_DATABASE" -N -e "SELECT COUNT(*) FROM \`$t\`" 2>/dev/null || echo "?")
  if [ "$LOCAL_ONLY" = "1" ]; then
    te="—"
  else
    te=$(mysql "${TEST[@]}" "$TEST_NAME" -N -e "SELECT COUNT(*) FROM \`$t\`" 2>/dev/null || echo "?")
  fi
  printf '%-22s %10s %10s\n' "$t" "$l" "$te"
done

# ── 8. 收尾 ─────────────────────────────────────────────────
if [ "$LOCAL_ONLY" = "1" ]; then
  log "完成（未触碰测试库）。覆盖 SQL → $FINAL"
  echo "    交给运维：mysql -h <TEST> -u <U> -p <DB> < $(basename "$FINAL")"
elif [ "$APPLY" = "1" ]; then
  log "APPLY=1 → 灌入测试库"
  mysql "${TEST[@]}" "$TEST_NAME" < "$FINAL"
  log "完成。备份=$BACKUP  覆盖SQL=$FINAL"
else
  warn "APPLY=0（dry-run）→ 未灌入。核对行数后重跑："
  echo "    APPLY=1 TEST_DATABASE_URL='$TEST_DATABASE_URL' $0"
  log "覆盖 SQL 已就绪 → $FINAL"
fi

unset MYSQL_PWD 2>/dev/null || true
