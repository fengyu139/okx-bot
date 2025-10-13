#!/bin/bash
# K线趋势反转策略 - 停止脚本

echo "=========================================="
echo "  OKX K线趋势反转策略机器人 - 停止"
echo "=========================================="
echo ""

pm2 status

echo ""
echo "⏹️  停止所有反转策略机器人..."
pm2 stop ecosystem.reverse.config.js

echo ""
echo "✅ 停止完成！"
echo ""
pm2 status

