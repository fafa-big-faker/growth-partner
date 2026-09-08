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
- 两张纸框进入游戏必需预载。六张墨纹使用`?v=xianlai-v5-20260908`，由LoginArt独立后台加载，不阻塞登录；首次载入缺图时不回退到程序水纹。
- 校验`python tests/xianlai-v5-assets.test.py`、`node --test tests/v5-*.test.js`，再跑既有图片和功能测试。原图替换后重新量alpha范围、边界与slice，不能盲沿用当前常量。
