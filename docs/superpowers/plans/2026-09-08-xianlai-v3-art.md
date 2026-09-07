# Xianlai V3 Art Implementation Plan

> **For agentic workers:** Use executing-plans for the approved work; resource import, UI styling and login motion are independent tasks.

**Goal:** 接入用户提供的四张新图及已批准的轻量动效。

**Architecture:** 静态资源清单、独立UI皮肤与可测试的LoginArt生命周期，保留原游戏业务逻辑。

**Tech Stack:** Vanilla HTML/CSS/JS, Pillow, WebP, Node test runner.

## Global Constraints

- 不生图付费，不操作Supabase/真实玩家数据，不提交supabase/。
- 不做浏览器视觉验收；只执行无截图自动几何/资源/事件检查。
- 保持已验收背包格尺寸、树/人物层级、点击穿透和次数角标位置。

## Task 1: 素材导入

Files: scripts/import_xianlai_art.py、scripts/build_runtime_images.py、assets/images/v3、assets/runtime/v3、tests/xianlai-art-assets.test.py。

- [x] 检查四图尺寸/透明度，按格子切出独立资源并清除框外噪点，保留logo笔锋和图标墨线。
- [x] 生成14张WebP与两个可追溯清单，长框保留原生像素、logo最大960x512、功能图标160x160。
- [x] 验证透明边缘、尺寸、切片和总体积；检查浅色棋盘接触图。

## Task 2: 界面皮肤

Files: xianlai-ui.css、tests/xianlai-ui.test.js。

- [x] 为五处界面框加入点击穿透的九宫格层，去掉旧底纹，保持现有布局占位。
- [x] 更新导航选中/hover/press状态，保留减少动态效果支持。
- [x] 无截图检查360/390/820/1440四宽的14个组件，共56项几何前后一致。

## Task 3: 登录艺术与动效

Files: login-art.js、login-art.css、index.html登录DOM、tests/login-art.test.js。

- [x] 接入真实logo、背景与按钮；保留表单所有密码管理属性。
- [x] 暴露LoginArt.init、setLoading、setVisible；logo加载后揭示，按钮单次墨波，实际进度平滑跟进。
- [x] 单测加载/错误降级、进度单调、后台/离屏暂停、减少动态、重复初始化清理及键盘鼠标触发。

## Task 4: 接入、验证和发布

Files: app.js图标映射与首屏加载、Auth生命周期、audio-manager.js、index.html资源引用、相关tests和项目规范。

- [x] 新功能图标统一寻址，首屏包含V3使用资源；首页导航和静音图标替换，不改音频响度/播放逻辑。
- [x] 登录生命周期接入独立动效模块，无支持模块时保持原加载显示。补充登录失败时旧进度回调保护与异常路由后的恢复。
- [x] 188项Node、11项图片回归通过；四视口登录资源与布局、36点仙树点击、次数角标和静音反馈自动检查通过，无账号数据访问。横屏844x390修正后按钮不越界。
- [x] 独立复查未发现发布阻断问题，版本标记xianlai-art-v3-20260908。

发布执行：仅暂存本次代码、切图资源、测试和文档，推送main后核对Pages版本和全部14张V3资源。发布结果与提交号在本次交付消息中记录。
