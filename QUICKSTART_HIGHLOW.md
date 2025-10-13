# 快速启动 - 高低点突破策略

## 5 分钟快速上手

### 第 1 步：配置 API 密钥

```bash
# 复制环境变量示例文件
cp env.highlow.example .env

# 编辑 .env 文件，填入你的 API 密钥
nano .env
# 或
vim .env
```

必填项：

```
OKX_API_KEY=你的API密钥
OKX_SECRET_KEY=你的密钥
OKX_PASSPHRASE=你的密码短语
```

### 第 2 步：安装依赖

```bash
# 如果还没安装依赖
npm install
# 或
pnpm install
```

### 第 3 步：启动机器人

#### 方法 1：使用启动脚本（推荐）

```bash
# 给脚本添加执行权限（只需一次）
chmod +x startHighLow.sh stopHighLow.sh

# 启动
./startHighLow.sh

# 停止
./stopHighLow.sh
```

#### 方法 2：使用 PM2

```bash
# 启动所有币种
pm2 start ecosystem.highlow.config.js

# 或只启动单个币种
pm2 start okxHighLowBot.js --name highlow-btc -- SYMBOL=BTC-USDT-SWAP
```

#### 方法 3：直接运行

```bash
# 单个币种
SYMBOL=BTC-USDT-SWAP node okxHighLowBot.js

# 或在 .env 中配置好 SYMBOL 后直接运行
node okxHighLowBot.js
```

### 第 4 步：监控运行

```bash
# 查看 PM2 状态
pm2 status

# 查看实时日志
pm2 logs highlow-btc

# 或查看文件日志
tail -f logs/okx-highlow-BTC_USDT_SWAP.log
```

## 策略工作原理

```
┌─────────────────────────────────────────┐
│         每 10 分钟检测一次              │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   获取过去 12 小时的价格数据            │
│   计算最高价和最低价                    │
└─────────────────────────────────────────┘
                  ↓
         ┌────────┴────────┐
         ↓                 ↓
  ┌──────────┐      ┌──────────┐
  │触及最高点│      │触及最低点│
  │  做多 ↑  │      │  做空 ↓  │
  └──────────┘      └──────────┘
         ↓                 ↓
  ┌──────────────────────────┐
  │  开仓：10倍杠杆          │
  │  仓位：余额的 50%        │
  │  止盈：5%                │
  │  止损：3%                │
  └──────────────────────────┘
```

## 实际运行示例

### 做多场景

```
时间: 2025-01-15 10:00
12小时最高价: 42,500 USDT
12小时最低价: 41,000 USDT
当前价格: 42,480 USDT  ✅ 触及最高点

→ 开仓做多 BTC
  入场价: 42,480
  杠杆: 10x
  仓位: 账户余额 50%
  止盈价: 44,604 (↑5%)
  止损价: 41,226 (↓3%)
```

### 做空场景

```
时间: 2025-01-15 14:00
12小时最高价: 42,500 USDT
12小时最低价: 41,000 USDT
当前价格: 41,020 USDT  ✅ 触及最低点

→ 开仓做空 BTC
  入场价: 41,020
  杠杆: 10x
  仓位: 账户余额 50%
  止盈价: 38,969 (↓5%)
  止损价: 42,251 (↑3%)
```

## 参数调整

### 保守模式（适合新手）

编辑 `.env` 文件：

```bash
LEVERAGE=5                    # 降低杠杆到 5 倍
POSITION_SIZE_PCT=0.3         # 减少仓位到 30%
TAKE_PROFIT_PCT=0.03          # 降低止盈到 3%
STOP_LOSS_PCT=0.02            # 收紧止损到 2%
LOOKBACK_HOURS=24             # 延长观察期到 24 小时
```

### 标准模式（默认）

```bash
LEVERAGE=10                   # 10 倍杠杆
POSITION_SIZE_PCT=0.5         # 50% 仓位
TAKE_PROFIT_PCT=0.05          # 5% 止盈
STOP_LOSS_PCT=0.03            # 3% 止损
LOOKBACK_HOURS=12             # 12 小时观察期
```

### 激进模式（高风险）

```bash
LEVERAGE=20                   # 提高杠杆到 20 倍
POSITION_SIZE_PCT=0.7         # 增加仓位到 70%
TAKE_PROFIT_PCT=0.08          # 提高止盈到 8%
STOP_LOSS_PCT=0.05            # 放宽止损到 5%
LOOKBACK_HOURS=6              # 缩短观察期到 6 小时
```

## 常用命令速查

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs highlow-btc              # PM2 日志
tail -f logs/okx-highlow-BTC_USDT_SWAP.log  # 文件日志

# 启动/停止/重启
pm2 start ecosystem.highlow.config.js
pm2 stop ecosystem.highlow.config.js
pm2 restart ecosystem.highlow.config.js

# 删除实例
pm2 delete ecosystem.highlow.config.js

# 单个币种操作
pm2 stop highlow-btc
pm2 restart highlow-btc
pm2 delete highlow-btc
```

## 日志位置

```
项目目录/
├── logs/
│   ├── okx-highlow-BTC_USDT_SWAP.log    # BTC 交易日志
│   ├── okx-highlow-ETH_USDT_SWAP.log    # ETH 交易日志
│   └── okx-highlow-SOL_USDT_SWAP.log    # SOL 交易日志
└── states/
    ├── botState-highlow-BTC_USDT_SWAP.json  # BTC 状态文件
    ├── botState-highlow-ETH_USDT_SWAP.json  # ETH 状态文件
    └── botState-highlow-SOL_USDT_SWAP.json  # SOL 状态文件
```

## 监控检查清单

### 每小时检查

- [ ] 机器人运行状态：`pm2 status`
- [ ] 最新日志：`pm2 logs --lines 10`

### 每天检查

- [ ] 持仓情况
- [ ] 盈亏统计
- [ ] 错误日志

### 每周检查

- [ ] 策略表现回顾
- [ ] 参数优化调整
- [ ] 清理旧日志

## 故障排查

### 问题 1：机器人不开仓

**可能原因：**

1. 价格没有触及高低点
2. 账户余额不足
3. 已有持仓（不会重复开仓）

**解决方法：**

```bash
# 查看日志
tail -100 logs/okx-highlow-BTC_USDT_SWAP.log

# 检查关键信息
grep "价格分析" logs/okx-highlow-BTC_USDT_SWAP.log
grep "可用余额" logs/okx-highlow-BTC_USDT_SWAP.log
grep "当前持仓" logs/okx-highlow-BTC_USDT_SWAP.log
```

### 问题 2：API 错误

**可能原因：**

1. API 密钥错误
2. 权限不足
3. IP 白名单限制

**解决方法：**

```bash
# 检查 .env 文件
cat .env | grep OKX_

# 重新设置 API 密钥
nano .env

# 重启机器人
pm2 restart ecosystem.highlow.config.js
```

### 问题 3：止损止盈未触发

**可能原因：**

1. 订单提交失败
2. 市场波动剧烈跳过价格

**解决方法：**

```bash
# 查看止损止盈设置日志
grep "止损单已设置" logs/okx-highlow-BTC_USDT_SWAP.log
grep "止盈单已设置" logs/okx-highlow-BTC_USDT_SWAP.log

# 检查是否启用了手动模式
grep "启用手动止盈止损模式" logs/okx-highlow-BTC_USDT_SWAP.log

# 查看手动检查日志
grep "手动止盈止损检查" logs/okx-highlow-BTC_USDT_SWAP.log
```

**注意**：机器人有**手动止盈止损保护**！订单失败时会自动启用手动模式，无需担心！

## 性能优化建议

### 1. 多币种分散

不要把所有资金投入单一币种，建议：

- BTC: 40% 资金
- ETH: 30% 资金
- 其他主流币: 30% 资金

### 2. 时间分散

不同币种使用不同的检测间隔：

- BTC: 10 分钟
- ETH: 12 分钟
- SOL: 15 分钟

避免同时触发多个交易。

### 3. 市场环境适配

- **趋势市场**：延长 LOOKBACK_HOURS（24 小时）
- **震荡市场**：缩短 LOOKBACK_HOURS（6 小时）
- **高波动**：收紧止损（2%）
- **低波动**：放宽止盈（8%）

## 安全提示

⚠️ **重要提醒**

1. **先用模拟盘测试**

   - OKX 提供模拟交易环境
   - 充分测试后再用实盘

2. **控制风险**

   - 不要投入超过承受能力的资金
   - 建议用总资金的 10-20% 测试

3. **定期监控**

   - 不要完全无人值守
   - 每天至少检查 1-2 次

4. **备份配置**

   - 定期备份 .env 和状态文件
   - 记录交易参数

5. **API 安全**
   - 使用子账户 API
   - 限制 IP 白名单
   - 定期更换密钥

## 下一步

配置完成后，建议：

1. ✅ 观察 1-2 天，不开仓
2. ✅ 用小额测试（如 100 USDT）
3. ✅ 记录交易表现
4. ✅ 优化参数
5. ✅ 逐步增加资金

## 获取帮助

如遇问题：

1. 查看 `README_HighLowBot.md` 详细文档
2. 检查日志文件
3. 查看 OKX API 文档

祝交易顺利！ 🚀
