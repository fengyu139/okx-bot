#!/bin/bash

# OKX 多币种交易机器人监控脚本

echo "====================================="
echo "   OKX 多币种机器人状态监控"
echo "====================================="
echo ""

# 检查进程状态
echo "📊 进程状态:"
echo "-------------------------------------"
for symbol in BTC ETH SOL; do
    PID=$(pgrep -f "SYMBOL=${symbol}-USDT-SWAP")
    if [ ! -z "$PID" ]; then
        echo "✅ $symbol: 运行中 (PID: $PID)"
    else
        echo "❌ $symbol: 未运行"
    fi
done
echo ""

# 显示最新交易信息
echo "💰 最新交易信息:"
echo "-------------------------------------"
for symbol in BTC ETH SOL; do
    LOG_FILE="logs/${symbol,,}.log"
    if [ -f "$LOG_FILE" ]; then
        echo "[$symbol]"
        # 显示最后的市场状态
        tail -n 50 "$LOG_FILE" | grep -A 5 "市场状态" | tail -n 6 | head -n 6
        echo ""
    fi
done

# 显示持仓信息
echo "📈 当前持仓:"
echo "-------------------------------------"
for symbol in BTC ETH SOL; do
    LOG_FILE="logs/${symbol,,}.log"
    if [ -f "$LOG_FILE" ]; then
        POSITION=$(tail -n 100 "$LOG_FILE" | grep "当前持仓" | tail -n 1)
        if [ ! -z "$POSITION" ]; then
            echo "[$symbol] $POSITION"
        else
            echo "[$symbol] 无持仓"
        fi
    fi
done
echo ""

# 显示错误信息
echo "⚠️  最近错误:"
echo "-------------------------------------"
ERROR_COUNT=0
for symbol in BTC ETH SOL; do
    LOG_FILE="logs/${symbol,,}.log"
    if [ -f "$LOG_FILE" ]; then
        ERRORS=$(tail -n 20 "$LOG_FILE" | grep "ERROR" | wc -l)
        if [ $ERRORS -gt 0 ]; then
            echo "[$symbol] 最近 20 行中有 $ERRORS 个错误"
            tail -n 20 "$LOG_FILE" | grep "ERROR" | tail -n 1
            ERROR_COUNT=$((ERROR_COUNT + ERRORS))
        fi
    fi
done

if [ $ERROR_COUNT -eq 0 ]; then
    echo "✅ 无最近错误"
fi
echo ""

echo "====================================="
echo "刷新监控: watch -n 10 ./monitor.sh"
echo "查看详细日志: tail -f logs/btc.log"
echo "====================================="

