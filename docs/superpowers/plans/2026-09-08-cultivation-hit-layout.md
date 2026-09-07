# Cultivation Hit And Counter Layout Implementation Plan

> **For agentic workers:** Use executing-plans to implement the approved corrections. Independent review may run in parallel.

**Goal:** 修复仙树被透明角色阻挡和次数数字覆盖十连砍。

**Architecture:** 保持游戏与数据逻辑不变，只修复指针事件和DOM定位归属。

**Tech Stack:** Vanilla HTML/CSS/JS, Node tests, headless DOM hit testing.

## Global Constraints

- 不改Supabase、配置、美术资源、人物/树坐标与绘制层级。
- 不进行浏览器视觉验收；允许无截图的自动命中与几何检查。
- 排除现有未跟踪supabase/；十分钟无进展必须汇报。

## Task 1: 回归与最小修复

Files: app.js renderCultivate、styles.css、tests/cultivation-action-polish.test.js、tests/cultivator-scene.test.js。

- [x] 先测试 `.cult-char` 和 `.char-img` 均包含 `pointer-events:none`；button子树内包含次数，button外不再有重复次数。
- [x] 在两条角色CSS规则设置 `pointer-events:none`。把次数span移到button闭合标签之前；设置20px的纵向间距及角标不换行/不接收指针。
- [x] 执行10项专项测试，检查既有动效和定位规则不变。

## Task 2: 验证并发布

- [x] 无数据库fixture加载真实样式和场景/操作区markup，测试360/390/820/1440宽、三种树、树冠和树干实际点击、次数1/8621/999999与十连控件不重叠。36点真实点击均打开详情；12组布局均居中且底部+7px、间距13px；12次勾选均只触发一次回调。
- [x] 全量164项Node、JS语法、Python编译、7项图片测试与git diff --check。
- [x] 更新缓存版本为cult-hit-layout-20260908，审查精确改动范围，不包含supabase/或玩家数据。

发布执行：提交和推送main，再核对Pages版本标记；最终交付记录提交号及线上核对结果。
