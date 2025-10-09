# 快速启动指南

## 🚀 5 分钟快速开始

### 第一步：安装依赖

```bash
npm install
# 或
pnpm install
```

### 第二步：配置 API 密钥

创建 `.env` 文件：

```bash
OKX_API_KEY=你的API密钥
OKX_SECRET_KEY=你的SECRET密钥
OKX_PASSPHRASE=你的密码短语
OKX_BASE_URL=https://www.okx.com
SYMBOL=BTC-USDT-SWAP
STARTING_CAPITAL=1000
RISK_PER_TRADE=0.015
LEVERAGE=10
SHORT_SMA_PERIOD=7
LONG_SMA_PERIOD=25
POLL_INTERVAL_MS=15000
```

### 第三步：启动机器人

```bash
node okxNewBot.js
```

## 📊 启动后你会看到

```
[2025-10-09T10:00:00.000Z] [INFO] ========================================
[2025-10-09T10:00:00.000Z] [INFO] 启动 OKX 交易机器人
[2025-10-09T10:00:00.000Z] [INFO] 注意：先用 sandbox keys 测试！
[2025-10-09T10:00:00.000Z] [INFO] ========================================
[2025-10-09T10:00:00.000Z] [INFO] 配置信息
{
  "symbol": "BTC-USDT-SWAP",
  "leverage": 10,
  "riskPerTrade": "1.50%",
  "shortSMA": 7,
  "longSMA": 25,
  "pollInterval": "15秒"
}
```

## 🎯 核心功能演示

### 1. 自动监控市场

每 15 秒机器人会：

- 获取账户余额
- 检查当前持仓
- 获取 K 线数据
- 计算双均线
- 生成交易信号

```
[INFO] 市场状态
{
  "price": "65000.50",
  "shortSMA": "64800.23",
  "longSMA": "64600.11",
  "signal": "long",
  "usdt": "1000.00",
  "hasPosition": false
}
```

### 2. 自动开仓

当出现金叉（做多信号）或死叉（做空信号）时：

```
[INFO] 下市价单
{
  "instId": "BTC-USDT-SWAP",
  "tdMode": "cross",
  "side": "buy",
  "posSide": "long",
  "ordType": "market",
  "sz": "10"
}

[SUCCESS] 开仓成功
{
  "ordId": "123456789",
  "signal": "long",
  "size": 10
}
```

### 3. 自动设置止损止盈

开仓成功后立即提交：

```
[INFO] 提交止损订单
[SUCCESS] 止损订单提交成功
{ "algoId": "sl_123456" }

[INFO] 提交止盈订单
[SUCCESS] 止盈订单提交成功
{ "algoId": "tp_123456" }
```

### 4. 自动平仓

当信号反转时：

```
[INFO] 信号反转，平仓当前持仓
{
  "currentSide": "long",
  "newSignal": "short"
}

[INFO] 提交平仓订单
[SUCCESS] 平仓成功
{ "ordId": "987654321" }
```

## 📁 生成的文件

运行后会生成：

### okxNewBot.log

所有操作的详细日志

```bash
tail -f okxNewBot.log  # 实时查看
```

### botState.json

当前状态（自动保存和恢复）

```json
{
  "lastSignal": "long",
  "lastTradeTime": "2025-10-09T10:30:00.000Z",
  "currentPosition": {
    "posSide": "long",
    "size": 10,
    "entryPrice": 65000.5,
    "instId": "BTC-USDT-SWAP"
  },
  "errorCount": 0
}
```

## 🛑 如何停止

按 `Ctrl+C`，机器人会：

1. 查询并记录当前持仓
2. 保存状态到文件
3. 优雅退出

```
[INFO] 接收到 SIGINT 信号，准备退出...
[WARN] 退出时仍有持仓
[INFO] 状态已保存
[INFO] Bot 已停止
```

## 🔍 监控命令

### 查看最近日志

```bash
tail -n 50 okxNewBot.log
```

### 实时监控错误

```bash
tail -f okxNewBot.log | grep ERROR
```

### 实时监控交易

```bash
tail -f okxNewBot.log | grep SUCCESS
```

### 查看当前状态

```bash
cat botState.json | jq
```

## ⚙️ 参数调整

### 修改风险比例

`.env` 文件中修改：

```bash
RISK_PER_TRADE=0.01  # 改为1%风险
```

### 修改均线周期

```bash
SHORT_SMA_PERIOD=5   # 更激进
LONG_SMA_PERIOD=20
```

### 修改轮询间隔

```bash
POLL_INTERVAL_MS=30000  # 改为30秒
```

## 🔧 故障排查

### 问题：连接失败

```
[ERROR] Network/Request Error
```

**解决**：检查网络连接和 API 密钥

### 问题：下单失败

```
[ERROR] 下单返回错误
```

**解决**：

1. 检查账户余额
2. 确认杠杆设置
3. 查看具体错误代码

### 问题：止损止盈提交失败

```
[ERROR] 止损订单提交失败
```

**解决**：参考 OKX 文档调整 algo 订单参数

## 📚 更多信息

- 详细功能说明：[README_NewBot.md](./README_NewBot.md)
- 更新日志：[CHANGELOG.md](./CHANGELOG.md)
- OKX API 文档：https://www.okx.com/docs-v5/zh/

## ⚠️ 重要提醒

1. **先用沙盒环境测试**
2. **不要使用全部资金**
3. **定期检查持仓和订单**
4. **设置合理的风险比例**
5. **保持网络稳定**

---

祝交易顺利！🎉
