# 🚀 多币种交易 - 5 分钟快速开始

## 方案选择

您的机器人现在支持两种多币种交易方式：

### ✅ 方案 A：多实例模式（推荐，无需修改代码）

运行多个独立的机器人实例，每个交易一个币种

### 🔧 方案 B：单实例多币种（需要代码改造）

一个机器人实例同时管理多个币种

**本指南介绍方案 A（推荐）**

---

## 📋 快速开始步骤

### 步骤 1：创建必要目录

```bash
mkdir -p logs states
```

### 步骤 2：选择启动方式

#### 方式 1：使用 Shell 脚本（最简单）

```bash
# 启动所有机器人
./startMulti.sh

# 监控状态
./monitor.sh

# 停止所有机器人
./stopMulti.sh
```

#### 方式 2：使用 PM2（生产环境推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动所有机器人
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 停止
pm2 stop all
```

---

## 📝 配置说明

### 默认配置（3 个币种）

`ecosystem.config.js` 默认配置了：

- **BTC**: 2000 USDT, 风险 1%
- **ETH**: 1500 USDT, 风险 1.5%
- **SOL**: 1000 USDT, 风险 2%

### 添加更多币种

编辑 `ecosystem.config.js`，复制一个配置块：

```javascript
{
  name: 'okx-bot-doge',
  script: './okxNewBot.js',
  env: {
    SYMBOL: 'DOGE-USDT-SWAP',
    STARTING_CAPITAL: '500',
    RISK_PER_TRADE: '0.03'
  },
  error_file: './logs/doge-error.log',
  out_file: './logs/doge-out.log'
}
```

---

## 🎯 支持的币种

### 主流币种（推荐）

```
BTC-USDT-SWAP   # 比特币
ETH-USDT-SWAP   # 以太坊
BNB-USDT-SWAP   # 币安币
SOL-USDT-SWAP   # Solana
XRP-USDT-SWAP   # 瑞波币
ADA-USDT-SWAP   # 卡尔达诺
DOT-USDT-SWAP   # 波卡
AVAX-USDT-SWAP  # 雪崩
MATIC-USDT-SWAP # Polygon
```

---

## 📊 监控和管理

### 查看所有机器人状态

```bash
./monitor.sh
```

### 查看单个币种日志

```bash
tail -f logs/btc.log
tail -f logs/eth.log
tail -f logs/sol.log
```

### PM2 监控

```bash
pm2 monit       # 实时监控面板
pm2 logs        # 所有日志
pm2 logs okx-bot-btc  # 单个日志
```

---

## ⚠️ 重要提醒

### 1. 文件冲突问题

**当前代码还需要小修改以避免文件冲突！**

在 `okxNewBot.js` 第 38-39 行修改为：

```javascript
// === 日志系统 ===
const SYMBOL_SHORT = (process.env.SYMBOL || "BTC-USDT-SWAP").replace(/-/g, "_");
const LOG_FILE = path.join(__dirname, `logs/okx-${SYMBOL_SHORT}.log`);
const STATE_FILE = path.join(__dirname, `states/botState-${SYMBOL_SHORT}.json`);
```

### 2. 资金分配

确保您的账户有足够资金覆盖所有配置的 `STARTING_CAPITAL` 总和。

### 3. API 频率限制

多个实例会增加 API 调用频率，建议：

- 轮询间隔设置为 15-20 秒
- 各实例启动时间错开 3-5 秒

---

## 🔧 文件结构

```
okx-bot/
├── okxNewBot.js           # 机器人主程序
├── ecosystem.config.js    # PM2 配置文件
├── startMulti.sh          # 启动脚本
├── stopMulti.sh           # 停止脚本
├── monitor.sh             # 监控脚本
├── logs/                  # 日志目录
│   ├── btc.log
│   ├── eth.log
│   └── sol.log
└── states/                # 状态文件目录
    ├── botState-BTC_USDT_SWAP.json
    ├── botState-ETH_USDT_SWAP.json
    └── botState-SOL_USDT_SWAP.json
```

---

## 💡 使用示例

### 场景 1：启动 3 个币种

```bash
# 使用 PM2
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 输出：
# ┌─────┬────────────────┬─────────┬─────┐
# │ id  │ name           │ status  │ cpu │
# ├─────┼────────────────┼─────────┼─────┤
# │ 0   │ okx-bot-btc    │ online  │ 2%  │
# │ 1   │ okx-bot-eth    │ online  │ 1%  │
# │ 2   │ okx-bot-sol    │ online  │ 1%  │
# └─────┴────────────────┴─────────┴─────┘
```

### 场景 2：只启动某个币种

```bash
pm2 start ecosystem.config.js --only okx-bot-btc
```

### 场景 3：重启某个币种

```bash
pm2 restart okx-bot-eth
```

### 场景 4：查看实时日志

```bash
pm2 logs okx-bot-btc --lines 50
```

---

## 📈 预期效果

启动后，每个机器人会：

1. ✅ 独立分析各自的币种
2. ✅ 根据双均线策略生成信号
3. ✅ 独立开仓/平仓
4. ✅ 设置止损止盈
5. ✅ 记录独立的日志和状态

---

## 🆘 故障排查

### 问题 1：脚本无法执行

```bash
chmod +x startMulti.sh stopMulti.sh monitor.sh
```

### 问题 2：日志文件冲突

确保已修改代码中的 `LOG_FILE` 和 `STATE_FILE` 路径

### 问题 3：PM2 命令不存在

```bash
npm install -g pm2
```

### 问题 4：机器人频繁报错

检查 API 密钥是否正确，网络是否正常

---

## 📚 相关文档

- [MULTI_INSTANCE_SETUP.md](./MULTI_INSTANCE_SETUP.md) - 详细的多实例配置说明
- [MULTI_SYMBOL_GUIDE.md](./MULTI_SYMBOL_GUIDE.md) - 多币种策略指南
- [README_NewBot.md](./README_NewBot.md) - 完整功能说明

---

## ✅ 检查清单

在启动前确认：

- [ ] 已创建 `.env` 文件并配置 API 密钥
- [ ] 已创建 `logs/` 和 `states/` 目录
- [ ] 已修改代码避免文件冲突
- [ ] 已配置合适的资金分配
- [ ] 已在沙盒环境测试

---

**现在就开始多币种交易，分散风险，抓住更多机会！** 🎯

有问题随时询问！
