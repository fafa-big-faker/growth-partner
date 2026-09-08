# V7 Mobile And Rewards Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. User has approved implementation and release; no repeated approval pause.

**Goal:** 接入V7品质墨团、手机双栏背包与统一底部导航，发布可用版本。

**Architecture:** 保留原生页面和游戏数据流。独立奖励表现模块共享墨团布局；手机控制器管理现有DOM移动、状态恢复和右栏模式，PlayerView负责从当前Game状态生成内容。

**Tech Stack:** Vanilla JavaScript/CSS, Pillow, Node test runner, mocked Playwright checks.

## Global Constraints

- 不改配置、数据库、奖励计算和十连时间轴。
- 唯一inventory-grid；独立武器以UUID识别；当前武器不可售卖。
- 只接入用户V7图片，不生图、不覆盖源图、不做浏览器截图。
- 使用xianlai-v7-20260909缓存标记；显式暂存文件，保留未跟踪supabase目录。

## Task 1: Assets (completed)

Files: scripts/import_xianlai_v7_art.py, scripts/build_runtime_images.py, assets/{images,runtime}/v7, tests/xianlai-v7-assets.test.py.

- [x] 测量源图alpha，编写切图测试：`assert len(reward_paths) == 5`，检查四角透明和墨团未截断。
- [x] 确定性导入5张quality-N和一张inventory-paper，记录来源SHA及slice。
- [x] `python scripts/build_runtime_images.py --v7-only`，检查WebP尺寸及总量，运行专用Pillow测试。6张WebP总计145,430字节。

## Task 2: Reward Presentation (completed)

Files: reward-presentation.js/css, app.js奖励弹窗片段, tests/v7-rewards.test.js.

Interface: `RewardPresentation.createRenderer({items,quality,renderItemIcon,escapeHtml})` returns `renderItem(item, options)` and `renderResults(results)`; `groupResults(results)` groups actual `isExtra` entries.

- [x] 测试混合顺序分组、零/多个额外项、数量及BUFF信息：`assert.equal(groups.extra.length, 2)`，不按第11项取额外。
- [x] 实现同一墨团图标/名称/数量组件，常规5列、额外flex居中，单抽扩大同组件。
- [x] 接入两个弹窗，11项Node奖励测试及四视口浏览器几何/图片检查通过，不改发奖流程。

## Task 3: Mobile Layout (completed)

Files: mobile-cultivation.js/css, app.js库存/路由集成, tests/mobile-cultivation.test.js, tests/mobile-cultivation.browser-check.cjs.

Interface: `mount(snapshot,{onModeChange})`, `unmount({preserve})`, `beforeInventoryRender(tab)`, `refreshInventory(tab)`, `isMobile()`, `setPage(tab)`, `refreshEquipment({html,weaponsHtml})`. PlayerView.getMobileEquipmentPresentation() supplies current-state right content.

- [x] 写模式切换/返回/滚动保留测试：`assert.equal(snapshot.mode, 'library')`；桌面恢复唯一背包DOM。
- [x] 实现3:2双栏、唯一道具网格、右侧当前装备/武器库切换和统一导航。
- [x] PlayerView从Game.weapons渲染右库，已装备实例居前，不可售卖；手机左栏恒为items，桌面保留currentInvTab。
- [x] 测试360x540、360x640、390x844、844x390、1440x900，无水平溢出，点击区无不合理重叠，不截图。补充跨断点滚动保留及短屏技能首行可见。

## Task 4: Integration And Release

Files: index.html, app.js预载, docs/PROJECT_PLAYBOOK.md, regression tests affected by changed contracts.

- [x] 加载新模块/样式并加入全部实际版本化图片预载，普通详情标题加入品质色。
- [x] 运行全部Node测试（281项）、全部Pillow测试（38项）、根目录JS语法/Python编译、5套浏览器模拟回归（21组视口）及`git diff --check`。
- [x] 检查差异不含凭据、无关配置、supabase目录；更新手机制作规范。
- [x] 发布前代码与资源已全部就绪；显式暂存本次文件，保留supabase目录，发布结果以本次任务最终线上核验为准。
