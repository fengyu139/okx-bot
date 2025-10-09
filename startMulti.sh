#!/bin/bash

# OKX 多币种交易机器人启动脚本

echo "===== 启动 OKX 多币种交易机器人 ====="
echo ""

# 创建必要的目录
mkdir -p logs states

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "❌ 错误：.env 文件不存在！"
    echo "请先创建 .env 文件并配置 API 密钥"
    exit 1
fi

# 加载环境变量
source .env

# 检查 API 密钥
if [ -z "$OKX_API_KEY" ] || [ -z "$OKX_SECRET_KEY" ] || [ -z "$OKX_PASSPHRASE" ]; then
    echo "❌ 错误：API 密钥未配置！"
    echo "请在 .env 文件中设置："
    echo "  OKX_API_KEY"
    echo "  OKX_SECRET_KEY"
    echo "  OKX_PASSPHRASE"
    exit 1
fi

echo "✅ API 密钥已配置"
echo ""

# 启动各个币种的机器人
echo "🚀 启动 BTC 机器人..."
SYMBOL=BTC-USDT-SWAP node okxNewBot.js > logs/btc.log 2>&1 &
BTC_PID=$!
echo "   PID: $BTC_PID"
sleep 3

echo "🚀 启动 ETH 机器人..."
SYMBOL=ETH-USDT-SWAP node okxNewBot.js > logs/eth.log 2>&1 &
ETH_PID=$!
echo "   PID: $ETH_PID"
sleep 3

echo "🚀 启动 SOL 机器人..."
SYMBOL=SOL-USDT-SWAP node okxNewBot.js > logs/sol.log 2>&1 &
SOL_PID=$!
echo "   PID: $SOL_PID"
sleep 3

echo ""
echo "===== 所有机器人已启动 ====="
echo ""
echo "进程 ID:"
echo "  BTC: $BTC_PID"
echo "  ETH: $ETH_PID"
echo "  SOL: $SOL_PID"
echo ""
echo "查看日志:"
echo "  tail -f logs/btc.log"
echo "  tail -f logs/eth.log"
echo "  tail -f logs/sol.log"
echo ""
echo "停止所有机器人:"
echo "  ./stopMulti.sh"
echo "  或: pkill -f 'node okxNewBot.js'"
echo ""

