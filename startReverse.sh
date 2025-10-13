#!/bin/bash
# K线趋势反转策略 - 启动脚本

echo "=========================================="
echo "  OKX K线趋势反转策略机器人 - 启动"
echo "  策略：连续上涨做空，连续下跌做多"
echo "=========================================="
echo ""

# 检查PM2
if ! command -v pm2 &> /dev/null; then
    echo "❌ 未安装 PM2，正在安装..."
    npm install -g pm2
fi

# 检查目录
if [ ! -d "logs" ]; then
    mkdir -p logs
fi

if [ ! -d "states" ]; then
    mkdir -p states
fi

# 启动
echo "🚀 启动K线趋势反转策略机器人..."
pm2 start ecosystem.reverse.config.js

echo ""
echo "✅ 启动完成！"
echo ""
pm2 status

echo ""
echo "=========================================="
echo "  常用命令"
echo "=========================================="
echo "查看日志:    pm2 logs reverse-btc"
echo "停止所有:    pm2 stop ecosystem.reverse.config.js"
echo "重启所有:    pm2 restart ecosystem.reverse.config.js"
echo "=========================================="

