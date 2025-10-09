#!/bin/bash

# OKX 多币种交易机器人停止脚本

echo "===== 停止所有 OKX 交易机器人 ====="
echo ""

# 查找所有运行中的 okxNewBot.js 进程
PIDS=$(pgrep -f "node okxNewBot.js")

if [ -z "$PIDS" ]; then
    echo "ℹ️  没有找到运行中的机器人"
    exit 0
fi

echo "找到以下进程："
ps aux | grep "node okxNewBot.js" | grep -v grep

echo ""
echo "正在停止..."

# 发送 SIGINT 信号（优雅退出）
pkill -SIGINT -f "node okxNewBot.js"

# 等待 5 秒
sleep 5

# 检查是否还有进程
REMAINING=$(pgrep -f "node okxNewBot.js")
if [ ! -z "$REMAINING" ]; then
    echo "⚠️  部分进程未响应，强制停止..."
    pkill -9 -f "node okxNewBot.js"
fi

echo ""
echo "✅ 所有机器人已停止"

