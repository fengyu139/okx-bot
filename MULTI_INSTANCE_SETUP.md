# 多币种交易 - 简单实现方案

## 方案概述

由于完全重构代码工作量较大，我为您提供一个**更简单的实现方案**：

**运行多个机器人实例，每个实例交易一个币种。**

---

## 🚀 快速实现步骤

### 方案 1：多进程方式（推荐）

#### 1. 创建启动脚本

创建 `startMulti.sh`：

```bash
#!/bin/bash

# 多币种交易启动脚本

# BTC 机器人
SYMBOL=BTC-USDT-SWAP node okxNewBot.js > logs/btc.log 2>&1 &
echo "BTC 机器人已启动，PID: $!"

# ETH 机器人
SYMBOL=ETH-USDT-SWAP node okxNewBot.js > logs/eth.log 2>&1 &
echo "ETH 机器人已启动，PID: $!"

# SOL 机器人
SYMBOL=SOL-USDT-SWAP node okxNewBot.js > logs/sol.log 2>&1 &
echo "SOL 机器人已启动，PID: $!"

echo "所有机器人已启动！"
echo "查看日志："
echo "  tail -f logs/btc.log"
echo "  tail -f logs/eth.log"
echo "  tail -f logs/sol.log"
```

#### 2. 创建日志目录

```bash
mkdir logs
```

#### 3. 启动多个机器人

```bash
chmod +x startMulti.sh
./startMulti.sh
```

#### 4. 停止所有机器人

创建 `stopMulti.sh`：

```bash
#!/bin/bash
pkill -f "node okxNewBot.js"
echo "所有机器人已停止"
```

---

### 方案 2：PM2 进程管理（生产环境推荐）

#### 1. 安装 PM2

```bash
npm install -g pm2
```

#### 2. 创建 PM2 配置文件

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: "okx-bot-btc",
      script: "./okxNewBot.js",
      env: {
        SYMBOL: "BTC-USDT-SWAP",
        RISK_PER_TRADE: "0.015",
      },
      error_file: "./logs/btc-error.log",
      out_file: "./logs/btc-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "okx-bot-eth",
      script: "./okxNewBot.js",
      env: {
        SYMBOL: "ETH-USDT-SWAP",
        RISK_PER_TRADE: "0.015",
      },
      error_file: "./logs/eth-error.log",
      out_file: "./logs/eth-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "okx-bot-sol",
      script: "./okxNewBot.js",
      env: {
        SYMBOL: "SOL-USDT-SWAP",
        RISK_PER_TRADE: "0.015",
      },
      error_file: "./logs/sol-error.log",
      out_file: "./logs/sol-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "okx-bot-doge",
      script: "./okxNewBot.js",
      env: {
        SYMBOL: "DOGE-USDT-SWAP",
        RISK_PER_TRADE: "0.02", // Meme 币可以设置更高风险
      },
      error_file: "./logs/doge-error.log",
      out_file: "./logs/doge-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
```

#### 3. PM2 命令

```bash
# 启动所有机器人
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs okx-bot-btc
pm2 logs  # 查看所有日志

# 停止所有
pm2 stop all

# 重启所有
pm2 restart all

# 删除所有
pm2 delete all

# 开机自启动
pm2 startup
pm2 save
```

---

## 📊 监控所有机器人

### 创建监控脚本

创建 `monitor.sh`：

```bash
#!/bin/bash

echo "===== OKX 多币种机器人状态 ====="
echo ""

for symbol in BTC ETH SOL DOGE; do
  echo "[$symbol]"
  tail -n 3 logs/${symbol,,}.log | grep -E "市场状态|开仓成功|平仓成功" || echo "  无最新交易"
  echo ""
done

echo "===== PM2 进程状态 ====="
pm2 status
```

运行监控：

```bash
chmod +x monitor.sh
./monitor.sh
```

---

## 💰 资金分配建议

### 手动分配资金

假设总资金 5000 USDT，交易 4 个币种：

```javascript
// ecosystem.config.js 中配置
{
  name: 'okx-bot-btc',
  env: {
    SYMBOL: 'BTC-USDT-SWAP',
    STARTING_CAPITAL: '2000',  // BTC 分配 40%
    RISK_PER_TRADE: '0.01'
  }
},
{
  name: 'okx-bot-eth',
  env: {
    SYMBOL: 'ETH-USDT-SWAP',
    STARTING_CAPITAL: '1500',  // ETH 分配 30%
    RISK_PER_TRADE: '0.015'
  }
},
{
  name: 'okx-bot-sol',
  env: {
    SYMBOL: 'SOL-USDT-SWAP',
    STARTING_CAPITAL: '1000',  // SOL 分配 20%
    RISK_PER_TRADE: '0.02'
  }
},
{
  name: 'okx-bot-doge',
  env: {
    SYMBOL: 'DOGE-USDT-SWAP',
    STARTING_CAPITAL: '500',   // DOGE 分配 10%
    RISK_PER_TRADE: '0.03'
  }
}
```

---

## ✅ 优点

1. ✅ **实现简单** - 无需修改代码
2. ✅ **独立运行** - 每个币种互不影响
3. ✅ **灵活配置** - 每个币种可以不同参数
4. ✅ **易于管理** - PM2 提供完整的进程管理
5. ✅ **日志分离** - 每个币种独立日志文件
6. ✅ **故障隔离** - 一个币种出错不影响其他

---

## ⚠️ 注意事项

### 1. 状态文件冲突

**问题**：多个实例会共享 `botState.json`

**解决方案**：

修改 `okxNewBot.js` 中的状态文件路径：

```javascript
// 原来
const STATE_FILE = path.join(__dirname, "botState.json");

// 改为（使用币种名称区分）
const STATE_FILE = path.join(
  __dirname,
  `botState-${SYMBOL.replace("/", "-")}.json`
);
```

或者在 PM2 配置中设置环境变量：

```javascript
{
  name: 'okx-bot-btc',
  env: {
    SYMBOL: 'BTC-USDT-SWAP',
    STATE_FILE: 'botState-BTC.json'  // 自定义状态文件
  }
}
```

### 2. 日志文件冲突

**问题**：多个实例会共享 `okxNewBot.log`

**解决方案**：

修改日志文件路径：

```javascript
// 原来
const LOG_FILE = path.join(__dirname, "okxNewBot.log");

// 改为
const LOG_FILE = path.join(__dirname, `okx-${SYMBOL.replace("/", "-")}.log`);
```

### 3. API 频率限制

OKX API 有频率限制，多个实例同时运行需注意：

- 建议每个实例间隔 3-5 秒启动
- 适当增加轮询间隔（如 20 秒）

---

## 🔧 必要的代码修改

为避免文件冲突，在 `okxNewBot.js` 开头添加：

```javascript
// 在 LOG_FILE 定义处修改
const SYMBOL = process.env.SYMBOL || "BTC-USDT-SWAP";
const SYMBOL_SHORT = SYMBOL.replace(/-/g, "_").replace(/\//g, "_");
const LOG_FILE = path.join(__dirname, `okx-${SYMBOL_SHORT}.log`);
const STATE_FILE = path.join(__dirname, `botState-${SYMBOL_SHORT}.json`);
```

---

## 📈 完整示例

### 1. 修改代码（避免文件冲突）

在 `okxNewBot.js` 第 38 行附近添加：

```javascript
// === 日志系统 ===
const SYMBOL_SHORT = SYMBOL.replace(/-/g, "_");
const LOG_FILE = path.join(__dirname, `logs/okx-${SYMBOL_SHORT}.log`);
const STATE_FILE = path.join(__dirname, `states/botState-${SYMBOL_SHORT}.json`);
```

### 2. 创建目录

```bash
mkdir logs states
```

### 3. 创建 PM2 配置并启动

```bash
pm2 start ecosystem.config.js
pm2 save
```

### 4. 监控运行

```bash
pm2 monit  # 实时监控
pm2 logs   # 查看所有日志
```

---

## 🎯 总结

**这个方案的本质**：

- 🔄 运行多个独立的机器人实例
- 📦 每个实例交易一个币种
- 🎛️ 通过环境变量配置不同参数
- 🔧 使用 PM2 统一管理所有实例

**相比完全重构代码的优势**：

- ✅ 实现快速（5 分钟配置完成）
- ✅ 代码改动最小
- ✅ 稳定可靠
- ✅ 易于维护

**现在就可以开始多币种交易！** 🚀

---

需要我帮您创建这些配置文件吗？
