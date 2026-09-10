# Rare Reward Arrival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入两档稀有掉落演出和音效，并让电脑十连真实入口可靠地逐项展示。

**Architecture:** RewardPresentation管理纯表现阶段和可取消的相对时间轴，AudioManager维护独立新音效。应用入口保留原到账流程，浏览器回归使用模拟数据库。

**Tech Stack:** 原生JS/CSS、Node测试、Playwright、PCM WAV。

## Global Constraints

- 用户已批准直接执行和发布；不再申请许可，不截图验收。
- 原音频、旧图片、玩家数据和无关supabase目录保持不变。
- 类型1每次1300ms，真实名称停留300ms；道具品质与BUFF品质分离。
- 只有本弹窗持有的声音与时间轴会在跳过/关闭时清理。

---

### Task 1: 音频导入（并行）

**Files:** scripts/normalize_audio.js、audio-manager.js、tests/audio-reward-assets.test.js、docs/ASSET_PIPELINE.md、两个runtime WAV。

**Interfaces:** `AudioManager.playEffect('rewardRare'|'rewardHigh',{group})`，`stopEffects(group)`。

- [x] 测量原声时长、峰值与重音位置，确定性归一化，增加`--arrivals-only --check`。
- [x] 增加新映射，保持已有11文件字节不变，更新文件数/体积预算并跑音频测试。

### Task 2: 出场和时间轴（主代理）

**Files:** reward-presentation.js/css、app.js、tests/reward-reveal.test.js。

**Interfaces:** `getRevealPlan(metadata)`输出有序事件及duration；`playReveal`仍返回`{finish,cancel}`。

- [x] 给计划传入独立quality元数据，添加ink/icon/arrival-settled阶段；普通项完整播放不少于210ms，稀有项800/1100ms。
- [x] 同一个图标与文本的布局保持不变，高阶添加装饰墨层；原名保留300ms后接斧技。
- [x] 用上一事件实际执行时刻安排下一事件，起点等待两次requestAnimationFrame；清理同时取消帧回调和定时器。
- [x] 减少动态只移除运动、不跳过信息，更新品质、时序、跳过与清理回归。

验证核心断言：

```js
assert.equal(plan.events.find(event => event.type === 'trigger').at,
  plan.events.find(event => event.type === 'arrival-settled').at + 300);
assert.equal(new Set(pendingTimers.keys()).size, 1);
```

### Task 3: 实际入口回归（并行）

**Files:** tests/reward-entry.browser-check.cjs、tests/reward-reveal.browser-check.cjs。

- [x] 从真实doChopTen调用打开弹窗，模拟服务端已到账结果，不访问真实账号；检查PC和手机确实先pending再逐项展示。
- [x] 增加主线程延迟、减少动态、跳过、关闭断言，确认未来事件不一起追赶。
- [x] 保持app调用和资源锁不变，由表现控制器的两帧起点等待让同步重绘先完成；相对事件队列兼顾演出中途卡顿。

### Task 4: 集成和发布

**Files:** index.html、boot-assets.js（生成）、相关缓存/启动测试、docs/PROJECT_PLAYBOOK.md。

- [x] 只更新改变的脚本/样式缓存标识；运行`node scripts/build_boot_assets.cjs`并检查新清单。
- [x] 跑全部Node测试、JS语法、Python编译、图片/帧验证、diff和密钥检查。
- 发布门槛：提交本次文件并push origin/main；核对该提交Pages部署成功及线上文件内容，结果以对应提交的部署记录和最终交付为准。

## 实施与验证记录

- 新音源完整800/1100ms，主要重音位于600–680/850–980ms；图标分别在480/780ms开始320ms回弹，约640/940ms达到视觉重点。
- 普通PC与手机旧版路径正常逐项；旧版减少动态在首帧直接显示11件，模拟1900ms同步重绘会让十个延迟音效在约24ms内集中触发。说明已复现两种跳过演出的条件，不断言用户设备具体触发了哪种。
- 新版真实入口在上述条件下首帧保持待展示，约300ms只出现两件；中途1800ms卡顿后也只推进下一段，跳过/关闭停止后续声音，奖励计算调用保持一次。
- 551项Node测试全部通过，独立音频检查40项、表现控制器24项均包含在内；全部Python资源/动作帧检查、根目录JS语法与19个Python文件编译通过。启动清单224项，13音频，新增304,484字节。
- 两项浏览器回归通过：真实十连入口覆盖PC/手机/减少动态/重绘和中途卡顿，独立演出覆盖320×568、360×540、390×844、844×390、1440×900；墨记/图标分层、音效顺序、原名停留、两次完整技能、名字与数字色、短屏滚动和固定按钮、跳过/关闭/隐藏均通过。零页面错误、零真实数据库写入，无截图。
