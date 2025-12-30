# 亚马逊 CGL 智能体部署指南 (Deployment Guide)

这个项目是一个单文件 React 应用，您可以非常容易地将其发布到公网，方便他人访问。

### 选项 A：使用 Netlify 一键部署 (最推荐)
1. 访问 [Netlify Drop](https://app.netlify.com/drop)。
2. 将此文件夹中的 `index.html` (或者整个文件夹) 直接拖入网页。
3. **完成！** Netlify 会立即给您一个公网 URL 链接。

### 选项 B：使用 GitHub Pages (专业推荐)
1. 在 GitHub 上创建一个新的仓库 (Repository)。
2. 将 `index.html` 上传到仓库根目录。
3. 进入仓库设置 (Settings) -> Pages，选择 `main` 分支并点击保存。
4. 您的网站将托管在 `https://your-username.github.io/your-repo-name/`。

### 选项 C：Vercel 部署
1. 安装 Vercel CLI 或连接您的 GitHub 仓库。
2. 由于项目中已包含 `vercel.json`，直接运行 `vercel` 命令即可完成部署。

---
*注：本项目所有数据均存储在用户的浏览器本地 (LocalStorage)，部署到公网后，上传的 Excel 数据不会被发送到任何服务端，确保了数据安全性。*
