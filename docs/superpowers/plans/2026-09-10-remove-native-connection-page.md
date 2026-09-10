# Remove Native Connection Page Implementation Plan

> **For agentic workers:** Execute the approved removal in this session; independently inspect the Android build and review the startup/error paths. User already instructed removal if this is our own page; no additional design gate or visual acceptance.

**Goal:** 删除 APK 自建的“仙字图标 + 正在连接仙途 + 转圈”占位页，直接显示网页的入境准备流程。

**Architecture:** MainActivity从启动即显示WebView，原生纸面仅作窗口/首帧底色；独立errorPanel默认隐藏，只有连接失败、证书问题或渲染器退出才出现。网页LoginBoot保持原逻辑，不添加闪屏时长、品牌中转页或资源请求。

**Tech Stack:** Android系统Activity/WebView、现有Java/DEX本机构建工具、原签名证书。

## Global Constraints

- 用户截图与`MainActivity.createLoadingView`的128dp launcher_foreground、connecting字符串和32dp ProgressBar精确对应；这是项目自建页面，不是Android系统启动屏。
- 删除正常连接页；不删除失败重试、主文档30秒超时、TLS拒绝、返回键和后台音频处理。
- 不额外生图、不做截图/视觉验收、不触碰玩家数据或签名材料；保留旧APK，原包名原证书覆盖升级。
- Android系统自己的短暂启动图标不等于被删除的整页，不声称绕过所有厂商系统启动行为。

### Task 1: 原生启动与错误恢复

**Files:** `android-app/app/src/main/java/cn/xianlai/game/MainActivity.java`, `android-app/app/src/main/res/values/strings.xml`, `android-app/app/src/main/res/values/styles.xml`。

- [x] 将`loading/createLoadingView`改为`errorPanel/createErrorView`；移除ImageView/ProgressBar/connecting，面板创建时设置`View.GONE`。
- [x] `connect()`隐藏errorPanel，首次新建WebView直接显示并加载可信URL；重试复用旧WebView时保持隐藏直到新文档commit，防止上次失败页闪回。`showError()`仍停止并隐藏WebView、展示错误文案与重试；`revealPage()`取消deadline、隐藏错误层和同步前后台。
- [x] 初始窗口和WebView底色使用与网页准备页相同的`#EEEEE2`；保留原图标paper颜色，以新`entry_paper`资源设置窗口/系统栏。
- [x] 独立代码审查正常启动、首次失败、重试、渲染器退出和迟到回调；执行真实Java/资源/DEX编译及现有导航策略测试，不用静态字符串断言伪装设备UI测试。

### Task 2: 覆盖升级交付

**Files:** `android-app/app/src/main/AndroidManifest.xml`, `android-app/app/build.gradle`, `android-app/README.md`, `docs/PROJECT_PLAYBOOK.md`。

- [x] 版本改为`versionCode 3`/`versionName 1.0.2`，固定`cn.xianlai.game`和原签名。
- [x] 运行`node android-app/build-android.cjs`，输出同级`安卓安装包/xianlai-1.0.2.apk`；验证元数据、对齐、v2/v3签名以及与1.0.1的证书一致。不得重新初始化签名或覆盖旧APK。
- [x] 执行仓库要求的Node回归、JS/Python语法及素材校验、差异/凭据检查；安卓任务不修改网页或图片；追加的天道任务不改资源URL，清单--check验证不重建。
- [x] 更新制作规范、准备提交推送源码；交付新APK路径，明确需要覆盖安装，不能靠刷新旧APK去除原生页面。没有设备时明确未进行真机启动验证。

### Task 3: 天道奖励发布操作（用户追加，直接执行）

**Files:** `app.js`的AdminView、`styles.css`的天道奖励编辑器局部样式、`index.html`修改文件缓存版本、天道奖励和主题发布测试。

- [x] 任务奖励改为原生道具下拉选择＋正整数数量＋添加/移除行，显示当前所选道具的现用图标；ITEMS为选项来源，按类型分组、名字优先，合并重复道具，不需要用户输入ID。
- [x] 发布任务和自主任务奖励审核复用编辑器，既有砍树次数字段保持独立；保持主题选择、草稿、原子审核、防连点及失败保留表单。不访问真实账号数据库。
- [x] 审查所有天道道具展示，使用共享renderItemIcon/getItemIconPath读取现用美术；GM保留下拉操作并提供当前道具图预览，不重导图片或手改配置。
- [x] 测试多种道具、重复合并、删除、空列表、非法数量、主题继承、草稿和失败/快速点击，检查新UI的真实DOM交互（无截图、模拟账号）；运行全量Node及语法，清单--check和本次线上字节校验。

## 安装包验证回执

- 1.0.2 / versionCode 3，包名`cn.xianlai.game`；APK 209,363字节，SHA256 `719b15b97e26b44f5319579a5a82ea1fcda4951fc38cca91eee2fb0b0edffd90`。
- 27项导航策略检查、Java/DEX/资源编译、对齐、v2/v3签名和元数据检查通过；与1.0.1的签名证书SHA完全一致，0/1旧包保留。
- 直接检查APK资源表，已无`string/connecting`及“正在连接仙途…”；只保留异常提示和重试。
- 当前无连接设备和可用模拟器镜像，未进行Android运行或视觉验收。发布回执以提交后对应Pages状态与线上修改文件逐字节验证为准。
- 网页最终512项Node回归、77项Python图片/配置检查、JS/Python语法和启动资源清单一致性检查通过。天道选择器在390×844和1440×900执行真实DOM操作，检查奖励合并、删除、主题继承、非法值、防连点、失败保留及GM新版图标；使用模拟数据，无截图或真实数据库写入。
