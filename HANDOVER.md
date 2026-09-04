# 项目交接说明（给下一个 Agent）

> 本文档是跨会话交接存档。请先完整阅读，再接管本项目。

## 一、项目一句话

一款**修仙题材的游戏化任务/成长系统**「寻道大千」，纯前端单页应用（HTML+CSS+JS），数据存 **Supabase**（PostgreSQL），游戏配置由 **飞书表格** 驱动，通过脚本同步成本地 `game-config.js`，前后端由 **GitHub Pages** 托管。

## 二、核心入口与链接

| 项目 | 位置 / 地址 |
|---|---|
| 游戏公网链接（GitHub Pages，假设已开启） | `https://fafa-big-faker.github.io/growth-partner/` |
| GitHub 仓库 | `https://github.com/fafa-big-faker/growth-partner`（分支 `main`） |
| GitHub 远程地址 | `https://github.com/fafa-big-faker/growth-partner.git` |
| 本地工作目录 | `/workspace`（沙箱环境） |
| 需求文档（寻道大千，飞书 Wiki） | `https://my.feishu.cn/wiki/DmRdwBBICiuH0JkYKhMcdADTn8c` |
| 成就奖励表（配置表，飞书 Wiki） | `https://my.feishu.cn/wiki/DCmCwTMypiw584kUYiGceJM2nke` |

## 三、技术栈与架构

- **前端**：纯原生 HTML + CSS + JavaScript，无框架、无构建步骤，浏览器直接加载。
- **后端/数据库**：Supabase（PostgreSQL），通过匿名 key 直连，**所有表已关闭 RLS**（匿名可读写）。
- **配置驱动**：游戏数值（道具、技能、仙树、奖池、锻造、商店、累签、成就、角色等级）全部存在飞书电子表格，同步脚本生成 `game-config.js`。
- **美术资源**：AI 生成后人工切割的像素图标，存放于 `assets/images/icons/*.png`。
- **部署**：静态托管于 GitHub Pages。

### 数据库连接（已在 index.html 内联）
```js
window.SUPABASE_URL = 'https://fczkdiakiykcgctrffur.supabase.co'
window.SUPABASE_KEY = 'sb_publishable_ZBRpp9ITVRY0Ipj2haU09Q_fAB6S-hg'
```

### 数据库表清单（Supabase）
- `player_state` — 玩家状态（等级、经验、砍树次数、金币 coin、仙树等级、仙阶 realm_level、累签 signin_*、成就统计 total_chops/total_coin_earned、主题任务等）
- `inventory` — 玩家道具/武器背包
- `xiu_tasks` — 任务（日常/主题任务，含 theme_name/theme_start/theme_end）
- `task_submissions` — 任务提交记录
- `mails` — 邮件（含附件奖励）
- `withdrawals` — 提现记录

SQL 迁移脚本：`upgrade_v2.sql`（仙阶/主题任务/RLS 关闭）、`upgrade_v3.sql`（金币/累签/商店限购）、`upgrade_v4.sql`（成就统计/主题兜底，**含 v3 全部内容，新库执行这一个即可，可重复执行**）。

## 四、文件结构

```
/workspace
├── index.html            # 页面骨架 + Supabase 配置内联
├── app.js                # 全部游戏逻辑 + UI（约 4600 行）
├── styles.css            # 全部样式（约 2000 行）
├── game-config.js        # ★由 sync-config.py 从飞书表格生成（勿手改）
├── sync-config.py        # ★飞书表格 → game-config.js 的同步脚本
├── scripts/sync-config.sh # 同步脚本的便捷包装
├── upgrade_v2/v3/v4.sql  # 数据库迁移脚本
├── assets/images/        # 美术资源
│   └── icons/            #   28 个 64x64 像素道具/武器图标（ID.png）
└── README.md / DEPLOY.md # 早期部署记录（当前游戏已远超原文，仅供参考）
```

## 五、飞书表格配置表（数据源头）

同步脚本 `sync-config.py` 里的 `SHEETS` 字典记录了所有电子表格 token：

| 配置表 | 说明 |
|---|---|
| 角色表 | 角色等级经验表（150 条）、仙阶 realm、品阶 quality、背包 pack、buff、交互类型 |
| 道具表 | 道具定义（type 0=游戏币、1=砍树次数、5=武器斧子；icon 列可上传 PNG 自动下载到本地） |
| 技能表 | 技能定义 |
| 仙树表 | 仙树等级/灵阶 treeTable |
| 奖池表 | 掉落奖池（含 reward pool 1003 等）+ poolWeight 权重 |
| 锻造表 | 锻造概率 forgeTable |
| 商店表 | 「天道酬勤」商店 shopTable |
| 累签表 | 每日/累计签到 signInTable |
| 成就表 | 成就列表 achievementTable + 成就类型/页签/奖励 |

**重要工作流（新 AI 必须知道）**：
1. 改飞书表格后，运行同步脚本：`python3 /workspace/sync-config.py`（需本机已配置 `lark-cli` 授权）。
2. 脚本会读取表格 → 生成 `game-config.js` → 自动下载道具图标到 `assets/images/icons/`。
3. 新加配置表时，要在 `sync-config.py` 的 `SHEETS` 里加 token，并把表格**第一行加参数英文名**（历史约定）。
4. 改完代码 + 配置后，`git add . && git commit && git push origin main` 即自动发布到 GitHub Pages。

## 六、道具 Icon 映射惯例

- 每张 `assets/images/icons/{itemId}.png` 对应道具表里的 ID。
- `app.js` 的 `renderItemIcon(itemId, fallbackEmoji, cls)` 统一渲染：优先飞书配置的 `iconImage` → 本地 `ITEM_IMAGES` 映射 → emoji 兜底。
- 纯文本场景（toast、下拉 option 等）用 `itemEmoji(itemId)` 取 emoji 兜底，不放 `<img>`。
- 斧头（type=5）是竖长方形，用 `item-icon-axe` class 保持比例；武器背包格子是 3:4 竖格。

## 七、关键功能与状态

- **修仙主页**：砍树得资源、角色/仙树升级、经验条、装备斧子、背包（道具方格/武器竖格双 tab，限高内部滚动）、锻造、天道酬勤商店、签到/累签、每日+主题任务、成就系统。
- **背包布局**：道具默认 5 列、约 4 行高；武器 tab 4 列竖格、约 2 行高；超出在格子内部滚动，不撑开整页。
- **装备逻辑**：装备中的斧子已从背包扣除（手持显示在按钮），背包里的都算"备用"，不显示"装备中"。
- **奖励发放**：type 0（游戏币）写 `coin`，type 6（砍树次数）写 `choppingCount`，不进背包。
- **主题任务**：周期性活动，有起止时间，过期整模块隐藏显示"尽情期待"。
- **GM 工具**：`#GM` 相关入口，可发放道具、看玩家数据、审核提现等（管理员视角）。

## 八、工作约定 / 注意事项

1. **语言**：始终用中文与用户交流、输出（用户默认中文）。
2. **交付**：用户常要求交付网页/文档/截图验证，code 类改动要自测并截图确认。
3. **图标**：出现"问号/❓"通常是某处还在用 emoji 或路径没通，统一走 `renderItemIcon`。
4. **数据库**：改结构用 `upgrade_v*.sql` 幂等脚本；新老库执行最新版即可。
5. **安全**：GitHub 远程地址里曾经内嵌过 token（历史遗留），不要泄露；涉及凭据一律走授权连接器，不让用户输密码/token。
6. **README/DEPLOY 已过时**：那两份写的是最初"成长伙伴"（localStorage 版），当前游戏已重构为修仙 + Supabase + 飞书驱动，以本文档和代码为准。

## 九、给新 AI 的第一步建议

1. `ls /workspace` 确认文件齐。
2. 浏览器打开 GitHub Pages 公网链接，走一遍修仙流程，对照截图确认没回归。
3. 若用户要求改配置，先看 `sync-config.py` 里对应表的 token 和字段映射，改飞书表格后跑同步。
4. 任何"想要的功能"先对照需求文档（飞书 Wiki）确认，再执行。
```