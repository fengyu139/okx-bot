# OKX 高低点突破策略机器人

## 策略说明

这是一个基于高低点突破的自动交易策略机器人，适用于 OKX 合约交易。

### 策略逻辑

1. **检测周期**：每隔 10 分钟执行一次检测
2. **判断条件**：
   - 获取过去 12 小时的价格数据
   - 计算 12 小时内的最高价和最低价
   - 判断当前价格是否触及最高点或最低点
3. **交易信号**：
   - **做多信号**：当前价格触及 12 小时最高点
   - **做空信号**：当前价格触及 12 小时最低点
4. **开仓规则**：
   - 使用 10 倍杠杆
   - 每次使用账户余额的 50%
5. **风险控制**：
   - **止盈**：涨幅 5%
   - **止损**：跌幅 3%

## 环境配置

### 1. 创建 `.env` 文件

在项目根目录创建 `.env` 文件，填入以下配置：

```bash
# OKX API 配置
OKX_API_KEY=your_api_key_here
OKX_SECRET_KEY=your_secret_key_here
OKX_PASSPHRASE=your_passphrase_here
OKX_BASE_URL=https://www.okx.com

# 交易对配置
SYMBOL=BTC-USDT-SWAP

# 策略参数（可选，有默认值）
LEVERAGE=10                    # 杠杆倍数（默认10倍）
POLL_INTERVAL_MS=600000        # 检测间隔（默认10分钟 = 600000毫秒）
LOOKBACK_HOURS=12              # 回溯时间（默认12小时）
POSITION_SIZE_PCT=0.5          # 仓位比例（默认50%）
TAKE_PROFIT_PCT=0.05           # 止盈比例（默认5%）
STOP_LOSS_PCT=0.03             # 止损比例（默认3%）
```

### 2. 安装依赖

```bash
npm install
# 或
pnpm install
```

需要的依赖包：

- `axios` - HTTP 请求
- `crypto` - 签名加密
- `dotenv` - 环境变量管理
- `dayjs` - 日期时间处理

## 使用方法

### 单币种运行

```bash
# 运行 BTC
SYMBOL=BTC-USDT-SWAP node okxHighLowBot.js

# 运行 ETH
SYMBOL=ETH-USDT-SWAP node okxHighLowBot.js
```

### 使用 PM2 管理（推荐）

#### 启动单个实例

```bash
pm2 start okxHighLowBot.js --name "highlow-btc" -- SYMBOL=BTC-USDT-SWAP
```

#### 启动多个实例

创建 `ecosystem.highlow.config.js` 配置文件：

```javascript
module.exports = {
  apps: [
    {
      name: "highlow-btc",
      script: "./okxHighLowBot.js",
      env: {
        SYMBOL: "BTC-USDT-SWAP",
        LEVERAGE: "10",
        POLL_INTERVAL_MS: "600000",
      },
    },
    {
      name: "highlow-eth",
      script: "./okxHighLowBot.js",
      env: {
        SYMBOL: "ETH-USDT-SWAP",
        LEVERAGE: "10",
        POLL_INTERVAL_MS: "600000",
      },
    },
    {
      name: "highlow-sol",
      script: "./okxHighLowBot.js",
      env: {
        SYMBOL: "SOL-USDT-SWAP",
        LEVERAGE: "10",
        POLL_INTERVAL_MS: "600000",
      },
    },
  ],
};
```

然后使用：

```bash
# 启动所有实例
pm2 start ecosystem.highlow.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs highlow-btc

# 停止所有实例
pm2 stop ecosystem.highlow.config.js

# 删除所有实例
pm2 delete ecosystem.highlow.config.js
```

## 日志和状态文件

### 日志文件位置

```
logs/okx-highlow-{SYMBOL}.log
```

例如：

- `logs/okx-highlow-BTC_USDT_SWAP.log`
- `logs/okx-highlow-ETH_USDT_SWAP.log`

### 状态文件位置

```
states/botState-highlow-{SYMBOL}.json
```

例如：

- `states/botState-highlow-BTC_USDT_SWAP.json`
- `states/botState-highlow-ETH_USDT_SWAP.json`

状态文件会保存：

- 当前持仓信息
- 最后交易时间
- 错误计数

## 手动止盈止损保护

### 功能说明

当自动止盈止损订单设置失败时，机器人会自动启用**手动止盈止损模式**作为安全保护：

1. **自动检测**：每次主循环都会检查当前价格
2. **手动平仓**：达到止盈止损条件时自动执行平仓
3. **状态恢复**：平仓成功后恢复正常交易模式

### 工作流程

```
开仓成功
    ↓
尝试设置止盈止损订单
    ↓
┌─────────┬─────────┐
│ 订单成功 │ 订单失败 │
│ 正常模式 │ 手动模式 │
└─────────┴─────────┘
              ↓
         每次主循环检查价格
              ↓
        ┌─────────┬─────────┐
        │ 未触发   │ 触发条件 │
        │ 继续等待 │ 立即平仓 │
        └─────────┴─────────┘
                      ↓
                 恢复正常模式
```

### 日志示例

#### 启用手动模式

```
[WARN] 🔧 启用手动止盈止损模式
{
  "止损单状态": "失败",
  "止盈单状态": "成功"
}
```

#### 手动检查

```
[INFO] 🔍 手动止盈止损检查
{
  "当前价格": "0.1400",
  "入场价": "0.1800",
  "止损价": "0.1500",
  "止盈价": "0.2100",
  "持仓方向": "long"
}
```

#### 触发平仓

```
[SUCCESS] 🎯 触发止损 - 执行手动平仓
{
  "触发价格": "0.1400",
  "盈亏": "-22.22%"
}
[SUCCESS] ✅ 手动平仓成功 - 触发止损
```

### 优势

✅ **双重保护**：自动订单失败时的备用方案
✅ **自动恢复**：无需人工干预
✅ **精确触发**：基于实时价格判断
✅ **完整日志**：详细记录触发过程

## 风险提示

⚠️ **重要提示**：

1. **测试环境优先**：请先在 OKX 模拟盘（Sandbox）测试
2. **资金管理**：建议使用小额资金测试策略效果
3. **市场风险**：加密货币市场波动大，可能会快速触及止损
4. **策略风险**：
   - 震荡市场可能频繁触发信号
   - 突破可能是假突破
   - 建议结合市场环境使用
5. **监控持仓**：定期检查机器人运行状态和持仓情况
6. **手动模式**：虽然有手动保护，但仍建议定期监控

## 参数调整建议

### 保守型参数

```bash
LEVERAGE=5                     # 降低杠杆
POSITION_SIZE_PCT=0.3          # 减少仓位
TAKE_PROFIT_PCT=0.03           # 降低止盈目标
STOP_LOSS_PCT=0.02             # 收紧止损
LOOKBACK_HOURS=24              # 延长回溯期
```

### 激进型参数

```bash
LEVERAGE=20                    # 提高杠杆（高风险）
POSITION_SIZE_PCT=0.7          # 增加仓位
TAKE_PROFIT_PCT=0.08           # 提高止盈目标
STOP_LOSS_PCT=0.05             # 放宽止损
LOOKBACK_HOURS=6               # 缩短回溯期
```

## 常见问题

### 1. 机器人不开仓？

检查：

- 当前价格是否真的触及 12 小时最高/最低点
- 账户余额是否充足
- 是否已有持仓（机器人不会重复开仓）
- 查看日志文件了解详细信息

### 2. 如何修改检测间隔？

修改 `POLL_INTERVAL_MS` 参数：

- 5 分钟 = 300000
- 10 分钟 = 600000
- 15 分钟 = 900000
- 30 分钟 = 1800000

### 3. 如何停止机器人？

```bash
# 如果直接运行
Ctrl + C

# 如果使用 PM2
pm2 stop highlow-btc
```

### 4. 机器人崩溃了怎么办？

1. 查看日志文件找出错误原因
2. 检查 API 密钥是否正确
3. 检查网络连接
4. 查看 OKX API 限额是否超限
5. PM2 会自动重启崩溃的进程

## 监控和维护

### 实时监控

```bash
# 实时查看日志
tail -f logs/okx-highlow-BTC_USDT_SWAP.log

# 查看最近 100 行
tail -n 100 logs/okx-highlow-BTC_USDT_SWAP.log

# PM2 实时日志
pm2 logs highlow-btc --lines 50
```

### 定期检查

建议每天检查：

1. 机器人运行状态
2. 持仓情况
3. 盈亏情况
4. 错误日志

## 技术支持

如有问题，请查看：

1. 日志文件中的详细错误信息
2. OKX API 文档：https://www.okx.com/docs-v5/
3. 状态文件中的持仓信息

## 免责声明

本机器人仅供学习和研究使用，不构成投资建议。使用者需自行承担交易风险，开发者不对任何交易损失负责。请在充分理解策略逻辑和风险的前提下使用。
