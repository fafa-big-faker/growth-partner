# 首次砍树引导 Implementation Plan

> **For agentic workers:** Use executing-plans to implement this approved plan task-by-task. Independent controller and browser checks may be delegated while application integration proceeds locally.

**Goal:** 新玩家第一次入境看到会浮动的强制砍树引导，测试账号可重播，已砍过的账号不重复教学。

**Architecture:** 独立FirstChopGuide模块负责遮罩、真实按钮聚焦、事件约束和生命周期。app.js注入当前账号/场景校验及现有doChop回调，以云端totalChops识别完成；模块不读写数据库、不克隆按钮。AppShell在引导活动期间吞掉安卓返回键。

**Tech Stack:** 原生JavaScript/CSS，Node test、现有模拟数据浏览器检查，无新依赖。

## Global Constraints

- 用户已批准方案并要求直接执行，不重复确认；不截图或做视觉验收。
- 气泡2.6秒周期、5px浮动；遮罩300ms淡入后气泡出现。减少动态时稳定显示。
- 单次真实砍树；失败重新引导，不重置数据，不额外赠送次数。
- 只在正式玩家累计砍树为0时自动引导；测试账号手动重播，天道端不显示。
- 本次图片复用已预载纸面，变更脚本/CSS缓存版本，正常发布origin/main并核实线上字节。

### Task 1: 独立引导控制器与动效

**Files:** Create `first-chop-guide.js`, `first-chop-guide.css`, `tests/first-chop-guide.test.js`.

**Interfaces:** CommonJS exports `{ createController, shouldStart }`; browser exposes `FirstChopGuide = createController()`。实例接口`shouldStart({role, environment, totalChops})`、`start({getTarget,onChop,isCurrent})`、`isActive()`、`setBackgrounded(value)`、`destroy()`。destroy可再次start。onChop返回Promise<boolean>；true清理、false/throw恢复聚焦；isCurrent为false必须清理并忽略旧异步结果。后台状态同时考虑document.hidden和原生壳通知。

- [x] 先覆盖资格判定、仅真实按钮可触发、快速连点只调用一次、失败重试、成功清理、destroy后的异步回调、横竖屏定位与焦点恢复。
  ```js
  assert.equal(shouldStart({role:'player', environment:'live', totalChops:0}), true);
  assert.equal(shouldStart({role:'player', environment:'test', totalChops:0}), false);
  assert.equal(shouldStart({role:'player', environment:'live', totalChops:1}), false);
  ```
- [x] 创建UMD控制器，start等待绘制就绪；聚焦孔按真实按钮和`.chop-axe-icon`的并集定位。文档/窗口捕获阶段禁止其他控件、Esc、滚轮和触摸滚动，只转交一次真实onChop。不要复制按钮、移除onclick或改游戏发奖逻辑。
  ```js
  // 点击聚焦目标的唯一动作接口；pending期间继续阻挡重复输入。
  const success = await options.onChop();
  if (!options.isCurrent()) destroy();
  else if (success) destroy();
  else restoreGuide();
  ```
- [x] 使用现有`assets/runtime/v5/ui`已预载纸框、深墨文案，纯遮罩+透明聚焦孔。气泡浮动和圈呼吸分别动画，hidden/后台暂停、reduced-motion静态。注册ResizeObserver/visualViewport/resize/visibility监听，destroy全部清理且恢复焦点/属性。
- [x] `node --test tests/first-chop-guide.test.js`通过后报告控制器可集成（14项通过）。

### Task 2: 登录、重播和安卓返回键

**Files:** Modify `app.js`, `index.html`, `app-shell.js`, add `tests/first-chop-guide-integration.test.js`, extend `tests/app-shell.test.js`.

**Interfaces:** app调用已定义控制器；Auth保存登录成功后的`session`（现有AccountSession返回的角色、环境、playerRole，不保存密码）。PlayerView新增`startFirstChopGuide({replay=false}={})`、`replayFirstChopGuide()`。isCurrent同时核对会话身份、玩家数据身份、当前修仙页、仪表盘可见。

- [x] 登录资源全部成功后设置Auth.session再显示修仙页；renderCultivate完成同步挂载后尝试开始。失败/登出/离页销毁；初始化Auth.session=null。
  ```js
  if (FirstChopGuide.shouldStart({role: Auth.session?.role,
      environment: Auth.session?.environment, totalChops: Game.state?.totalChops})) {
    PlayerView.startFirstChopGuide();
  }
  ```
- [x] start在无次数/忙/其他弹窗时不锁住页面；重播只允许测试修炼者、显示次数不足提示。onChop先清除十连模式及复选框，然后复用`PlayerView.doChop()`返回布尔结果，保持OperationGuard和原正常奖励弹窗。
- [x] 顶栏测试账号显示44px点击高度的小型“重播引导”文字按钮；正式账号无入口。引导活动时app-shell.handleBack优先return true。
  ```js
  if (getGuide()?.isActive?.()) return true;
  ```
- [x] script/CSS在app之前加载，更新对应缓存版本及现有版本断言。新增集成测试覆盖首次自动/老玩家跳过/测试重播限制/初始化失败、资源保护及返回键优先级。

### Task 3: 验证、文档与发布

**Files:** Create `tests/first-chop-guide.browser-check.cjs`, update `docs/PROJECT_PLAYBOOK.md` and current plan.

- [x] 复用现有无真实数据浏览器fixture，在320×568、390×844、390×1200、844×390、1440×900检查气泡/孔坐标、真实按钮点击、外部控件阻挡、单次/十连、失败恢复、成功/退出清理、减少动态、测试入口。通过动画对象确认浮动处于运行状态，不截屏。
- [x] 跑完整Node套件、Python图片/配置回归、JS/Python语法、git diff检查；448项Node、74项Python及5视口浏览器检查通过，零页面错误和真实账户请求。
- [x] 文档记录自动资格、测试入口、失败机制、复用现有累计次数的边界；检查无账号数据修改、无凭据加入提交。

**发布流程：** 显式暂存本任务文件，commit并push origin/main；确认对应SHA的Pages成功，以及线上index/app/guideJS/CSS/app-shell真实字节。交付测试入口与步骤，不要求另建账号或安装新APK。发布记录以GitHub对应提交与Pages运行结果为准。
