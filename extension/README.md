# Cybreturn CGL 智能助手 - 浏览器插件

> 亚马逊 CGL 智能合规预审与报价工具

## 📦 文件说明

本文件夹包含完整的浏览器插件源代码，可直接安装使用。

### 文件结构
```
extension/
├── manifest.json          # 插件配置文件
├── popup.html            # 弹窗界面
├── popup.js              # 弹窗逻辑
├── content.js            # 页面数据提取脚本
├── background.js         # 后台服务
├── icon.png              # 插件图标
├── 安装说明.md            # 详细安装指南
├── Chrome商店发布指南.md  # 官方商店发布教程
└── README.md             # 本文件
```

## 🚀 快速开始

### 用户安装（推荐阅读《安装说明.md》）
1. 解压此文件夹
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本文件夹

### 开发者发布（推荐阅读《Chrome商店发布指南.md》）
1. 注册 Chrome Web Store 开发者账号（$5）
2. 将本文件夹压缩成 ZIP
3. 上传到开发者控制台
4. 填写商店信息并提交审核

## ✨ 功能特性

- ✅ 支持多格式文件上传（Excel、CSV、TXT、PDF、Word）
- ✅ 智能 SKU 数据提取
- ✅ 一键抓取亚马逊页面数据
- ✅ 快捷访问完整版 Web 工具

## 🔧 技术栈

- Manifest V3
- Vanilla JavaScript
- Chrome Extension APIs
- PDF.js & Mammoth.js (完整版工具)

## 📞 联系我们

- **官网**: https://spontaneous-bublanina-8201df.netlify.app
- **邮箱**: support@cybreturn.com

## 📜 版本历史

### v1.0.0 (2025-12-30)
- 🎉 首次发布
- ✨ 支持多格式文件解析
- ✨ 亚马逊页面数据提取
- ✨ 完整版工具快捷访问

---

**© 2025 Cybreturn. All rights reserved.**
