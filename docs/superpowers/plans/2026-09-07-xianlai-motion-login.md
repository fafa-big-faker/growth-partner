# 仙来美术与动作 Implementation Plan

> **For agentic workers:** Use executing-plans to implement the approved scope task-by-task; independent subtasks may run in parallel.

**Goal:** 交付省费用美术提示词与动效示意，改善十连砍按钮同步、待机稳定性和浏览器密码填充。

**Architecture:** 美术示意与正式游戏隔离。十连砍复用 TenChopTimeline；登录凭据交给浏览器密码库；待机只做确定性位移校正。

**Tech Stack:** Vanilla JS/CSS/HTML, Node test runner, Python/Pillow.

## Global Constraints

- 不修改 game-config.js、Supabase 或玩家数据。
- 不提交 supabase/；不读取或记录实际密码。
- 不做全局浏览器视觉验收；连续十分钟无进展必须报告。
- 先交付美术说明，再实施游戏动作改动。

## Task 1: 美术说明与演示

- [x] 根据实际820px布局测量移动端和桌面尺寸，生成四组完整提示词至资源目录。
- [x] 在任务演示目录生成 xianlai-ink-preview.html，复用已有位图；只演示水墨揭示、边缘运动、平滑加载，提供可见结果。736/360尺寸、加载完成/重播、离屏暂停及减少动态效果已验证。

## Task 2: 十連砍按钮同步

Files: app.js PlayerView、styles.css chop rules、tests/ten-chop-button-feedback.test.js。

- [x] 写行为测试，执行提取的 PlayerView.doChopTen()：记录按钮速度、角色 frameMs、奖励 dropMs，断言各有10次且最后速度为3。
- [x] 实现 `_playChopButtonFeedback(button, speed = 1)`，CSS变量时长采用 `Math.round(320 / speed)` 和 `Math.round(520 / speed)`，清除按钮旧清理定时器。
- [x] 从 doChopTen 入口移除表现调用，在 `TenChopTimeline.getStep(i)` 后每次调用；单砍表现放入既有操作锁内部。
- [x] 测试无结果/失败不会下劈、旧定时器不会清除新动画、单砍参数不变。

## Task 3: 浏览器密码管理

Files: login-credentials.js、app.js Auth、index.html 登录表单、styles.css 登录选项、tests/login-credentials.test.js。

- [x] 先覆盖API不支持、拒绝、角色错配、仅成功存储、切换角色时旧请求返回等测试。
- [x] 以 `navigator.credentials.get/store` 和 `PasswordCredential` 对接原生密码管理，表单提供 username/current-password；不添加网页密码存储。
- [x] 登录锁在验证前生效，失败释放，保留原加载与音频行为。
- [x] 运行14个专属测试，检查表单按钮只提交一次、首次与切换角色的填充路径；退出登录清空输入，不自动登录。

## Task 4: 待机锚点

Files: scripts/split_idle_axe_sheets.py、scripts/idle_frame_offsets.json、idle-axes PNG/WebP、tests/character-frame-alignment.test.py。

- [x] 以脚部与腰部局部匹配测量偏移，保留第1帧和所有砍树帧。
- [x] 应用无裁断平移并固定输出尺寸；记录源指纹和确定性校正避免二次重复平移。
- [x] 更新待机运行时文件，验证36帧透明度、尺寸、完整性以及第1帧未变。53001宽裙摆的保护偏移留下小于3px显示残差；不裁掉有效透明边缘。

## Task 5: 完成

- [x] 更新待机资源和前端缓存版本、制作规范。
- [x] Node全量163项测试、JS语法、Python编译、sprite/runtime测试、git diff --check。独立代码复查未发现发布阻断问题。
- [x] 精确暂存本次文件、审查无敏感信息，提交并推送origin/main，核对Pages部署状态。代码版本d863aab：线上HTML版本、逐次下劈调用、待机缓存标记和密码模块均已验证；待机WebP与本地文件一致。
