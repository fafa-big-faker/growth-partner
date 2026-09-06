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

推送成功后，GitHub Pages 会自动部署。不要把“本地提交成功”误报成“线上已发布”；必须以 `git push` 成功为准。

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
