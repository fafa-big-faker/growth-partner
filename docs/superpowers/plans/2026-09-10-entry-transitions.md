# Entry Transitions Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task; independent module work can use an available subagent. User has authorized direct execution and publication.

**Goal:** 平滑衔接入境准备、登录和游戏，保持现有画面与登录可靠性。

**Architecture:** 新增原生SceneTransition模块统一拥有动画、临时样式、交互锁和取消清理。LoginBoot资源准备结束后交给模块揭示登录页；Auth在初始化成功后交给模块叠化游戏，最后启动引导。

**Tech Stack:** 原生JavaScript、CSS、Web Animations、Node测试、本地Playwright模拟。

## Global Constraints

- 无新增图片、音效、依赖；无真实账号或数据库写入；不截图。
- 转场720ms/700ms，游戏控件延后80ms，位移6px，登录退出缩放1.02；减少动态时短淡入淡出。
- 取消与动画失败必须清理inert、临时样式和动画句柄；不得修改用户未跟踪supabase目录。

### Task 1: 独立动画模块

Files: 创建`scene-transition.js`、`scene-transition.css`、`tests/scene-transition.test.js`。

Interfaces:
```js
SceneTransition.revealLogin({ screen, overlay, shell, onReveal }); // Promise<{cancelled:boolean}>
SceneTransition.enterGame({ from, to, prepare }); // prepare()可返回Promise；返回Promise<{cancelled:boolean}>
SceneTransition.isActive(); // boolean
SceneTransition.cancel(); // 清理并结束当前操作
SceneTransition.create({ document, window }); // 可隔离测试
```

- [ ] 用可控制动画Promise的模拟节点验证准备期间锁定、完成/取消/失败清理、重入、减少动态和后台结束。
- [ ] 实现不透明的旧页面覆盖已布局的新页面，退出时淡出，避免两层同时半透明造成白闪；子控件错峰入场；所有临时状态操作由模块持有并恢复。
- [ ] 运行`node --test tests/scene-transition.test.js`。

### Task 2: 接入资源与登录生命周期

Files: 修改`login-boot.js`、`login-art.js`、`app.js`、`index.html`及相关登录集成测试。

- [ ] LoginBoot进入revealing阶段，资源图片赋值后调用revealLogin；通过markRuntimeReady的onReveal回调在转场中初始化LoginArt。whenReady等到揭示完成才放开输入。默认无模块的测试环境保持直出路径。
- [ ] LoginArt可选revealDelayMs参数控制Logo中段出场，默认仍为500ms。
- [ ] Auth等待enterGame，prepare中显示目标页面并await Router渲染；Router返回对应render调用。引导在转场active时不启动，完成后再启动；失败/退出取消转场。
- [ ] 加入登录尝试版本检查，避免取消后旧请求或动画把游戏重新打开。已有登录锁延续至动画完成。
- [ ] index在LoginBoot前载入模块，更新本次改动文件缓存参数和相关版本断言。

### Task 3: 真实时间轴检查和发布

Files: 创建`tests/scene-transition.browser-check.cjs`，更新`docs/PROJECT_PLAYBOOK.md`。

- [ ] 使用本地模拟页面、真实动画API和320/390/1440视口，验证首屏100%保持、转场中两页可见但不可点、结束后正常点击、场景布局不变、引导结束后出现、登录错误可重试、后台与减少动态清理。
- [ ] 运行完整Node测试、JavaScript语法、Python编译与全部既有图片验证，运行`node scripts/build_boot_assets.cjs --check`及`git diff --check`。
- [ ] 检查变更范围和凭据，提交并推送main；核实对应Pages运行成功以及线上新增和修改文件与提交内容一致。
