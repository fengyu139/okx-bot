# 高低点突破策略 - 文件清单

## 📦 新增文件列表

本次为 OKX 交易机器人新增了**高低点突破策略**，以下是所有相关文件：

### 1. 核心策略文件

#### `okxHighLowBot.js` ⭐

- **类型**：主程序文件
- **功能**：高低点突破策略的核心实现
- **大小**：约 600 行代码
- **说明**：包含完整的交易逻辑、风险管理、止损止盈设置

**核心功能：**

```javascript
- 每 10 分钟检测一次价格
- 判断是否触及 12 小时高低点
- 自动开仓、设置止损止盈
- 手动止盈止损保护（订单失败时备用）
- 状态持久化
- 完善的日志记录
```

---

### 2. 文档文件

#### `README_HighLowBot.md` 📖

- **类型**：详细说明文档
- **内容**：
  - 策略逻辑详解
  - 环境配置方法
  - 完整使用指南
  - 风险提示
  - 常见问题解答
  - 参数调整建议

#### `QUICKSTART_HIGHLOW.md` 🚀

- **类型**：快速启动指南
- **内容**：
  - 5 分钟快速上手
  - 三种启动方式
  - 策略工作原理图解
  - 实际运行示例
  - 常用命令速查
  - 故障排查指南

#### `STRATEGY_COMPARISON.md` 📊

- **类型**：策略对比文档
- **内容**：
  - SMA 均线策略 vs 高低点突破策略
  - 详细对比表格
  - 如何选择策略
  - 组合使用建议
  - 回测建议

---

### 3. 配置文件

#### `ecosystem.highlow.config.js` ⚙️

- **类型**：PM2 配置文件
- **功能**：管理多个币种的策略实例
- **预配置币种**：
  - BTC-USDT-SWAP
  - ETH-USDT-SWAP
  - SOL-USDT-SWAP

**使用方法：**

```bash
pm2 start ecosystem.highlow.config.js
pm2 stop ecosystem.highlow.config.js
```

#### `env.highlow.example` 📝

- **类型**：环境变量示例文件
- **功能**：提供完整的配置模板
- **包含**：
  - API 密钥配置
  - 所有策略参数
  - 详细注释说明
  - 使用说明

**使用方法：**

```bash
cp env.highlow.example .env
# 编辑 .env 填入你的配置
```

---

### 4. 启动脚本

#### `startHighLow.sh` 🟢

- **类型**：启动脚本
- **功能**：一键启动所有高低点策略实例
- **特性**：
  - 自动检查 PM2 安装
  - 创建必要目录
  - 显示启动状态
  - 提供常用命令提示

**使用方法：**

```bash
chmod +x startHighLow.sh
./startHighLow.sh
```

#### `stopHighLow.sh` 🔴

- **类型**：停止脚本
- **功能**：一键停止所有高低点策略实例
- **特性**：
  - 显示停止前后状态
  - 提供后续操作提示

**使用方法：**

```bash
chmod +x stopHighLow.sh
./stopHighLow.sh
```

---

### 5. 新增文件汇总

#### `HIGHLOW_STRATEGY_FILES.md` 📋

- **类型**：文件清单（本文件）
- **功能**：列出所有新增文件及其说明

---

## 📂 目录结构

```
okx-bot/
├── okxHighLowBot.js                    # 主程序 ⭐
├── ecosystem.highlow.config.js         # PM2 配置 ⚙️
├── env.highlow.example                 # 环境变量示例 📝
├── startHighLow.sh                     # 启动脚本 🟢
├── stopHighLow.sh                      # 停止脚本 🔴
├── README_HighLowBot.md                # 详细文档 📖
├── QUICKSTART_HIGHLOW.md               # 快速启动 🚀
├── STRATEGY_COMPARISON.md              # 策略对比 📊
├── HIGHLOW_STRATEGY_FILES.md           # 文件清单 📋
├── logs/                               # 日志目录
│   ├── okx-highlow-BTC_USDT_SWAP.log
│   ├── okx-highlow-ETH_USDT_SWAP.log
│   └── okx-highlow-SOL_USDT_SWAP.log
└── states/                             # 状态目录
    ├── botState-highlow-BTC_USDT_SWAP.json
    ├── botState-highlow-ETH_USDT_SWAP.json
    └── botState-highlow-SOL_USDT_SWAP.json
```

---

## 🚀 快速开始

### 最简单的方式

```bash
# 1. 配置环境变量
cp env.highlow.example .env
nano .env  # 填入你的 API 密钥

# 2. 启动
./startHighLow.sh

# 3. 查看日志
pm2 logs highlow-btc
```

### 详细步骤

请参考：

- 新手：`QUICKSTART_HIGHLOW.md`
- 详细：`README_HighLowBot.md`

---

## 📊 策略参数

### 默认参数

| 参数     | 默认值  | 说明               |
| -------- | ------- | ------------------ |
| 杠杆倍数 | 10x     | 建议 5-20          |
| 检测间隔 | 10 分钟 | 600000 毫秒        |
| 回溯周期 | 12 小时 | 144 根 5 分钟 K 线 |
| 仓位比例 | 50%     | 账户余额的 50%     |
| 止盈     | 5%      | 0.05               |
| 止损     | 3%      | 0.03               |

### 修改参数

编辑 `.env` 文件：

```bash
LEVERAGE=10                 # 杠杆
POLL_INTERVAL_MS=600000     # 检测间隔
LOOKBACK_HOURS=12           # 回溯时间
POSITION_SIZE_PCT=0.5       # 仓位比例
TAKE_PROFIT_PCT=0.05        # 止盈
STOP_LOSS_PCT=0.03          # 止损
```

---

## 🔧 与现有策略的关系

### 现有策略（SMA 均线）

```
文件: okxNewBot.js
配置: ecosystem.config.js
启动: ./startMulti.sh
```

### 新策略（高低点突破）

```
文件: okxHighLowBot.js
配置: ecosystem.highlow.config.js
启动: ./startHighLow.sh
```

### 可以同时运行

```bash
# 启动 SMA 均线策略
./startMulti.sh

# 启动高低点突破策略
./startHighLow.sh

# 查看所有实例
pm2 status
```

**注意**：不要在同一币种上同时运行两个策略！

---

## 📈 监控和日志

### 查看运行状态

```bash
pm2 status
```

### 查看日志

```bash
# PM2 日志
pm2 logs highlow-btc

# 文件日志
tail -f logs/okx-highlow-BTC_USDT_SWAP.log
```

### 日志内容

```
[2025-01-15 10:00:00] [INFO] ========== 开始新一轮检测 ==========
[2025-01-15 10:00:01] [INFO] 💰 可用余额: 1000.00 USDT
[2025-01-15 10:00:02] [INFO] 📊 价格分析
{
  "当前价格": "42480.00",
  "12小时最高": "42500.00",
  "12小时最低": "41000.00",
  "距离最高": "-0.05%",
  "距离最低": "3.61%"
}
[2025-01-15 10:00:03] [SUCCESS] 🔥 触及12小时最高点！准备做多
```

---

## ⚠️ 重要提示

### 1. 测试环境

请先在 OKX 模拟盘测试：

```bash
# 在 .env 中设置
OKX_BASE_URL=https://www.okx.com  # 模拟环境
```

### 2. 风险控制

- 不要使用过高杠杆（建议 ≤ 10x）
- 不要满仓操作（建议仓位 ≤ 50%）
- 设置合理的止损（建议 2-5%）

### 3. 资金管理

- 起始测试：100-500 USDT
- 表现良好后逐步增加
- 不要投入承受不起的资金

### 4. 监控频率

- 每小时检查一次状态
- 每天查看盈亏情况
- 每周回顾策略表现

---

## 📚 推荐阅读顺序

如果你是新手，建议按以下顺序阅读：

1. **QUICKSTART_HIGHLOW.md** - 快速上手
2. **README_HighLowBot.md** - 深入了解
3. **STRATEGY_COMPARISON.md** - 对比选择

如果你已经熟悉现有策略：

1. **STRATEGY_COMPARISON.md** - 了解区别
2. **QUICKSTART_HIGHLOW.md** - 快速部署

---

## 🆘 获取帮助

### 常见问题

1. **不开仓？**

   - 检查日志：`tail -100 logs/okx-highlow-BTC_USDT_SWAP.log`
   - 可能原因：价格未触及高低点、余额不足、已有持仓

2. **API 错误？**

   - 检查 .env 配置
   - 确认 API 权限
   - 检查 IP 白名单

3. **策略表现不佳？**
   - 调整回溯周期（LOOKBACK_HOURS）
   - 调整止损止盈比例
   - 换个币种测试

### 文档链接

- 详细文档：`README_HighLowBot.md`
- 快速启动：`QUICKSTART_HIGHLOW.md`
- 策略对比：`STRATEGY_COMPARISON.md`

---

## ✅ 检查清单

在开始使用前，请确认：

- [ ] 已安装依赖：`npm install`
- [ ] 已配置 .env 文件
- [ ] 已填入正确的 API 密钥
- [ ] 已创建 logs 和 states 目录
- [ ] 已给启动脚本添加执行权限
- [ ] 已阅读风险提示
- [ ] 决定使用模拟盘或实盘
- [ ] 设置了合理的参数

---

## 🎯 下一步

1. ✅ 配置环境变量
2. ✅ 启动策略：`./startHighLow.sh`
3. ✅ 观察日志：`pm2 logs highlow-btc`
4. ✅ 监控表现
5. ✅ 优化参数

祝交易顺利！🚀📈

---

## 📝 更新日志

- **2025-01-15**：创建高低点突破策略
  - 新增主程序 `okxHighLowBot.js`
  - 新增完整文档系统
  - 新增启动脚本
  - 新增 PM2 配置

---

**注意**：本策略仅供学习研究使用，使用者需自行承担交易风险。
