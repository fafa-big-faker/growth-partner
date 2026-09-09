# 入境准备页 Implementation Plan

> **For agentic workers:** Use executing-plans for the approved design. Delegate the independent resource cache, asset import/manifest, and browser verification while integrating LoginBoot locally.

**Goal:** 以有文案和真实进度的静态加载页统一准备主要资源，避免登录后的第二段图片下载。

**Architecture:** 构建清单提供URL/字节/哈希；ResourcePack完整下载并写独立静态缓存，限定范围的Service Worker让现有图片和音频路径复用缓存。LoginBoot负责新准备页及登录图解码；Auth负责账号数据和就绪后入境。

**Tech Stack:** 原生JS/CSS、CacheStorage/Service Worker、Python/Pillow导图、Node测试与无截图本地浏览器验证。

## Global Constraints

- 已批准，直接执行；不截图、不改玩家数据，不提交既有未跟踪supabase目录。
- 真实进度、失败不计成功、只补下载变化资源；音频必须完整下载才算准备完成。
- 复用实际游戏URL和缓存键；不缓存代码、配置、数据库、第三方请求。
- 大图和全部动作仅下载，不在首屏全部decode；不添加新依赖。

### Task 1: 新背景与确定性资源清单

Files: `scripts/import_entry_art.py`, `assets/runtime/entry-preparation/`, `assets/images/entry-preparation/`, `scripts/build_boot_assets.cjs`, `boot-assets.js`, `tests/entry-art-assets.test.py`, `tests/boot-assets.test.js`, `docs/ASSET_PIPELINE.md`。

- [x] 读取新原图并记录尺寸/指纹，保持中央留白，导出轻量background.webp（目标100KiB内；实际质量优先）和manifest，不改原图。
- [x] 构建脚本以VM读取game-config和app资源定义前缀（止于DB段），调用实际getInitialGameImageAssets与九武器帧解析；加载LoginBoot导出清单及audio-manager导出的音频路径。所有URL必须本地assets/runtime路径，禁止凭据/外部URL。
- [x] 生成`globalThis.BootAssetManifest={version,assets:[{url,bytes,sha256,kind,density}]}`；density为all/1/2（仅树图分密度），kind为image/audio。额外包含新准备页背景和既有exp-track/exp-fill。version由排序后清单哈希派生。
  ```js
  assert.ok(manifest.assets.every(asset => asset.bytes > 0 && /^[a-f0-9]{64}$/.test(asset.sha256)));
  assert.equal(new Set(manifest.assets.map(asset => asset.url)).size, manifest.assets.length);
  ```
- [x] `--check`逐字节验证清单与资源，测试覆盖全部实际路径、双密度选择、90帧和11音频、无外部/历史原图。

### Task 2: 文件准备与持久缓存

Files: `resource-pack.js`, `resource-worker.js`, `tests/resource-pack.test.js`, `tests/resource-worker.test.js`。

接口：UMD `ResourcePack` browser singleton；CommonJS `create`。`prepare(manifest,onProgress,options={dpr,signal})`返回`{ready,failed,cancelled,persistent,totalBytes,loadedBytes}`；进度含percent、totalBytes、loadedBytes、completed、total、failed、url、ok。`isReady()`及`getState()`供LoginBoot查询。缓存名`xianlai-resource-pack-v1`，记录`x-xianlai-sha256`、`x-xianlai-bytes`。

- [x] 测试冷下载/热命中/单文件改动/重复消费者/abort/失败重试/错误长度与SHA/缓存失效等行为。
- [x] 以6并发fetch完整读取并验证字节与SHA，进度基于实际文件字节，未校验完成不得到100%；成功后cache.put真实URL。热缓存校验元信息后直接命中；重试仅失败项。缓存失败降级网络，不锁死。
  ```js
  const result = await ResourcePack.prepare(BootAssetManifest, progress => renderProgress(progress));
  if (!result.ready) showRetry(result.failed);
  ```
- [x] worker只拦截scope内GET、assets/runtime和图片/音频扩展；下载请求cache=reload绕过缓存。命中返回正确Content-Type，音频Range正确返回206或416，未命中正常网络，未指定资源完全不干预。
- [x] register本目录worker并有限等待首次接管，稳定缓存格式无需依赖导入清单；首屏完成后清理本缓存中过期URL（保留清单两密度，清理失败不影响游戏）。单测通过后报告API稳定。

### Task 3: 新准备页与登录接入

Files: `login-boot.js/css`, `index.html`, `app.js`, `tests/login-boot.test.js`及相关接入测试。

- [x] 静态纸面、中心一句话、细进度条/百分比与阶段文字；每6秒淡换文案，后台停止，reduced-motion即时切换；保留重试按钮和焦点/无障碍状态。
- [x] LoginBoot在运行SDK前准备整个资源包，使用准备成功事件显示新底图；图片存缓存后仅decode登录关键图与装饰图，再等markRuntimeReady放行。
- [x] index先载manifest/resource-pack/preloader/boot并启动；新背景与进度UI不依赖外部字体或SDK就能出现。版本变化只更新修改文件URL。
- [x] Auth取消现有公共warmup+abort路径及旧音频伪完成preload；已有文件只做当前需要的decode，保留Game.init和失败处理。登录按钮显示正在入境、disabled/busy，表单不切为旧大loading panel。
- [x] 更新被改变的旧测试契约，保留图片失败/登录失败/取消/不重复下载验证；新功能测试覆盖冷/热准备后登录、无第二下载条。

### Task 4: 浏览器验证与发布

Files: `tests/entry-preparation.browser-check.cjs`, `docs/PROJECT_PLAYBOOK.md`及本计划。

- [x] localhost真实Service Worker+实际磁盘资源，所有DB/外部请求阻止，模拟账号验证；五视口检查布局/背景比例/文案、首屏冷/热网络计数、单文件更新、Range、失败重试、不支持缓存、登录后复用与新手引导。无截图。
- [x] 全Node、全Python图片配置、JS/Python语法、清单--check、diff/secret检查；只在新增失败或改动后重跑受影响检查。
- [x] 记录启动资源清单必须重建的制作习惯和缓存范围，准备统一提交main。发布后以同一提交对应的Pages成功及线上代码/清单/worker/背景实际字节校验作为发布完成依据，回执记在交付消息。

### Task 5: 天道发布任务复用进行中主题（用户追加，已授权）

Files: `app.js`的AdminView发布任务表单、`tests/theme-task-publishing.test.js`。

- [x] 从已发布主题任务提取名称和日期，按玩家端同名归组沿用最宽日期；仅至少一条原任务正处活动期才列为进行中，防止同名旧/未来活动中间空档误判。不读玩家个人完成状态。
- [x] 发布主题任务时提供现有主题和新建主题选项；选现有主题自动沿用名字与起止日期，新增任务照常填写并提交。新建主题保留原字段校验。
- [x] 发布和异步读取保持原资源操作锁，校验已选主题仍有效，不写真实测试数据。测试覆盖进行中/未开始/已结束、同名不同日期、空列表、快速点击及普通任务回归。

## 实施验证记录

- 新背景1536×1024、51,498字节；清单222项、按屏幕密度选212项，普通版6,788,157字节、高清版7,618,839字节，含90帧和11音频。
- 503项Node测试、77项Python图片/配置检查、全部根JS与19个Python脚本语法、两个导入/清单脚本逐字节`--check`通过。
- 真实localhost浏览器冷启动213次且213唯一（212清单资源+favicon），准备背景1次；后续4次热启动游戏媒体0网络；登录当前树/场景/斧头0新增游戏媒体。
- 五视口、真实SW接管、音频Range206/416、单文件更新、503后只补失败项、按钮忙碌与防重复提交、失败恢复、原有新手引导通过。无截图、外部网络或真实账号数据库请求。
- 同名主题沿用玩家归组日期，但必须有真实活动中的原任务；已补“过去与未来活动中间空档”和表单跨日复核，主题专项17项通过。
