# 项目开发与发布手册

这份手册记录日常开发中最容易重复、遗漏或卡住的流程。项目总体说明仍以 `HANDOVER.md` 为准。

## 1. 数据流

```text
飞书配置表 -> sync-config.py -> game-config.js -> GitHub main -> GitHub Pages
                                      |
                                      +-> 浏览器通过 Supabase 读写玩家数据
```

- 飞书是游戏数值的源头。
- `game-config.js` 是生成文件，禁止手改。
- Supabase 保存玩家状态、背包、签到、任务、邮件和提现等运行数据。
- 推送 `main` 后 GitHub Pages 自动更新正式网页。

## 2. 飞书配置约定

- 第 1 行：英文参数名，供程序稳定读取。
- 第 2 行：中文字段名，供策划阅读。
- 第 3 行起：实际数据。
- 新增列时，先确定英文参数名，再修改 `sync-config.py` 的必需字段和输出结构。
- 同一格中多个 ID 或数量用英文逗号分隔；并列的 ID 与数量必须一一对应。
- 奖励包当前字段：`pack_id`, `item_ids`, `item_quantities`, `quality_id`, `quality_note`。
- 每日签到当前字段：`item_ids`, `item_quantities`。
- 商店说明字段：`description`；`note` 仅供内部备注，不展示给玩家。

## 3. 同步配置

在 Windows `cmd` 中进入仓库后执行：

```bat
set "PYTHONUTF8=1"
set "LARK_CLI=%USERPROFILE%\.trae-cn\plugins\trae-remote-official\lark\1.0.4\bin\lark-cli.exe"
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe sync-config.py
```

成功标准：

- 所有工作表均打印读取条数。
- 最后出现“已生成 game-config.js”。
- 没有“缺少英文参数名”或权限错误。
- `game-config.js` 中可找到新字段及最新数据。

若失败，按顺序检查：

1. 飞书第 1 行英文参数名是否完整且没有多余空格。
2. `LARK_CLI` 是否指向存在的可执行文件。
3. 飞书 CLI 是否仍有读取权限。
4. 工作表名称是否被改动。

## 4. 本地测试

本机优先使用 Codex 自带 Node：

```bat
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test tests\*.test.js
```

JavaScript 语法检查：

```bat
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check app.js
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check game-config.js
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check character-animator.js
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check ten-chop-timeline.js
```

Python 语法检查：

```bat
%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m py_compile sync-config.py scripts\split_axe_sheets.py scripts\split_idle_axe_sheets.py
```

最后执行 `git diff --check`，并检查 `git status --short` 是否只有本次需求文件。

## 5. 功能实现底线

- 合成、签到、领取、购买、锻造、出售、装备、砍树等资源操作必须防重复点击。
- 消耗和奖励尽量放进 Supabase 原子 RPC；暂时无法原子化时必须有失败补偿。
- 数据库返回失败时不能先显示成功，也不能只改本地界面。
- 重绘背包时保留当前页签，不把玩家强制带回道具页。
- 十连操作先一次性计算和保存，再播放表现时间轴，网络延迟不能改变动画节奏。

### 独立仙斧与随机词条

- 普通材料继续保存在 `inventory` 并按道具 ID 叠加；仙斧只保存在 `weapon_instances`，每把都有独立 UUID。
- `player_state.axe_id` 保留为当前外观道具 ID；真正的装备归属以 `axe_instance_id` 为准。
- 锻造时先根据道具的技能 ID，从同 `buff_id` 的配置中按 `weight` 抽档，再从 `value*_range` 生成数值。
- 抽中的 `buffRowId`、`buffQuality` 和最终数值永久写入 `skill_rolls`；砍树时只读取这些固定值，禁止再次随机强度。
- 锻造、装备、出售必须分别调用 `forge_weapon_instance`、`equip_weapon_instance`、`sell_weapon_instance` 原子 RPC。
- 历史斧头迁移后若词条为空，由 `initialize_weapon_affixes` 只写一次；并发情况下以后端已保存结果为准。
- 技能文案只给动态参数添加 `buff-quality-*` 颜色，正文保持中性，避免整段高饱和影响可读性。

## 6. 发布

发布前清单：

- 配置同步完成。
- 全部测试通过。
- JavaScript 和 Python 语法检查通过。
- 图片脚本验证通过。
- `git diff --check` 通过。
- `git diff` 中没有密钥、临时文件和无关修改。
- 用户没有要求视觉验收时，不额外打开页面做视觉验收。

发布命令：

```bat
git add <本次文件>
git commit -m "描述本次玩家可感知的改动"
git push origin main
```

推送成功后，GitHub Pages 会自动部署。推送只是上传完成，须确认对应提交的 Pages 运行成功，并核对线上入口和本次修改文件的实际内容，才能报告“线上已发布”。

- 若产物上传收尾 `FinalizeArtifact` 返回 403 而构建成功，先查远端日志，不因服务端上传失败修改前端配置。
- 本项目旧的失败任务重跑曾卡在未入队状态，普通和强制取消均返回409。遇到同一情况不反复重试：使用仓库 `POST /pages/builds` 为当前分支触发一次新构建，跟踪新运行。
- 不用空提交触发重试，不删除部署记录；等待十分钟无进展时按项目规则汇报原因。

## 7. 回滚

已发布版本出问题时：

1. 找到有问题的提交。
2. 用 `git revert <commit>` 生成反向提交。
3. 重新跑测试。
4. 推送新的回滚提交到 `main`。

不要使用 `git reset --hard` 或强推覆盖共享历史。

## 8. 凭据安全

- 不在对话、代码、截图、提交或 remote URL 中展示 token。
- GitHub 使用本机凭据管理或 OAuth；remote 保持普通 HTTPS 地址。
- Supabase 浏览器端 publishable key 可以公开，但数据库必须通过 RLS/RPC 限制权限；service role key 绝不能进入前端。
- `apikey`、`.env`、证书和服务账号文件必须留在仓库外或被 `.gitignore` 排除。

## 9. 登录便利性与动作同步

- 登录密码由浏览器原生密码管理器保存；真实表单保留 `username` 和 `current-password` 标识，静态站点禁止表单外发。不能为了自动填充把密码写进网页存储。
- 修炼者与天道使用不同凭据标识；切换角色时清空旧密码，迟到的自动填充不能覆盖用户输入。仅完成验证和初始化后请求保存；首次浏览器可能要求确认保存，不支持的浏览器保留普通表单行为。
- 十连砍所有表现使用同一 `TenChopTimeline.getStep(i)`。按钮每一步调用 `_playChopButtonFeedback(button, timing.speed)`，不能在等待网络时加播一次，也不能另建独立间隔定时器。
- 动画使用可重入的清理机制：重播前取消旧清理定时器，防止下一段被上一段截断。
- 纯展示角色、特效和装饰层必须点击穿透；透明图片仍以整张矩形拦截指针，不能认为透明像素自动穿透。人物前景层不得阻挡仙树交互。
- 相对按钮定位的次数/状态角标必须放在按钮或专用按钮容器内，不能挂到还包含其他操作的整组容器。覆盖装饰角标不接收指针，邻近控制预留明确间距。
- 替换角色图片后，必须同步更新实际运行资源 URL 的缓存版本，不只更新 JS 文件版本。
- 美术提示词与动效方向先交付，临时示意不得直接冒充用户生成的正式资源。当前四组生成提示词在仓库同级 `仙来-美术生成提示词.md`。

## 10. V7 手机修仙与背包

- `mobile-cultivation.js/css`在手机使用常展开3:2双栏，取代V4抽屉。左侧唯一`inventory-grid`恒为道具，右侧当前装备或两列武器库；电脑仍保留原布局及`currentInvTab`。
- 整个双栏仅铺V7纸面，不在左右内容后各套一层框。左侧数量、新标记、触摸尺寸保持清晰，较窄手机减为三列，长技能在右侧内部滚动。
- 右下“武器库”进入右侧武器格后变“返回”；不换装也能返回。按UUID显示每把斧头，当前装备排首位并标“当前”；点武器只看详情，明确点装备才换装，已装备不可出售。
- 整页修仙刷新前`MobileCultivation.unmount({ preserve: true })`，刷新后`mount(snapshot)`；背包重绘前后调用`beforeInventoryRender(tab)`与`refreshInventory(tab)`，右栏通过`refreshEquipment({html,weaponsHtml})`更新，保留两栏滚动及库模式。
- `Router.playerTab`调用`setPage(tab)`；离开修仙保留背包快照，任务/商店中心变成返回修仙。侧边仍为任务与天道酬勤，非修仙页不显示十连、锻造、砍数。退出登录`unmount()`完全清理监听和移动DOM。
- 短屏人物与树通过同一场景容器整体缩放，不分别改变锚点。新布局不得破坏十连时间轴、点击区域或砍树次数相对按钮的位置。
- 媒体查询生效会先改变容器尺寸，再触发JS回调；滚动事件和读scrollTop必须跳过响应式转换阶段，布局与数据到位后还原缓存。不能把浏览器临时夹到0的值写回历史位置。
- 短竖屏右栏将斧头图与名称并排，给技能首行留出空间；不要只验整个背包可见，却把技能全部挤到滚动区下方。
- 武器格按列宽确定3:4高度，图片不得参与隐式行高计算。回归要给足多行武器，逐行断言底边不越过下一行顶边，不能只查数量或图片宽度。
- 数量与“新”使用小号深墨/朱红字，不用大底板遮图；纸面按钮有hover、active与focus。底栏操作区高度与背景纸高度分离，纸面只铺底部64至72px，不把十连和锻造包进去。
- 任务/商店返回保持与砍树同尺寸的圆形墨底，使用本地Lucide undo-2。离开手机版或退出时恢复原图、文字与状态，不改路由含义。
- `node tests/mobile-cultivation.browser-check.cjs`是无截图、无真实账号的本地事件/几何检查，覆盖360x540、360x640、390x844、844x390及1440x900。依赖路径可由`PLAYWRIGHT_MODULE`和`BROWSER_EXECUTABLE`指定。
- 角色突破展示读取配置名称与要求，不再渲染仙阶emoji；保留icon配置兼容。修改名称只在飞书执行，再同步生成配置。

## 11. 登录动效与页面纸面样式

- 登录出场只播一次，结束后 Logo 以 6.4 秒周期轻浮 10px；不要让表单跟着移动。V5已撤掉程序水纹，改用用户墨纹图集，不再恢复旧水域遮罩或椭圆线条。
- 背景与Logo就绪后，登录场景连续可见500ms再播放1500ms出场。背景就绪等待最多2500ms，超时释放装饰等待；不阻塞表单或登录。隐藏时取消出场等待，回来重新计时，减少动态模式直接静态显示。
- `login-art.js`围绕Logo排布真实墨纹：手机2条主墨迹+3段碎墨，电脑3+5；分条轻弯纹理，保留飞白。Logo按实际字形alpha及浮动范围保护，输入/加载区整个矩形加12px避让，装饰点击穿透。
- `LoginArt.getImageAssets()`返回六个版本化URL。装饰由LoginArt后台加载，不能加入登录必须等待的资源队列；缺图或慢请求不能卡住登录，也不能为等待装饰启动空动画循环。
- 登录动效需要响应页面隐藏、离屏、退出登录、窗口尺寸和减少动态偏好。手机限制绘制频率与画布分辨率，不在游戏内继续运行登录动画。
- 点击登录后在验证请求之前显示加载状态。墨线只平滑过渡真实进度，不按计时器虚增，也不人为等待。图片阶段占85%，当前装备动作占15%；文字随验证、资源和玩家数据阶段变化。预加载百分比表示请求完成（含失败），不是所有图片成功的承诺。
- 错误密码、初始化失败和路由失败都必须恢复表单、解除锁；异步回调要检查当前尝试仍然有效，不能把恢复的表单再次隐藏。
- `ink-pages.css`只覆盖任务、天道酬勤及提现记录的纸面布局；主题分组不再套大卡片，任务奖励直接可见，商品说明完整换行。人民币余额与小钱钱分开标识，提现记录只保留一个按需加载入口。
- 页面刷新要同时考虑页面自身与文档滚动容器，保留筛选项和当前位置；不因领取奖励重新排序或跳回页首。
- `ink-scrollbars.css`放在全部界面样式之后。只改原生滚动条外观，不改变背包格子、overflow、滚轮或触摸行为。Chromium标准滚动属性会覆盖WebKit伪元素，需保留兼容分支和高对比度回退。
- `node tests/ink-polish.browser-check.cjs`进行无截图、无真实账号的登录动效/加载状态/任务商店文字与事件检查。连同手机背包检查和全套单元测试执行，不替代用户明确要求时的视觉验收。
- 动效测试不能只判断Canvas存在非零像素。V5需要解码真实墨纹、检查持续变化与足够透明度，并断言输入区无墨影。插入CSS动画节点后先等绘制帧，再计算测试延迟；只有setTimeout不能保证无头浏览器已启动动画时间线。
- 短时CSS受击动效的可见性测试要等`Animation.ready`，再在实际delay与duration的有效区间取样；不能以墙钟等待300ms代替动画进度。游戏运行时仍按原时间轴播放，测试不得修改产品动画速度。
- 弹窗和手机背包关闭统一使用本地Lucide X（ISC许可随资源保存），44px点击区域、22px图标；不能再回退到红金圆章。保留辅助标签、焦点、按下态和锁定逻辑。
- 累签说明有独立浅底和深墨色，正文及重置时间对比度均须达到4.5:1；里程碑文字直接来自配置，不另写死3/7/14/28。
- V5任务与商品用`assets/runtime/v5/ui`真实纸框九宫格，切片来自manifest。标题#252b29、正文#464c49、辅助#626762；描述14px，辅助不低于12px。绿色仅用于状态，品质子节点保留原品质色。
- 任务/天道酬勤页主标题、任务分组标题与小钱钱兑换标题不加纯色色块，使用透明背景和深墨文字；纸面仅用于实际内容区，不给每行标题另套底板。
- 手机背包已由V7双栏替代旧抽屉；旧版V3入口条和V4抽屉纸面不再用于手机背包，详见第10节。

### 锻造结果与 V6 美术

- 锻造结果操作放在斧头框内的固定44px槽，独立于轮播替换的图片节点。可装备只显示立即装备，不可装备只显示配置仙阶加“及以上可装备”；抽取中留空，不能让结果操作挤动主锻造按钮。
- 武器技能与文案放在主锻造控件之后，保留连续抽取路径；不得改变2至3秒、前60%推进进度/后40%高速轮播的原时间轴。
- V6品质使用用户生成的平面竖向墨记，替换左上细色条，不使用玉石或立体高光。12x26px容器内等比完整显示，桌面和挂在body的手机背包共享映射；不改物品格、数量和“新”标记，不拦截点击。
- V6登录按钮保留真实submit元素和“踏入仙途”辅助名称，墨刷/白色书法字独立位图。仅文字在悬浮或键盘聚焦时以180ms渐亮；按压scale(.98)，加载禁用，减少动态时不位移。不对整个按钮加亮或让表单跟着移动。
- 两层图片都成功后才替换文字兜底；任一失败或未完成时仍能看见可点击文字，不能为了等美术阻塞验证。继续保留Logo原500ms出场等待与2500ms背景兜底，销毁时清理新增load/error监听。
- 原美术提示词见`docs/art-prompts/仙来V6-品质徽记与登录按钮.md`；其中玉印方向已被最新品质墨记方案取代，实际切图和运行参数以`docs/ASSET_PIPELINE.md`第13节为准。

## 12. 砍树命中特效

- 使用一枚墨色斩痕和默认4片青灰落叶，不再用旧版金色爆闪、法阵或带旋风的整张叶片。
- `CultivationEffects.playHit({scene, tree, intensity, speed})`在原时间轴位置调用，十连传入`timing.speed`。CSS延迟`180 / speed`等待斧头下落，延迟必须计入清理时间；不要新增独立砍树计时器。
- 受击点保留树框42%/45%，落叶从树冠单独计算。所有位置从实际显示坐标换回场景坐标，不能把缩放后的屏幕坐标当成本地像素。
- 特效最多24个活动节点和清理定时器，`clear()`与页面隐藏清理，减少动态时只留一枚短淡出。所有装饰点击穿透。
- 首屏预载与特效实际请求必须包含完全相同的版本化URL，否则浏览器会重复下载。新叶片位于`assets/runtime/effects/leaf-ink.webp`。

## 13. V7 品质奖励展示

- `reward-presentation.js/css`只负责表现，显式注入道具配置和图标函数，不接触数据库、随机权重或物品发放。
- 十连结果按真实`isExtra`分组，常规十次5+5，额外奖励单独居中；不能用数组第11项硬切。单次奖励和额外奖励复用墨团组件，保留数量、BUFF及返还次数。
- 使用V7五色墨团，不增加发光方框。纸上品质名称使用同色相较深文本色，不修改飞书配置颜色，不让金色在纸上看不清。
- 普通道具详情标题应用自身品质色，武器详情继续以技能为重点。图片路径、预载和缓存版本保持一致。
- 奖励弹窗须分别检查单抽和全BUFF十连。头尾不滚动、内容区可滚动，短屏中不滚动也能点击确认；不能只验整个弹窗在视口里或奖励排成5+5。
