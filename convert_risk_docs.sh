#!/bin/bash

# CGL 智能体 - 专家知识库转换助手
# 功能：递归查找指定目录下的 .doc 文件 (Word 97-2003)，批量转换为 .docx 格式，并生成可直接上传的 zip 包。
# 依赖：macOS 内置 textutil 工具

# 使用方法：
# chmod +x convert_risk_docs.sh
# ./convert_risk_docs.sh "/你的/旧版/文档/文件夹路径"

TARGET_DIR="$1"

echo "=================================================="
echo "   CGL 智能体 | .doc 批量转换助手 (macOS)"
echo "=================================================="

if [ -z "$TARGET_DIR" ]; then
    echo "❌ 错误：未指定目标文件夹。"
    echo "👉 用法: ./convert_risk_docs.sh <您的文件夹路径>"
    echo "示例: ./convert_risk_docs.sh \"/Users/tonyyu/Downloads/UW Guides\""
    exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ 错误：找不到目录 '$TARGET_DIR'"
    exit 1
fi

if ! command -v textutil &> /dev/null; then
    echo "❌ 错误：未找到系统内置工具 'textutil'。请确保您使用的是 macOS 系统。"
    exit 1
fi

echo "📂 正在扫描目录: $TARGET_DIR"

# 统计 .doc 文件数量
DOC_COUNT=$(find "$TARGET_DIR" -type f -name "*.doc" | wc -l)

if [ "$DOC_COUNT" -eq 0 ]; then
    echo "⚠️  未在目录中找到任何 .doc 文件。"
    exit 0
fi

echo "✅ 发现 $DOC_COUNT 个旧版 .doc 文件，开始转换..."
echo "--------------------------------------------------"

# 使用 find 处理包含空格的文件名
find "$TARGET_DIR" -type f -name "*.doc" -print0 | while IFS= read -r -d '' file; do
    # 检查 .docx 是否已存在，避免重复转换
    DOCX_FILE="${file}x"
    if [ ! -f "$DOCX_FILE" ]; then
        echo "🔄 Converting: $(basename "$file")"
        textutil -convert docx "$file"
    else
        echo "⏩ Skipping: $(basename "$file") (已存在)"
    fi
done

echo "--------------------------------------------------"
echo "📦 正在打包为 ZIP (仅包含 .docx)..."

OUTPUT_ZIP="$TARGET_DIR/cgl_knowledge_base_ready.zip"

# 创建压缩包
pushd "$TARGET_DIR" > /dev/null
# 排除 macOS 系统文件，只包含 docx
zip -r "cgl_knowledge_base_ready.zip" . -i "*.docx" -x "__MACOSX/*" "*.DS_Store"
popd > /dev/null

echo "=================================================="
echo "🎉 转换完成！"
echo "📄 生成文件: $OUTPUT_ZIP"
echo "👉 下一步：请回到浏览器，在 CGL Admin Portal 点击 '导入专家知识库'，选择此文件即可。"
echo "=================================================="
