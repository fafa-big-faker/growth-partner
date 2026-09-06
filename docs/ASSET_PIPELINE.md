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

成功时脚本必须报告 36 帧。脚本按透明轮廓取完整角色，再统一缩放、水平居中和脚底基线，避免裙摆或斧头被格子边界裁断。

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
