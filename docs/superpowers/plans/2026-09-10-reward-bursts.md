# Reward Burst Sprites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用用户12帧图集和加强声音替换上一版珍稀奖励的简单缩放演出。

**Architecture:** 独立确定性导入脚本生成两张共享sprite atlas，RewardPresentation控制原有结果时序，CSS以离散位移播放图集。AudioManager只替换两条出场音，启动资源由现有生成清单统一收集。

**Tech Stack:** Python/Pillow、原生JS/CSS、PCM WAV、Node test、Playwright。

## Global Constraints

- 源图与源音频不覆盖，玩家数据不写入，无截图视觉验收，直接测试发布。
- 珍品880ms/图标240ms，高档1280ms/图标260ms，原名停留300ms，技能每次1300ms。
- 单张运行图集1024×768，4列3行，每格256；不能按透明轮廓重置各帧中心。
- 保留已修复的电脑逐项演出、操作锁、弹窗固定底栏及减少动态信息。

---

### Task 1: 图集管线（并行）

Files: `scripts/import_reward_bursts.py`, `tests/reward-burst-assets.test.py`, `assets/images/reward-bursts/`, `assets/runtime/reward-bursts/`, `docs/ASSET_PIPELINE.md`。

Interface: `rare.webp/high.webp`，4×3，12frames，256cell；源指纹/输出尺寸写入manifest。

- [x] 测量原图alpha/格子，完整切格、统一缩放、确定性WebP输出。
- [x] 验证24帧来源、固定中心、透明安全边和`--check`重建，更新来源文档。

### Task 2: 加强音效（并行）

Files: `scripts/normalize_audio.js`, `audio-manager.js`, 三份音频tests，两个出场WAV，音频文档节。

Interface: `rewardRare/rewardHigh`名称不变，新URL版本`reward-burst-20260910`。

- [x] 测量时长/重音、固定增益保留动态，原11文件指纹不变。
- [x] 更新源SHA、混音、缓存与字节预算；跑确定性及声音分组清理测试。

### Task 3: 帧演出（主代理）

Files: `reward-presentation.js/css`, `app.js`, `tests/reward-reveal.test.js`, `tests/v7-integration.test.js`, `index.html`。

Interface: `getAssetUrls()`返回原5墨团和2特效图集；`playReveal`的finish/cancel不变。

- [x] 渲染独立裁切容器和整张图集img，仅rare/high使用；移除旧echo层，保留最终品质墨团。
- [x] 配置离散12帧位置和两档帧节奏，图标按实测重音出现；减少动态不显示动态图集。
- [x] 更新原名停留与技能回归：

```js
assert.equal(rareTrigger.at, 880 + 300);
assert.equal(highTrigger.at, 1280 + 300);
```

- [x] 将两图集加入真实公共预载与一致缓存URL，更新改变的入口标识。

### Task 4: 浏览器与发布

Files: `tests/reward-reveal.browser-check.cjs`, `tests/reward-bursts.browser-check.cjs`, `boot-assets.js`（生成），开发手册。

- [x] 模拟数据验证12帧确实切换、图片正确解码、五视口布局与清理；电脑真实入口回归。
- [x] 生成并验证启动清单；全部Node测试、JS语法、Python编译、图片/帧测试、diff及密钥检查。
- [x] 更新开发手册与本计划完成记录。

发布门槛：提交已验证文件到origin/main，核对对应Pages成功和线上实际文件，最终交付报告发布结果；无关supabase目录保持不变。

## 实施记录

- 两张运行图集共290,212字节（283.4KiB），24帧归档可完整重组两张原图。5项新图片检查和确定性构建通过。
- 加强音频0.88/1.28秒，共346,084字节；原11音频不变，全13音频2,444,128字节。41项音频测试通过。
- 初次审查发现第一行及边缘列的大墨爆会被祖先滚动区截断，已固定预留26px绘制边距并让自动滚动包含墨迹顶部；新增按每帧实际alpha边界检查单抽和十连角落的回归，保持160%/180%效果尺寸。
- 553项Node测试通过，全部图像/角色帧测试通过，所有根目录JS语法及20个Python文件编译通过。启动清单226项，按密度选择216项，1x 7,424,453字节、2x 8,255,135字节。
- 三项浏览器检查通过：实际12帧图集与声音重音/色调/清理，320×568、360×540、390×844、844×390、1440×900完整技能演出与固定底栏，真实PC/手机十连入口及卡顿/减少动态。补绘制边界后再次通过帧检查及全部五视口演出回归。零页面错误、零真实数据写入、无截图。
