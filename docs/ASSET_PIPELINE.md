# 美术资源制作与切图流程

目标是让同类资源尽量在一张图中生成，再用确定性脚本切割，既节省生成费用，也保证每次替换结果一致。

## 1. 通用标准

- 源图保留在仓库同级的项目资源目录，最终资源才进入 `assets/images/`。
- 序列帧必须使用透明背景，角色比例、脚底基线和视觉中心保持一致。
- 不在 CSS 中硬画本应由正式美术承担的主体图标。
- 同一类型资源尽量使用统一画布、光源、线条粗细和色彩饱和度。
- UI 风格追求清新、淡雅、有仙气，避免大面积金银财宝、强烈土豪金和过度发光。
- 切图脚本必须同时校验数量、尺寸、RGBA 和透明通道。

## 2. 砍树斧头序列帧

源目录：

```text
../砍树斧头对应帧V2/
```

要求：

- 9 张图，对应道具 ID：`51001`, `51002`, `52001`, `52002`, `53001`, `53002`, `54001`, `54002`, `55001`。
- 文件名必须以五位道具 ID 和短横线开头。
- 每张图 6 帧。
- 相邻帧之间用 `#FF00FF` 竖直分隔线。
- 输出单帧为 `362 x 724` RGBA PNG。

执行：

```bat
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe scripts\split_axe_sheets.py
```

输出：

```text
assets/images/character/axes/{itemId}/frame-01.png ... frame-06.png
```

成功时脚本必须报告 54 帧。脚本会识别并清除洋红分隔线，再按分隔线切割，而不是按平均宽度盲切。

## 3. 待机斧头序列帧

源目录：

```text
../待机斧头对应帧/
```

要求：

- 9 张图，文件名规则与砍树图一致。
- 每张图 4 个等宽动作格。
- 每个动作格内必须有透明背景。
- 输出单帧为 `362 x 724` RGBA PNG。

执行：

```bat
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe scripts\split_idle_axe_sheets.py
```

输出：

```text
assets/images/character/idle-axes/{itemId}/frame-01.png ... frame-04.png
```

成功时脚本必须报告 36 帧。脚本先按透明轮廓提取完整角色并保留原第 1 帧锚点，再应用 `scripts/idle_frame_offsets.json` 的逐帧校准。校准横向看身体、纵向看鞋底，不得按包含摆动斧头/裙摆的完整包围盒直接居中。

- 校准记录只适用于对应的原始源图；替换源图后必须重新测量，不能沿用旧偏移。
- 每次均从原始图集切割和校正，不对已经校正的文件重复平移。
- 有效透明边缘也应保留，边界限制优先于强行完全对齐。本轮 `53001` 第3帧为保留裙摆，允许少量横向残差，游戏显示尺寸下小于3px。
- 36帧输出仍为362x724，9张第1帧和全部54张砍树帧保持不变。运行时待机WebP仍为256x512。
- 执行 `python tests/character-frame-alignment.test.py` 检查身体、落脚点、边缘与既有砍树锚点，再执行运行资源规格测试。

## 4. 其他批量图集

- `scripts/process_visual_atlases.py`：处理 UI、美术图集等指定输入输出资源。
- `scripts/split_character_sheets.py`：处理旧版角色待机/砍树序列，仅保留给旧资源兼容。
- `scripts/import_login_art.py`：导入登录背景与加载示意资源。

运行前先查看脚本参数，不要直接覆盖不相关资源。

## 5. 代码接入

- 道具图标统一通过 `renderItemIcon()`，优先使用飞书同步得到的 `iconImage`。
- 功能图标统一通过 `renderFeatureIcon()` 和现有资源清单。
- 装备切换时同时调用 `getAxeIdleFrames(itemId)` 与 `getAxeChopFrames(itemId)`。
- 新的通用首屏资源加入 `getInitialGameImageAssets()`；不要把所有武器序列帧加入首屏。
- 登录阶段先并行加载通用资源与玩家数据，拿到当前装备 ID 后只加载该武器的 4 帧待机和 6 帧砍树动作。
- 切换装备时先调用 `preloadAxeAnimation(itemId)`，加载完成后再刷新修炼场景。
- 不改变背包格尺寸时，优先调整格内图片占比和安全边距，不破坏数量角标可读性。

## 6. 浏览器运行资源

源 PNG/WebP 始终保留在 `assets/images/`，网页实际读取的压缩资源位于 `assets/runtime/`。

执行：

```bat
python scripts\build_runtime_images.py
```

固定输出规则：

- 角色帧：`256 x 512`、透明 WebP、quality 90。
- 背景：最长边界不超过 `1600 x 1000`，WebP quality 84。
- 仙树：不超过 `512 x 512`。
- UI：不超过 `256 x 256`。
- 图标和特效：不超过 `160 x 160`。
- `assets/runtime/v2/manifest.json` 由脚本生成，不手动编辑。
- 上述256x256限制仅适用于现有小UI资源；接入新的长条九宫格框时需增加独立尺寸规则，不能把960px宽的边框按这条压成模糊小图。
- 替换任何源美术后必须重新执行构建脚本，并运行图片规格测试。

当前构建基线（2026-09-06）：

- 纳入运行时构建的源资源：`19.54 MiB`。
- 完整 WebP 运行资源：`3.27 MiB`，减少 `83.2%`。
- 角色动作：`14.15 MiB` 降至 `2.21 MiB`。
- 动作首登请求从 90 张降至当前武器的 10 张；其余武器在换装时加载。

## 7. 音频资源

原始音频保留在仓库同级目录：

```text
../音频资源/
```

网页运行文件位于 `assets/runtime/audio/`。替换 WAV 音效后执行：

```bat
node scripts\normalize_audio.js
```

- 脚本只接受 16-bit PCM WAV，并从原始目录重新生成，不能对已归一化文件反复放大。
- 点击、打开、砍树、掉落、锻造过程和锻造成功分别使用脚本内固定目标峰值。
- BGM 不参与 WAV 归一化，浏览器混音保持轻柔，关键操作音效必须清楚高于 BGM。
- 修改目标峰值或 `audio-manager.js` 混音参数时，必须同步更新音频测试。

### 奖励反馈音效（2026-09-09）

- 当前输入为`奖励-逐项出现.wav`、`掉落-珍品.wav`、`掉落-神仙品.wav`、`斧技-发动V2.wav`，分别导出`reward-reveal.wav`、`drop-rare.wav`、`drop-high.wav`、`skill-trigger.wav`。旧版`斧技-发动.wav`仍在原目录保留，不覆盖或删除。
- 运行`node scripts/normalize_audio.js --rewards-only`；只替换斧技时使用`node scripts/normalize_audio.js --skill-only`，不会重写其他十个音频。任一命令加`--check`可不写入地验证确定性输出；两种限定模式不能同时指定。
- 四条音效均为原生PCM16、40kHz、双声道，完整时长0.2/0.5/0.8/0.68秒；峰值目标0.62/0.70/0.76/0.72，运行混音0.48/0.64/0.68/0.74。四文件共349,768字节，全音频2,098,044字节（约2.001MiB），预算2.1MiB。V2技能109,042字节，比旧版增加44,800字节，不裁尾、不改变采样率或音调；其余十文件逐字节不变。
- V2源SHA256为`810722dfcf26011473c2989e38fed3c8fd83953d44efb594dfcc7dab3e06395b`；源峰值0.273102、RMS0.050590，固定增益2.63638倍后峰值0.720001、RMS0.133374。默认播放混音0.74，有效峰值约0.5328、RMS约0.09870，相比旧版有效RMS增加约4.24dB。只给`skill-trigger.wav`添加`?v=skill-v2-20260909`缓存参数，其他音频URL和混音保持原样。
- 斧技优先仅由奖励表现层在播放前停止当前奖励弹窗自身的旧尾音，不停止BGM或其他组，不增加全局压低BGM的逻辑。返还提示仍独立使用`chop-refunds`组及自身的限频/音量系数，全局静音仍立即停止所有音频。
- `AudioManager.playEffect(name,{group,volumeScale,playbackRate})`每组最多3声、全局最多12声，满额不再叠加；`stopEffects(group)`立即取消该组，原始音频不可重复增益处理。测试`audio-reward-assets.test.js`校验来源、峰值、时长及旧文件指纹。
- 登录预览`assets/runtime/v3/backgrounds/login-preview.webp`由原运行登录图缩为240x180，2398字节，仅首屏占位使用；完整背景、Logo、按钮及六墨纹保持原图与URL。初始圆环48px，无需新增AI资源。

## 8. 验证清单

- 文件数量正确：砍树 54 帧，待机 36 帧。
- 每帧尺寸为 `362 x 724`。
- 图片模式为 RGBA，透明通道有效。
- 角色身体、裙摆、头饰、斧头没有被裁断。
- 同组帧脚底不跳、身体不左右漂移。
- 洋红分隔线没有残留。
- 装备 9 把斧头时，待机和砍树都使用相同道具 ID 的资源。
- 十连砍中间不插入待机帧，最后一次结束后才恢复待机。
- 运行资源为 WebP，90 帧角色合计小于 4 MiB，全部运行图片合计小于 7 MiB。

除非用户明确要求，不执行浏览器视觉验收；脚本和自动测试仍必须完成。

## 9. 仙来 V3 水墨资源

- 原图目录：仓库同级 `美术风格参考V３`，末位为全角数字。包含独立logo、无字登录背景、2列3行框图集、3列2行功能图标图集。
- 导入：`python scripts/import_xianlai_art.py`，再执行 `python scripts/build_runtime_images.py`。
- 输出在 `assets/images/v3` 与 `assets/runtime/v3`；原始四图不覆盖。清除透明区噪点和绿边，不按去黑算法损伤墨色笔画。
- 本次14张运行图片合计443,002字节。功能图标160x160；logo949x512；界面框保留536至692px原生宽，不能套用V2的256px上限。
- `source-manifest.json`记录原始文件指纹和切片尺寸；运行manifest记录输出尺寸及九宫格上/右/下/左slice。换图后核对slice，不能盲目沿用旧切片。
- `xianlai-ui.css`绘制点击穿透的九宫格背景，保持现有布局占位；`login-art.css/js`负责独立登录排布和轻水墨动效。不把临时示意加入正式页面。
- `getFeatureIconPath()`统一解析新旧图标；首屏预加载必须包含所有使用中的V3素材。声音只切换状态类和辅助标签，不再用textContent覆盖图标图片。
- LoginArt跟随实际加载进度、不增加人为等待；后台、离屏和离开登录页时停动画，减少动态模式使用静态显示。登录失败后，旧预加载回调不得再隐藏恢复的表单。
- 回归执行 `python tests/xianlai-art-assets.test.py`，连同既有图片规格/锚点测试；无账号自动检查含360/390/1440和844x390横屏，不做额外视觉验收。

## 10. V4 道具与弹窗资源

- 原图目录为仓库同级 `美术风格参考V4`，6张原图保持不变。基础图实际名为`基础与成长道具.png`，其余5张以`仙来V4-`开头。
- 运行 `python scripts/import_xianlai_v4_art.py` 后运行 `python scripts/build_runtime_images.py`。图集并未严格遵守均分格子，切图按实测透明间隔进行；更换源图尺寸后必须重新测量，禁止盲用旧边界。
- 28张物品图标、两种物品框、通用弹窗纸面、锻造入口与按钮共33张，运行时合计491,848字节。19个普通道具160x160，9把斧头192x256，锻造入口160x160；不改变已有角色动作图片。
- 原图与裁切来源记录在 `assets/images/v4/source-manifest.json`，运行时路径与切片参数在 `assets/runtime/v4/manifest.json`。slice顺序为上、右、下、左：方框及竖框均33；弹窗134/78/81/153；锻造按钮32/128/48/89。不得套用提示词中的目标像素。
- 仅清理alpha小于5的极透明彩噪，不去除黑色墨线，也不按最大连通块丢掉钱绳、碎片或火星。保留完整边缘和透明安全区。
- `getItemIconPath()`统一解析V4图标；`sync-config.py`优先引用已存在的V4运行图，未接入V4的新道具仍使用飞书图片。飞书内旧缩略图不会覆盖已批准的新画法。新名字仍以飞书为准，不在前端维护另一份显示名表。
- `xianlai-v4.css`负责中性品质框、角标、统一弹窗和锻造按钮，按基础样式/V3/V4/手机布局的顺序加载。文字、数量、新标记、锁定、品质色标不烘焙进图片。
- 校验 `tests/xianlai-v4-assets.test.py`、`tests/xianlai-v4-integration.test.js`、`tests/xianlai-v4-ui.test.js`，连同既有V3/运行资源/角色锚点测试。浏览器图片与几何检查不截图、不登录真实账号。

## 11. 小型水墨反馈资源

- 关闭图标为本地 `assets/runtime/ui/close.svg`，来自Lucide Static 0.468.0的X，使用ISC许可；同目录保留许可文本。仅修改墨色，不需要生成位图。
- 旧版返回符号`assets/runtime/ui/undo-2.svg`保留为历史资源。当前底栏已使用用户提供的水墨箭头，仍铺现有`v2/ui/chop-button-bg.webp`圆底；接入参数见第15节。
- 落叶从原 `assets/images/v2/effects/effect-leaf-green.png`确定性提取，不覆盖原图。运行 `python scripts/extract_ink_leaf.py`，输出 `assets/images/effects/leaf-ink.png`、来源记录及 `assets/runtime/effects/leaf-ink.webp`。
- 小叶48x64、无损透明WebP、当前1400字节。脚本使用实测轮廓去掉外圈，并转换为青灰色保留像素叶脉；源图尺寸变动时必须重新测量。
- 运行 `python scripts/extract_ink_leaf.py --check`验证来源指纹、生成结果一致性、透明度和4KiB上限。此文件不依赖V2批量构建，更新叶片单独跑此脚本即可。
- 使用中资源URL必须与首屏预载相同，包含缓存版本。旧V2光效保留在资源目录中备查，但不再预载或参与每刀命中。

## 12. V5 墨影与任务商品纸笺

- 原图目录为仓库同级`美术风格参考V５`，末位是全角5。两张1536x1024原图保持不变，来源指纹记录在`assets/images/v5/source-manifest.json`。
- 导入运行`python scripts/import_xianlai_v5_art.py`，然后`python scripts/build_runtime_images.py --v5-only`。后者只处理V5，避免重建旧图；常规全量构建也已包含V5。
- 纸图是RGBA，透明区虽然保存了灰黑RGB但alpha为0，不可误判成黑色背景。按alpha>=5实测边界裁切，加12px安全边；两框不是用整张半幅直接拉伸。
- 墨图是RGB近白底，按亮度转透明度并清掉近白噪点，不做粗暴去白。输出六张512x512透明墨纹，保留浓淡与飞白，色值统一为墨灰；这不是序列帧动画。
- 运行图共8张，总计185,918字节。task-paper为960x200，slice上右下左86/61/51/122；shop-paper为960x199，slice56/130/122/61。两框都保留完整边角，内容区随文案延展。
- 两张纸框进入游戏必需预载。六张墨纹使用`?v=xianlai-v5-20260908`，正式入口由LoginBoot预备后注入LoginArt；失败可简化进入，不加入验证后的游戏加载队列，也不回退到程序水纹。
- 校验`python tests/xianlai-v5-assets.test.py`、`node --test tests/v5-*.test.js`，再跑既有图片和功能测试。原图替换后重新量alpha范围、边界与slice，不能盲沿用当前常量。

## 13. V6 品质墨记与登录按钮

- 原图目录为仓库同级`美术风格参考V6`，包含`仙来V6-品质徽记图集.png`和`仙来V6-登录按钮图集.png`，均为1536x1024 RGBA。品质已改为平面短竖墨痕，不使用旧提示词中的玉石切面徽章；文件名保留用户原名。
- 执行`python scripts/import_xianlai_v6_art.py`，再执行`python scripts/build_runtime_images.py --v6-only`。仅重建V6，原图及旧版本资源保持不变；全量构建也包含V6。
- 透明像素带黑色或光晕RGB，不等于可见黑底。只清理alpha小于5的噪点，按实际alpha轮廓裁切并四周补12px透明边，不按RGB去黑、不截断笔锋。六格品质图最后一格留空；登录图上下分别为墨刷和书法字。
- 源图实测bounds及指纹位于`assets/images/v6/source-manifest.json`。五枚品质源图169至171x435，运行图均44x112；墨刷源1487x340、运行960x220；文字源1187x361、运行768x234。7张WebP共170,762字节（约167KiB），不按整格512px缩图造成标记继续过小。
- 所有运行URL使用`?v=xianlai-v6-20260908`。五枚墨记进入游戏首登预载；按钮两层在HTML头部预载，与实际img及点击墨影引用完全一致，不加入验证后的游戏必需资源队列。
- 校验`python tests/xianlai-v6-assets.test.py`及`node --test tests/v6-*.test.js`。`node tests/v6-art.browser-check.cjs`用本地模拟数据检查四视口、图片透明度、两种背包、悬浮/焦点、失败兜底和登录恢复，无截图、无真实账号。

## 14. V7 奖励墨团与双栏背包纸面

- 原图位于仓库同级`美术风格参考V7`。`仙来V7-奖励品质墨团图集.png`实际1536x1024、RGBA、alpha为0至254；`仙来V7-双栏背包底纸.png`实际1774x887、RGBA、alpha为0至255。不能按提示词中的1024x512尺寸硬切纸面，原图保持不变。
- 执行`python scripts/import_xianlai_v7_art.py`，再执行`python scripts/build_runtime_images.py --v7-only`。只重建V7；全量构建也包含V7。来源SHA、实际格子、alpha边界及透明安全边记录于`assets/images/v7/source-manifest.json`。
- 只清理alpha小于5的透明彩噪，不按RGB去黑或最大连通块丢弃碎墨。奖励图按3列2行的512x512格提取，最后一格清噪后为空；完整格等比缩成256x256透明PNG与WebP，保留约20px以上透明边。五张依次为灰、蓝、紫、玫红、金，不拉伸V6竖向品质墨记充当墨团。
- 纸面有效alpha边界为`61,114,1716,773`，裁切后加四周12px透明边，源PNG为1679x683，运行WebP为960x391。九宫格上/右/下/左源slice为`216/320/200/380`，运行slice为`124/183/114/217`，保留边角云叶及风纹。手机显示边框建议6至8px，不按源slice占用内容内边距；两栏与道具格由布局生成，不烘焙进纸面或再嵌套两张纸框。
- 五张墨团位于`assets/runtime/v7/rewards/quality-1.webp`至`quality-5.webp`；纸面为`assets/runtime/v7/ui/inventory-paper.webp`。六张WebP共145,430字节（约142KiB），运行路径与首屏预载使用相同的`?v=xianlai-v7-20260909`。
- 校验`python tests/xianlai-v7-assets.test.py`，检查精确资产数、来源指纹、原图逐像素重建、透明边、品质中心色、纸面可读留白及200KiB体积上限。再跑既有V5/V6图片回归；不得因新版本重建而覆盖旧图片。

## 15. 返回箭头与等级经验槽

- 原图仍在仓库同级`美术风格参考V7`，本组独立处理，不并入原V7六张资源构建。`仙来-返回箭头.png`实际1254x1254、RGBA；`仙来-等级经验条图集.png`实际1536x1024、RGBA。原图保持不变，来源SHA记录在`assets/images/ink-controls/source-manifest.json`，替换源图必须重新测量并更新脚本指纹，不盲沿用提示词坐标。
- 执行`python scripts/import_ink_controls.py`一次同时输出PNG与WebP；`python scripts/import_ink_controls.py --check`逐字节重建验证且不写文件。该脚本仅写`assets/images/ink-controls/`及`assets/runtime/ink-controls/`，不要为这三张图片重新运行旧版全量构建。
- 两图显示出的黑色或大光晕主要是alpha低于5的透明区残留RGB。仅清理alpha小于5的像素，保留黑色墨线和低透明度笔锋；不按RGB去黑、不另套会裁断轮廓的几何遮罩。运行缩图后同样清理极透明插值噪点。
- 箭头实测有效范围为`267,362,986,898`，四边补12px，源PNG743x560，运行WebP160x121、4392字节。保持原宽高比；在现有圆形按钮背景里按约60px宽完整显示，不给箭头再烘焙圆底。
- 空经验槽实测范围`106,288,1431,344`，满经验槽`106,682,1431,738`；二者主体均1325x56、水平端点一致。分别按实际槽体裁切并四边补4px，源PNG均1333x64，运行WebP均960x46，有效alpha边界均`2,3,957,42`。不得把整张半幅图或大光晕拿来缩放成经验槽。
- 运行路径为`assets/runtime/ink-controls/return-arrow.webp`、`exp-track.webp`、`exp-fill.webp`，三张合计17604字节（约17.2KiB）。空槽6784字节，满槽6428字节；均quality90、保留无损透明通道。运行manifest保存精确尺寸、alpha边界、体积与切片参数。
- 经验槽九宫格slice按上/右/下/左，源图`8/61/8/61`，运行`6/44/6/44`。两层在任何进度均使用相同完整槽尺寸；先固定纹理/端帽，再用裁切揭示填充，不能随进度压缩整张满槽图而移动左端、改变纹理或缩小右端帽。网页显示高度与文字由布局决定，不烘焙数字进图片。
- 校验`python tests/ink-controls-assets.test.py`与脚本`--check`，覆盖准确三图、来源指纹、逐像素裁切、运行alpha保留、两槽对齐、墨色对比及体积。新素材实际URL和预载应使用完全相同缓存版本；原V7六张资源不得被覆盖。

## 16. 仙斧评级字标

- 源图在仓库同级`美术风格参考V7`，名字为仙来-仙斧评级字标图集.png且开头实际带一个反引号，保留用户原名，精确名称和SHA见`assets/images/weapon-ratings/source-manifest.json`。原图1536x1024、RGBA、3列2行，第一行B/A/S，第二行SS/SSS/空。
- 运行`python scripts/import_weapon_ratings.py`仅输出此组PNG/WebP/manifest；`--check`无写入重建校验。仅清alpha小于5的噪点，不按预览黑色RGB去黑。真实字标边界由脚本逐项校验，源图换了必须重新测量，不盲目使用原坐标。
- 原始五款轮廓依次251x320、311x324、272x334、385x292、459x283。等比统一成可见字高72px、底线y=84，放在192x96透明画布；最终可见宽56/69/59/95/117px。B/A/S不横向拉宽到SSS，不把整格512px直接缩小。
- 正式图位于`assets/runtime/weapon-ratings/rating-b.webp`、`rating-a.webp`、`rating-s.webp`、`rating-ss.webp`、`rating-sss.webp`，5张共18,736字节，WebP质量90、保留透明通道；PNG导出和源记录在`assets/images/weapon-ratings`。
- 运行URL与首登预载均使用`?v=weapon-ratings-20260909`。格底36x18px占位（实际字高13.5px），行内48x24px（实际字高18px）；所有评级用同一画布比例，不靠改变不同等级字体尺寸来制造稀有度差异。
- 装备对勾为Lucide Static0.468.0的`assets/runtime/ui/check.svg`，仅修改墨绿描边，同目录ISC许可证沿用；它属于状态图标，不是评级美术，不增加底板。
- `python tests/weapon-rating-assets.test.py`验证5款数量、尺寸、透明安全边、字高/基线、源指纹、重建、色彩和40KiB预算；图片到位后不得再把本组标记为“待生成”。

## 17. 天工开物展示台与装备墨签

- 原图位于仓库同级`美术风格参考V7/仙来-锻造展示台与装备墨签.png`，实际1536x1024、RGBA、alpha为0至254，1,551,048字节。源SHA256为`f9ae42f8438a527edf3260467a0482c1fb8f125494f1daca044e4a968418103a`；源图保持不变，替换后须重新测量，脚本不会盲用旧裁切。
- 运行`python scripts/import_forge_art.py`同时输出本组PNG、WebP与manifest；`python scripts/import_forge_art.py --check`逐字节重建校验且不写文件。只写`assets/images/forge-workshop/`与`assets/runtime/forge-workshop/`，不重建原V7、锻造按钮或其他历史资源。
- 两素材横向分离，alpha至少5的有效区域之间有12px完整透明间隔`x=817..828`，在`x=823`切开。展示台有效bounds为`48,52,817,979`，墨签为`829,417,1498,600`；按各自完整轮廓裁切后补四边12px透明安全边，PNG分别793x951和693x207。只清理alpha小于5的透明噪点，保留黑色墨线、细碎边缘和所有其他可见像素，不按最大连通块丢弃碎墨。
- 正式运行图为`assets/runtime/forge-workshop/stage.webp`（320x384、45,042字节）和`equip-slip.webp`（288x86、8,284字节），总计53,326字节（约52.1KiB），预算96KiB。等比缩小到整数尺寸、WebP quality90且保留无损alpha，缩图后再清理alpha小于5的插值噪点；运行alpha bounds分别`5,5,315,379`及`5,5,283,81`，四周均有5px安全边。
- 展示台完整等比铺在锻造场景中，斧头和装备操作作为独立叠层；不可将场景拉宽变形。墨签建议96px宽、等比约28.7px高，点击区单独保留至少44px高；不把按钮文字烘焙进图。实际引用与初始预载均使用`?v=forge-workshop-20260909`。
- `python tests/forge-art-assets.test.py`检查精确两图、尺寸、路径、透明安全边、源与产物指纹、透明间隔、所有可见源像素无遗漏且只导出一次、无损alpha、确定性重建和字节预算。原图变更会先校验失败，不覆盖已有结果。

## 18. 五阶段祈愿宝树

- 原图为仓库同级`美术风格参考V7/仙来-五阶段仙树图集.png`，实际1536x1024、RGBA、alpha为0至253、2,371,358字节；源SHA256为`0640347cf5c52cb81282e0ce8ae7b391a47b9ce90f4b3cbb3d9c0d452049645e`。背景大光晕主要是alpha小于5的RGB残留，只清理极透明噪点，不按黑色RGB去背景。源图与旧仙树资源保持不变。
- 执行`python scripts/import_wish_trees.py`只生成`assets/images/wish-trees/`、`assets/runtime/wish-trees/`；`--check`不写文件，逐字节重建验证。本组不能用旧V2全量构建替代。源图替换后必须重新测量，脚本检查指纹，禁止盲沿用旧裁切。
- 图集看似3列2行，但第5棵顶部越过y512、右枝越过x1024。上排分界为y490；下排第4/5棵分界为x520。alpha至少5的完整透明间隔为`y471..489`和下排`x509..531`。五棵完整有效bounds依次为`142,101,441,468`、`589,73,956,468`、`1062,33,1490,471`、`23,515,509,994`、`532,508,1074,996`；不能按512方格裁断第5棵，也不能丢掉吊签、细绳或根须。
- 1x十张PNG/WebP均384x384，原图像文件逐字节保持不变。五棵统一等比缩放0.64，保留天然的逐阶长大；仅平移对齐根部最底线与下段主干实际像素，不能按树冠包围盒居中。画布受击点统一`176,272`、根部底线y360，归一化为`0.4583333333,0.7083333333`及`groundY=0.9375`。五个源受击点为`239,330.5`、`756,330.5`、`1253,333.5`、`244,856.5`、`766,858.5`，均在真实棕色主干上；根部中心横坐标允许天然造型小偏差。
- 五棵运行alpha bounds分别为`114,126,305,360`、`69,108,303,360`、`54,80,328,360`、`35,55,345,360`、`27,47,373,360`。画布不能再按这些bounds独立缩放，否则会破坏统一落地/受击锚点。树冠落叶源归一化依次`0.57,0.4141666667`、`0.5283333333,0.3975`、`0.4766666667,0.3291666667`、`0.4816666667,0.2825`、`0.5033333333,0.2725`，实际锚点在两份manifest的`anchors`及`canvasAnchors`字段。
- 正式树图为`assets/runtime/wish-trees/tree_01.webp`至`tree_05.webp`；同画布亮层为`light-01.webp`至`light-05.webp`。树图分别25,198/35,720/47,318/58,428/64,916字节；亮层6,780/11,270/19,310/24,726/35,748字节，总计329,414字节（约321.7KiB），预算400KiB。均quality90，透明通道无损，保留至少8px安全边。
- 2x版本为`tree_01@2x.webp`至`tree_05@2x.webp`和`light-01@2x.webp`至`light-05@2x.webp`，同名PNG保留在源输出目录。十张均768x768、quality95，合计1,160,096字节（约1.106MiB），独立预算1.4MiB。树图从原图完整裁剪单次affine BICUBIC采样，统一scale1.28；不放大384px旧图，也不经过旧版的Lanczos缩小步骤。受击点为`352,544`、根部底线y720，全部归一化锚点不变，透明安全边至少16px。高清保留原画已有细节，不生成新纹理或改变外形；亮层直接从本密度树图抽取，不能拉伸1x亮层充当2x。
- 两份manifest按`density:1/2`标记资产，2x键增加`@2x`，`canvasAnchors`为实际像素、`anchors`为共享归一化坐标；源manifest的`densities`分别记录尺寸、scale、实际体积与预算。`--check`从同一指纹原atlas确定性重建两套及两份manifest。前端DPR大于1使用2x，其余使用原1x；本次加载仅预载所选密度的五树与五亮层，显示、详情和预载使用同一密度及缓存版本，避免下载两套。
- 亮层只从规范化原图中亮度高于190、alpha至少64的真实亮部提取，RGB不变，仅按亮度调整alpha；覆盖树有效轮廓7.3%至17.8%。不绘制光圈、射线、外部粒子或额外模糊。亮层与树完全同尺寸同锚点，可用低opacity的screen叠合制造少量明暗呼吸；不能对整个树加亮或重新缩放亮层。隐藏、离页或减少动态时保持静态，装饰不拦截点击。
- `python tests/wish-tree-assets.test.py`验证每种格式精确二十图、两套尺寸/预算、主干实体打击点、密度间锚点及轮廓对齐、五树根部同底线、自然增长、原画完整分区和每个可见像素仅导出一次、亮层仅含本密度原亮像素且覆盖不足25%、无损alpha、来源指纹、确定性重建与独立输出。旧1x二十个PNG/WebP的组合SHA固定为`c945ab06e0b0515f42d81e423dab04c0d16a3e8b59f1285f03348a8e0f8ec014`；HD构建测试禁止调用resize，并验证其保留旧384px简单放大中不存在的原画细节。实际使用路径与预载路径保持同一缓存版本。
