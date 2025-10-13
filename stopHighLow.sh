#!/bin/bash

# OKX 高低点突破策略机器人 - 停止脚本

echo "=========================================="
echo "  OKX 高低点突破策略机器人 - 停止"
echo "=========================================="
echo ""

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "❌ 未安装 PM2"
    exit 1
fi

# 显示当前状态
echo "当前运行状态："
pm2 status

echo ""
echo "⏹️  停止所有高低点策略机器人..."
pm2 stop ecosystem.highlow.config.js

echo ""
echo "✅ 停止完成！"
echo ""
pm2 status

echo ""
echo "=========================================="
echo "  后续操作"
echo "=========================================="
echo "重新启动:    pm2 restart ecosystem.highlow.config.js"
echo "完全删除:    pm2 delete ecosystem.highlow.config.js"
echo "查看日志:    pm2 logs"
echo "=========================================="

