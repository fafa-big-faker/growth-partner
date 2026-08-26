# 部署说明（给下一个对话的 AI 看）

> 这是一份跨对话的"记忆存档"。请阅读并执行下面的任务。

## 你（AI）要完成的任务

把当前工作区（`/workspace`）里的「社交成长任务系统」网站部署到 GitHub，并开启 GitHub Pages 让它可以在公网访问。

## 项目现状（已就绪）

- 项目是一个纯前端的单页应用：`index.html`（页面+样式）+ `app.js`（全部逻辑）
- 已经 `git init` 过，且已有一次提交：`f92f7e4 初始化社交成长任务系统...`
- 本地分支是 `master`
- 已补充 `README.md` 和 `.gitignore`
- GitHub 插件授权已经由用户完成（OAuth 已授权成功）

## 用户背景

- 用户是**非技术人员**，需要 AI 全程引导，不要让他做太复杂的操作
- 用户的 GitHub 账号邮箱：2183568059@qq.com
- 用户之前不小心在对话里暴露过 GitHub 密码，已提醒他去改密

## 部署要求

1. 在用户的 GitHub 账号下创建一个仓库（建议名：`growth-partner` 或 `social-growth-task-system`），设为 Public 或 Private 均可（若是 Private，GitHub Pages 需要 Pro 才能开，所以建议 Public，或改用 Vercel/Netlify）
2. 把工作区代码推送到该仓库
3. 开启 GitHub Pages（Settings → Pages → 选分支 master → 保存）
4. 把最终的公网访问地址（形如 https://<用户名>.github.io/<仓库名>/）告诉用户

## 注意事项

- **禁止**在任何对话中让用户输入或暴露密码/令牌
- 优先使用 GitHub 插件工具（trae-remote-official:github）来完成，它会通过已授权的连接器操作，不需要用户手动输密码
- 如果 GitHub 插件工具不可用，改用 `git push` 需要 Personal Access Token，那种情况要引导用户去 GitHub 网页自己生成 token，生成后粘贴给你（token 属于敏感信息，用完要提醒用户撤销）
- 项目是双角色系统：管理员密码 `admin`，用户密码 `user`（写死的演示用，正式用可以改）
- 数据存在浏览器 localStorage 里，GitHub Pages 部署后是本地存储，单人使用没问题