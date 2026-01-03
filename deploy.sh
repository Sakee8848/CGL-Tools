#!/bin/bash

# ==========================================
# CGL Tools 一键部署脚本
# 功能：
# 1. 自动更新版本号 (x.y.z -> x.y.z+1)
# 2. 重新打包插件 ZIP
# 3. 提交代码到 GitHub (触发 Pages 自动部署)
# ==========================================

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 开始部署流程...${NC}"

# 1. 检查是否有未提交的更改
if [ -z "$(git status --porcelain)" ]; then 
  echo -e "${BLUE}ℹ️  当前没有代码变更，仅重新打包发布? (y/n)${NC}"
  read -r confirm
  if [ "$confirm" != "y" ]; then
    echo "已取消。"
    exit 0
  fi
fi

# 2. 自动增加版本号 (要在 manifest.json 中查找)
MANIFEST_FILE="extension/manifest.json"
CURRENT_VERSION=$(grep '"version":' "$MANIFEST_FILE" | cut -d '"' -f 4)
IFS='.' read -r -a v <<< "$CURRENT_VERSION"
# 简单增加 Patch 版本号 (最后一位)
NEW_VERSION="${v[0]}.${v[1]}.$((v[2] + 1))"

echo -e "${BLUE}ℹ️  当前版本: $CURRENT_VERSION${NC}"
echo -e "${BLUE}✨ 新版本号: $NEW_VERSION${NC}"

# 更新 manifest.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_FILE"
echo -e "${GREEN}✅ manifest.json 版本号已更新${NC}"

# 3. 执行打包脚本
echo -e "${BLUE}📦 正在打包插件...${NC}"
cd extension
# 给予打包脚本执行权限并运行
chmod +x prepare_distribution.sh
./prepare_distribution.sh > /dev/null
cd ..
echo -e "${GREEN}✅ 插件打包完成: extension/release/cgl-extension-v$NEW_VERSION.zip${NC}"

# 4. 提交到 GitHub
echo -e "${BLUE}☁️  正在推送到 GitHub...${NC}"
git add .
git commit -m "🔖 Release v$NEW_VERSION: Auto-deployed via script"
git push

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 部署成功！${NC}"
    echo -e "---------------------------------------------------"
    echo -e "1. 🌐 网页版正在更新: https://sakee8848.github.io/CGL-Tools/"
    echo -e "   (请等待 1-2 分钟 Actions 构建完成)"
    echo -e ""
    echo -e "2. 🧩 插件新版本: extension/release/cgl-extension-v$NEW_VERSION.zip"
    echo -e "   (请去 GitHub Releases 页面手动上传此 ZIP 以发布新版)"
    echo -e "   链接: https://github.com/Sakee8848/CGL-Tools/releases/new"
    echo -e "---------------------------------------------------"
else
    echo -e "${RED}❌ 推送失败，请检查网络或 Git 配置。${NC}"
fi
