# 事故报告:Prisma P3009 阻断生产部署(`creator_profile_stats` 失败迁移)

- **日期**:2026-07-29
- **严重程度**:高 —— 服务器容器无限重启,整个生产栈起不来(web 依赖 server healthy)
- **影响环境**:`192.168.1.11:3306` 的 `mediakit` 数据库(部署机的 `.env.prod` 指向)
- **状态**:根因已定位,修复方案已给出,**待确认数据库真实状态后执行**(见 [待办](#待办))

---

## 1. 现象

服务器容器启动时执行 `prisma migrate deploy` 失败,报 **P3009**:

```
Datasource "db": MySQL database "mediakit" at "192.168.1.11:3306"
9 migrations found in prisma/migrations
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260716000000_creator_profile_stats` migration started at 2026-07-28 11:17:26.237 UTC failed
[entrypoint] ERROR: prisma migrate deploy failed (exit 1)
[entrypoint] DATABASE_URL host: 192.168.1.11
[entrypoint] schema engines present:
-rwxr-xr-x 1 root root 18802864 Jul 29 04:15 .../@prisma/engines/schema-engine-debian-openssl-3.0.x
```

容器随后进入**无限重启循环**:`docker-entrypoint.sh:25` 在 `migrate deploy` 失败时 `exit 1`,所以第 35 行 `exec node tsx … src/index.ts` **永远不会执行**,server 进程从未启动。又因 `docker-compose.prod.yml` 中 `web` 依赖 `server: condition: service_healthy`,**整个栈宕机**,不是功能降级。

---

## 2. 根因(置信度高,原始报错待确认)

### 2.1 失败的那条迁移

`apps/server/prisma/migrations/20260716000000_creator_profile_stats/migration.sql`:

```sql
-- 达人库结构化表:补缺失的 stats 列 + 新增 profile 聚合列(bio/tags/contact/rate)。
ALTER TABLE `Creator` ADD COLUMN `stats` JSON NULL;
ALTER TABLE `Creator` ADD COLUMN `profile` JSON NULL;
```

一条光秃秃的 `ADD COLUMN … JSON` 失败,几乎只有一个原因:**`ER_DUP_FIELDNAME`(MySQL 错误码 1060)—— 列已经存在**。

### 2.2 为什么列会已存在 —— drift(漂移)工作流

根因证据来自迁移 `20260727000001_collab_creator_cps_sync` 自己的文件头注释:

> *These fields/tables were added to schema.prisma without a migration*
> *(dev DB user lacks CREATE DATABASE → `prisma migrate dev` fails P3014),*
> *so dev/prod DBs lagged the schema and Prisma queries threw P2022.*

结论:`Creator.stats` / `Creator.profile` 在正式迁移 #7 写出来**之前**,就已经被直接推送到了 `192.168.1.11` 数据库(经 `db push` / 某次同步)。等 #7 跑起来时,`ADD COLUMN stats` 撞上已存在的列 → 失败 → Prisma 把它标记为 failed(`_prisma_migrations` 里 `finished_at` 与 `rolled_back_at` 皆为 NULL)→ 之后任何 `migrate deploy` 都因 P3009 拒绝继续。

这与记忆 `prisma-migrate-dev-needs-shadow-db` 记录的"手写迁移 + migrate deploy/resolve"工作流一致。

### 2.3 未确认的细节

真实生产凭据不在仓库内(部署机的 `.env.prod` 注入),示例密码 `mediakit_pw` 被 `192.168.1.11` 拒绝(`ERROR 1045 Access denied`)。因此**无法直接读取** `_prisma_migrations.logs`(原始 MySQL 报错)或 `Creator` 的列结构来 100% 锁定错误码。原始报错就在 `logs` 字段里,只差一个只读账号。

---

## 3. 影响范围(已对照 `schema.prisma` 核实)

Prisma 严格按顺序应用迁移,#7 卡住 ⇒ **#8、#9 也被阻塞**,对应的表/列在生产库**全部缺失**:

| 迁移 | 缺失内容 | 运行期后果 |
|---|---|---|
| `20260727000001_collab_creator_cps_sync`(#8) | `CpsPerformance` 表;`CampaignCreator.collabId/currency/totalPrice`;`Creator.contact/profileUrl/rate` | `P2021` 表不存在 / `P2022` 列不存在 |
| `20260728000000_report_scheme`(#9) | `ReportScheme` 表 | `P2021` 表不存在 |

**额外风险**:#8 里的 `Creator.contact/profileUrl/rate` 很可能**也漂移了**(同一种工作流)。只修 #7 可能让 P3009 顺延到 #8。建议一次性把全部状态看清楚再动手。

---

## 4. 修复方案(生产库,需先核实状态再选 flag)

P3009 用 `prisma migrate resolve` 解除,但 `--applied` 与 `--rolled-back` 的选择**取决于 #7 的两列是否真实存在**——选错会重新失败,或把半完成迁移误标为已完成。

### 4.1 诊断(部署机执行,一次性看全)

```sh
set -a; . ./.env.prod; set +a
docker run --rm mysql:8 mysql \
  $(node -e "const u=new URL(process.env.DATABASE_URL);process.stdout.write(\`-h\${u.hostname} -P\${u.port||3306} -u\${u.username} -p\${u.password} \${u.pathname.slice(1)}\`)") \
  -e "SELECT migration_name,applied_steps_count,IF(finished_at IS NULL AND rolled_back_at IS NULL,'FAILED',IF(rolled_back_at IS NOT NULL,'ROLLED_BACK','APPLIED')) state,LEFT(logs,400) logs FROM _prisma_migrations ORDER BY started_at; SHOW COLUMNS FROM Creator; SHOW COLUMNS FROM CampaignCreator; SHOW TABLES LIKE 'Cps%'; SHOW TABLES LIKE 'Report%';"
```

### 4.2 决策表(针对 `20260716000000_creator_profile_stats`)

| `Creator.stats` | `Creator.profile` | 操作 |
|---|---|---|
| 缺失 | 缺失 | `resolve --rolled-back …` → 重新部署会重跑 #7 |
| **存在** | **存在**(drift 预期场景) | `resolve --applied …` → 重新部署跳过 #7,进入 #8/#9 |
| 一存在、一缺失 | | 先 `ALTER TABLE Creator ADD COLUMN <缺失列> JSON NULL;` 再 `--applied` |

### 4.3 执行 resolve(用 server 镜像,确保同一 DATABASE_URL)

```sh
# 以最可能的"两列都在"场景为例:
docker compose -f docker-compose.prod.yml run --rm --no-deps server \
  node node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js migrate resolve --applied 20260716000000_creator_profile_stats
```

随后 `docker compose -f docker-compose.prod.yml up -d`,并 `… run … migrate status` 确认 #8/#9 顺利应用。**若 #8 因同样 drift 报 P3009,按同一套决策表处理。**

---

## 5. 待办

- [ ] 取得 `192.168.1.11` 只读账号(或部署机上跑 4.1 诊断),确认 `logs` 报错码 + `Creator.stats/profile` 是否存在
- [ ] 按决策表对 #7 执行正确的 `migrate resolve`
- [ ] 重新部署并确认 #8、#9 应用成功,server 健康检查通过
- [ ] (加固)`docker-entrypoint.sh` 在 `migrate deploy` 失败时,目前只打印 "failed (exit 1)",不输出真正的 SQL 报错——建议补打 `_prisma_migrations.logs` 或让 Prisma 直接抛出原始错误,便于未来 drift 故障定位
- [ ] (根治)改进工作流:每次改 `schema.prisma` 同步生成迁移文件,避免"先推库后补迁移"的 drift;考虑给 dev 数据库补一个有 `CREATE DATABASE` 权限的影子库用户,让 `migrate dev` 正常工作(见 `prisma-migrate-dev-needs-shadow-db`)

---

## 6. 关键文件索引

- 入口脚本:`apps/server/docker-entrypoint.sh:25`(`migrate deploy` 失败即 `exit 1`)
- 失败迁移:`apps/server/prisma/migrations/20260716000000_creator_profile_stats/migration.sql`
- drift 自述:`apps/server/prisma/migrations/20260727000001_collab_creator_cps_sync/migration.sql`(文件头注释)
- 部署编排:`docker-compose.prod.yml`(`.env.prod` 注入 DATABASE_URL)
- 相关记忆:`prisma-migrate-dev-needs-shadow-db`、`local-install-masks-clean-install-failures`
