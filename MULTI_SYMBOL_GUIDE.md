# 多币种交易配置指南

## 🚀 快速配置多币种交易

您的机器人现在已经支持多币种交易！只需修改 `.env` 文件即可。

### 📝 配置方式

在 `.env` 文件中使用 `SYMBOLS` 参数（多个交易对用逗号分隔）：

```bash
# 单个币种（原来的方式）
SYMBOLS=BTC-USDT-SWAP

# 多个币种（新功能！）
SYMBOLS=BTC-USDT-SWAP,ETH-USDT-SWAP,SOL-USDT-SWAP

# 更多币种
SYMBOLS=BTC-USDT-SWAP,ETH-USDT-SWAP,SOL-USDT-SWAP,DOGE-USDT-SWAP,XRP-USDT-SWAP
```

### 🎯 新增配置参数

```bash
# 最多同时持有几个币种的仓位（风险控制）
MAX_CONCURRENT_POSITIONS=3
```

---

## 💡 推荐配置方案

### 方案 1：保守型（1-2 个币种）

```bash
SYMBOLS=BTC-USDT-SWAP,ETH-USDT-SWAP
MAX_CONCURRENT_POSITIONS=2
RISK_PER_TRADE=0.01  # 1% 风险
```

**优点**：

- ✅ 风险最小化
- ✅ 资金利用率高
- ✅ 易于监控

### 方案 2：平衡型（3-5 个币种）

```bash
SYMBOLS=BTC-USDT-SWAP,ETH-USDT-SWAP,SOL-USDT-SWAP,BNB-USDT-SWAP,DOGE-USDT-SWAP
MAX_CONCURRENT_POSITIONS=3
RISK_PER_TRADE=0.015  # 1.5% 风险
```

**优点**：

- ✅ 分散风险
- ✅ 更多交易机会
- ✅ 收益机会增加

### 方案 3：激进型（5+ 个币种）

```bash
SYMBOLS=BTC-USDT-SWAP,ETH-USDT-SWAP,SOL-USDT-SWAP,BNB-USDT-SWAP,DOGE-USDT-SWAP,XRP-USDT-SWAP,ADA-USDT-SWAP
MAX_CONCURRENT_POSITIONS=5
RISK_PER_TRADE=0.02  # 2% 风险
```

**优点**：

- ✅ 最大化交易机会
- ✅ 最大分散化

**风险**：

- ⚠️ 需要更多资金
- ⚠️ 管理复杂度高

---

## 📊 OKX 支持的主流币种

### 市值 Top 10 币种（推荐）

```bash
BTC-USDT-SWAP   # 比特币
ETH-USDT-SWAP   # 以太坊
BNB-USDT-SWAP   # 币安币
SOL-USDT-SWAP   # Solana
XRP-USDT-SWAP   # 瑞波币
ADA-USDT-SWAP   # 卡尔达诺
DOGE-USDT-SWAP  # 狗狗币
AVAX-USDT-SWAP  # 雪崩
DOT-USDT-SWAP   # 波卡
MATIC-USDT-SWAP # Polygon
```

### 热门 DeFi 币种

```bash
UNI-USDT-SWAP   # Uniswap
LINK-USDT-SWAP  # Chainlink
AAVE-USDT-SWAP  # Aave
CRV-USDT-SWAP   # Curve
```

### 热门 Meme 币

```bash
DOGE-USDT-SWAP  # 狗狗币
SHIB-USDT-SWAP  # 柴犬币
PEPE-USDT-SWAP  # Pepe
```

---

## 🔧 完整配置示例

### `.env` 文件示例

```bash
# API 配置
OKX_API_KEY=your_api_key
OKX_SECRET_KEY=your_secret_key
OKX_PASSPHRASE=your_passphrase
OKX_BASE_URL=https://www.okx.com

# 🔥 多币种配置（核心）
SYMBOLS=BTC-USDT-SWAP,ETH-USDT-SWAP,SOL-USDT-SWAP
MAX_CONCURRENT_POSITIONS=3

# 资金和风险配置
STARTING_CAPITAL=5000
RISK_PER_TRADE=0.015
LEVERAGE=10

# 策略参数
SHORT_SMA_PERIOD=7
LONG_SMA_PERIOD=25
POLL_INTERVAL_MS=15000
```

---

## 🎮 运行效果

### 启动日志

```
[INFO] ========================================
[INFO] 启动 OKX 交易机器人（多币种版）
[INFO] ========================================
[INFO] 配置的交易对: 3 个
  - BTC-USDT-SWAP
  - ETH-USDT-SWAP
  - SOL-USDT-SWAP
[INFO] 最大并发持仓: 3
[INFO] 持仓模式: net_mode (单向持仓)
```

### 交易日志

```
[INFO] [BTC-USDT-SWAP] 开始分析...
[INFO] [BTC-USDT-SWAP] 市场状态
{
  "price": "65000.00",
  "signal": "long",
  "hasPosition": false
}

[INFO] [ETH-USDT-SWAP] 开始分析...
[INFO] [ETH-USDT-SWAP] 市场状态
{
  "price": "3200.00",
  "signal": "short",
  "hasPosition": false
}

[INFO] [SOL-USDT-SWAP] 开始分析...
[INFO] [SOL-USDT-SWAP] 市场状态
{
  "price": "140.00",
  "signal": "hold",
  "hasPosition": false
}
```

---

## 💰 资金分配策略

### 自动资金分配

机器人会自动为每个交易对分配资金：

**总资金 = 5000 USDT**
**最大并发 = 3 个币种**

每个币种可用资金 ≈ 5000 / 3 = **1666 USDT**

### 风险控制

- 每个交易对独立计算仓位
- 单个交易风险 = 1.5%
- 总风险暴露 = 1.5% × 并发数量
- 最大总风险 = 1.5% × 3 = **4.5%**

---

## ⚙️ 高级配置

### 按币种自定义配置（未来版本）

```javascript
// 未来可以支持每个币种不同配置
const SYMBOL_CONFIGS = {
  "BTC-USDT-SWAP": {
    riskPerTrade: 0.01, // BTC 保守 1%
    shortSMA: 7,
    longSMA: 25,
  },
  "DOGE-USDT-SWAP": {
    riskPerTrade: 0.03, // Meme 币激进 3%
    shortSMA: 5,
    longSMA: 15,
  },
};
```

---

## ⚠️ 重要注意事项

### 1. 资金要求

**最小资金建议**：

- 单币种：1000 USDT
- 2-3 币种：3000 USDT
- 5+ 币种：10000 USDT

### 2. 并发限制

```bash
MAX_CONCURRENT_POSITIONS=3  # 建议值
```

**为什么要限制并发？**

- ✅ 避免资金过度分散
- ✅ 保留资金应对新机会
- ✅ 降低总体风险暴露

### 3. 交易对选择

**推荐策略**：

- ✅ 主流币 + 山寨币组合
- ✅ 高市值 + 高波动性组合
- ✅ 相关性低的币种组合

**不推荐**：

- ❌ 全部选择 Meme 币（风险太高）
- ❌ 选择流动性差的币种
- ❌ 超过 10 个交易对（管理复杂）

### 4. 性能考虑

- API 请求频率会增加
- 建议轮询间隔 ≥ 15 秒
- 币种越多，单轮循环时间越长

---

## 📈 状态文件格式

### `botState.json` 结构

```json
{
  "symbols": {
    "BTC-USDT-SWAP": {
      "lastSignal": "long",
      "lastTradeTime": "2025-10-09T10:00:00.000Z",
      "currentPosition": {
        "posSide": "long",
        "size": 10,
        "entryPrice": 65000
      },
      "priceHistory": [64900, 64950, 65000, ...]
    },
    "ETH-USDT-SWAP": {
      "lastSignal": "hold",
      "lastTradeTime": null,
      "currentPosition": null,
      "priceHistory": [3180, 3190, 3200, ...]
    }
  },
  "errorCount": 0,
  "activePositions": 1
}
```

---

## 🔍 监控和管理

### 查看所有持仓

```bash
# 实时监控
tail -f okxNewBot.log | grep "当前持仓"

# 查看所有币种状态
tail -f okxNewBot.log | grep "市场状态"
```

### 查看状态文件

```bash
cat botState.json | jq
```

---

## 🚀 快速开始

### 1. 修改 `.env`

```bash
SYMBOLS=BTC-USDT-SWAP,ETH-USDT-SWAP,SOL-USDT-SWAP
MAX_CONCURRENT_POSITIONS=3
```

### 2. 重启机器人

```bash
node okxNewBot.js
```

### 3. 观察日志

```bash
tail -f okxNewBot.log
```

---

## 💡 优化建议

### 起步阶段

1. 从 1-2 个币种开始
2. 观察 1-2 周运行情况
3. 评估策略有效性

### 扩展阶段

1. 逐步增加币种
2. 调整并发限制
3. 优化资金分配

### 成熟阶段

1. 5-7 个主流币种
2. 设置合理并发限制
3. 定期回顾和调整

---

## ❓ 常见问题

### Q: 可以同时交易现货和合约吗？

A: 当前版本只支持永续合约（SWAP）。如需现货，需修改交易对名称如 `BTC-USDT`。

### Q: 不同币种会互相影响吗？

A: 每个币种独立分析和交易，互不影响。但会共享总资金池。

### Q: 如何防止同时开太多仓？

A: 使用 `MAX_CONCURRENT_POSITIONS` 参数限制并发持仓数量。

### Q: 哪些币种最适合这个策略？

A: 建议选择：

- ✅ 流动性好的主流币
- ✅ 波动性适中的币种
- ✅ 市值前 50 的项目

### Q: 资金不够怎么办？

A:

- 减少并发币种数量
- 降低单次风险比例
- 增加账户资金

---

**现在就开始多币种交易，分散风险，增加收益机会！** 🚀

> 提示：建议先在沙盒环境测试多币种配置！
