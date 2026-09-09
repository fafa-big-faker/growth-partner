# 仙来 Android 轻量版

此安装包是线上仙来的独立入口，应用名称「仙来」，固定包名 `cn.xianlai.game`。支持 Android 8.0 及以上，需要联网及较新的 Android System WebView。游戏页面、配置与素材来自正式站点，玩家数据仍由原来的 Supabase 保存。应用和手机浏览器各自保存登录会话；安装后使用原账号登录即可。

网页更新仍走原来的 GitHub Pages 发布流程。每次重新启动应用都会请求新的入口 HTML，已版本化的图片与脚本保留正常缓存。切回应用时不强制刷新正在进行的修炼。改名称、图标、原生行为时，须提升 Android 版本并用同一证书重新打包，覆盖安装。

## 构建和签名

本机零下载构建：`node android-app/build-android.cjs`。脚本自动找到已安装的 Unity Android 工具链，或者读取 `XIANLAI_ANDROID_SDK` / `XIANLAI_JAVA_HOME`。输出目录默认为仓库同级 `安卓安装包`，可通过 `XIANLAI_APK_OUTPUT` 指定。首次使用需要 `node android-app/build-android.cjs --init-signing` 创建专用长期证书；此后必须使用原证书构建，脚本不会静默重建遗失证书。

证书与密码文件仅保存于仓库外 `%LOCALAPPDATA%/Xianlai/signing/`。首次生成时脚本也在仓库同级 `仙来签名备份（勿公开）` 保存一份恢复副本；请把整个备份目录另存到安全位置，不要上传仓库、发给玩家或与 APK 一起发布。丢失证书将无法给已安装应用做覆盖升级。签名文件完整位置记录在本地 `安卓安装包/构建记录.json`，记录不含密码。

脚本依次执行导航策略的 JVM 测试、资源编译、Java 编译、DEX 转换、打包、对齐、正式签名和签名验证。无第三方运行依赖，包内不包含游戏数据、Supabase 密钥或原生 JavaScript 对象。`app/` 同时是标准 Android 工程，可用 Android Studio 打开（Gradle 路径需要 JDK 17、Gradle 8.9；零下载脚本使用现有 JDK 11）。

当前 1.0.1 使用仓库同级 `美术风格参考V7/仙来-应用图标.png` 正式原图（1254×1254、不透明）。运行 `python android-app/import-official-icon.py` 或不带参数的 `python android-app/export-icon.py` 可确定性重新导出。脚本核对源指纹，实测仙字与朱印轮廓，把整幅原画等比缩到 226×226 后置于 324×324 前景，并用原图边缘镜像延展纸纹。实测主体半径 94.7612px，小于 Android 99px 保证安全半径；圆形和圆角方形裁切均不丢失主体像素。原画保留不改。

同一布局同时导出 `assets/runtime/app-icon/favicon.png`（64×64）和 `apple-touch-icon.png`（180×180），以及本地忽略目录中的图标裁切检查图。来源、布局参数与产物指纹在 `icon-source.json` 和网页目录的 `manifest.json`。替换新的正式原图时必须重新测量主体与裁切范围，不能照搬当前参数。

通用导出器仍接受显式新路径：`python android-app/export-icon.py path/to/icon.png`。透明主体图按 alpha 边界等比放进安全区；符合中央62%安全区的满幅方图可用 `--full-bleed`，不预先烘焙圆角。当前正式原图的朱印超出该约定，所以必须走专用导入脚本，不能直接套用满幅模式。1.0.1 的 versionCode 为 2，使用原证书，可覆盖安装 1.0.0，旧 APK 保留。

## 原生与网页接口

应用只加载 `https://fafa-big-faker.github.io/growth-partner/` 范围内的页面。其他 HTTP(S) 链接交给系统浏览器，其余 scheme 拦截。资源的正常跨站请求（例如 Supabase 和外部 SDK）保持网页行为；关闭明文通信、本地文件访问、混合内容和第三方 Cookie，不绕过证书错误。

原生只对可信游戏页调用 `window.XianlaiShell.handleBack()` 与 `window.XianlaiShell.setBackgrounded(boolean)`，没有 `addJavascriptInterface`。返回处理函数同步返回 `true` 表示网页已关闭弹层或返回修仙，`false` 时原生显示离开确认。没有新版网页接口时仍可打开游戏并由原生确认退出。切后台通知网页暂停声音，再暂停 WebView；回来恢复通知与 WebView，保留页面。

首屏网络失败提供重试，页面渲染器意外退出时重建 WebView 后重试。系统状态栏、导航手势与软键盘按原生安全区域留白。旋转保留同一个页面；系统回收进程后重新加载线上入口，不备份或导出本地会话。

## 验证范围

编译、导航边界测试、APK 元数据与签名校验由脚本执行。安装后的键盘、手势返回、锁屏静音、网络重试及当前手机 WebView 兼容性需要 Android 设备验证；未连接设备时不得声称真机测试通过。仓库现有网页功能测试与发布检查仍须执行。
