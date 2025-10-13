#!/bin/bash

# OKX 高低点突破策略机器人 - 启动脚本

echo "=========================================="
echo "  OKX 高低点突破策略机器人 - 启动"
echo "=========================================="
echo ""

# 检查是否安装了 PM2
if ! command -v pm2 &> /dev/null; then
    echo "❌ 未安装 PM2，正在安装..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo "❌ PM2 安装失败，请手动安装: npm install -g pm2"
        exit 1
    fi
fi

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "⚠️  警告：未找到 .env 文件"
    echo "请确保已配置 OKX API 密钥"
    echo ""
fi

# 检查日志目录
if [ ! -d "logs" ]; then
    echo "📁 创建日志目录..."
    mkdir -p logs
fi

# 检查状态目录
if [ ! -d "states" ]; then
    echo "📁 创建状态目录..."
    mkdir -p states
fi

# 启动 PM2 进程
echo "🚀 启动高低点突破策略机器人..."
pm2 start ecosystem.highlow.config.js

# 显示状态
echo ""
echo "✅ 启动完成！"
echo ""
pm2 status

echo ""
echo "=========================================="
echo "  常用命令"
echo "=========================================="
echo "查看状态:    pm2 status"
echo "查看日志:    pm2 logs"
echo "查看特定日志: pm2 logs highlow-btc"
echo "停止所有:    pm2 stop ecosystem.highlow.config.js"
echo "重启所有:    pm2 restart ecosystem.highlow.config.js"
echo "删除所有:    pm2 delete ecosystem.highlow.config.js"
echo ""
echo "实时日志:    tail -f logs/okx-highlow-BTC_USDT_SWAP.log"
echo "=========================================="

