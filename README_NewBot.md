# OKX 交易机器人 - 完善版

## 📋 新增功能

这是基于原始 `okxNewBot.js` 的完善版本，新增了以下核心功能：

### ✅ 1. 完善的日志记录系统

- **文件日志**: 所有操作自动记录到 `okxNewBot.log`
- **日志级别**: INFO, WARN, ERROR, SUCCESS
- **详细记录**: 包含交易详情、错误堆栈、API 响应等
- **便于调试**: 可追溯所有操作历史

### ✅ 2. 持仓管理功能

- **持仓查询**: 实时查询当前持仓状态
- **智能平仓**:
  - 信号反转时自动平仓
  - 市价平仓确保快速执行
  - 平仓前验证持仓存在
- **持仓显示**: 展示持仓方向、数量、均价、盈亏等信息

### ✅ 3. 止损止盈订单（Algo 订单）

- **止损订单**: 开仓后自动提交止损订单（1.5%）
- **止盈订单**: 开仓后自动提交止盈订单（3%）
- **市价触发**: 触发价到达时以市价成交
- **双向支持**: 支持多头和空头的止损止盈

### ✅ 4. 异常处理和状态恢复

- **状态持久化**:
  - 持仓状态保存到 `botState.json`
  - 程序重启后自动恢复状态
- **错误计数**:
  - 连续错误超过 5 次暂停 60 秒
  - 连续错误超过 10 次自动停止
- **优雅退出**:
  - 捕获 SIGINT/SIGTERM 信号
  - 退出前保存状态并记录持仓
- **全局异常捕获**:
  - 捕获未处理的 Promise 拒绝
  - 捕获未捕获的异常

## 🔧 主要改进

### 交易逻辑优化

```javascript
// 旧版本：只下单，不检查持仓
if (signal === "long" || signal === "short") {
  // 直接下单
}

// 新版本：智能持仓管理
if (currentPosition) {
  // 检查是否需要平仓
  if (信号反转) {
    平仓();
  }
}
if (新信号 && 无持仓) {
  开仓();
  提交止损订单();
  提交止盈订单();
}
```

### API 函数新增

```javascript
// 持仓管理
getPositions(instId); // 查询持仓
closePosition(instId, posSide); // 平仓

// Algo订单
placeAlgoOrder(algoOrder); // 提交algo订单
cancelAlgoOrder(params); // 取消algo订单
getAlgoOrders(instId); // 查询未成交algo订单

// 日志系统
log(level, message, data); // 统一日志接口
saveState(state); // 保存状态
loadState(); // 加载状态
```

## 📊 状态文件格式

### botState.json

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

## 🚀 使用说明

### 环境变量配置

在 `.env` 文件中配置：

```bash
OKX_API_KEY=your_api_key
OKX_SECRET_KEY=your_secret_key
OKX_PASSPHRASE=your_passphrase
OKX_BASE_URL=https://www.okx.com
SYMBOL=BTC-USDT-SWAP
STARTING_CAPITAL=1000
RISK_PER_TRADE=0.015
LEVERAGE=10
SHORT_SMA_PERIOD=7
LONG_SMA_PERIOD=25
POLL_INTERVAL_MS=15000
```

### 启动机器人

```bash
node okxNewBot.js
```

### 查看日志

```bash
# 实时查看日志
tail -f okxNewBot.log

# 查看最近100行
tail -n 100 okxNewBot.log

# 搜索错误
grep ERROR okxNewBot.log
```

### 优雅停止

```bash
# 按 Ctrl+C 停止
# 机器人会：
# 1. 查询并记录当前持仓
# 2. 保存状态到文件
# 3. 优雅退出
```

## ⚠️ 重要提示

### 1. 测试环境

- **务必先用沙盒环境测试**
- 沙盒 URL: `https://www.okx.com` (需要沙盒 API key)
- 验证所有功能正常后再切换到实盘

### 2. 风险控制

- 建议初始 `RISK_PER_TRADE` 设置为 0.01 (1%)
- 仔细检查杠杆倍数设置
- 监控账户资金变化

### 3. 网络问题

- 确保服务器网络稳定
- 建议使用 VPS 部署
- 异常情况会自动重试和暂停

### 4. 持仓监控

- 定期检查 `botState.json` 文件
- 查看日志确认止损止盈订单已提交
- 可以登录 OKX 网页查看 algo 订单状态

### 5. 参数调整

- 双均线周期可根据市场调整
- 止损止盈百分比可在代码中修改
- 轮询间隔不建议低于 10 秒

## 🐛 故障排查

### 问题：止损止盈订单提交失败

**可能原因**：

1. OKX API 参数格式不正确
2. 持仓模式设置错误（cross/isolated）
3. 账户权限不足

**解决方法**：

- 查看日志中的详细错误信息
- 参考 [OKX API 文档](https://www.okx.com/docs-v5/zh/)
- 调整 algo 订单参数格式

### 问题：程序崩溃重启后状态丢失

**解决方法**：

- 检查 `botState.json` 文件是否存在
- 确保程序有文件写入权限
- 查看日志中的状态保存记录

### 问题：连续错误导致停止

**解决方法**：

- 检查 API key 是否有效
- 确认网络连接正常
- 查看 `errorCount` 计数
- 删除 `botState.json` 重置状态

## 📈 监控建议

### 关键指标

1. **持仓状态**: 查看 botState.json
2. **错误次数**: 监控 errorCount
3. **最近交易**: 查看 lastTradeTime
4. **账户余额**: 定期核对实际余额

### 日志监控

```bash
# 监控错误
watch -n 5 "tail -20 okxNewBot.log | grep ERROR"

# 监控交易
watch -n 5 "tail -20 okxNewBot.log | grep SUCCESS"
```

## 🔄 更新记录

### v2.0 (当前版本)

- ✅ 添加完整的日志系统
- ✅ 实现持仓查询和平仓功能
- ✅ 完善止损止盈订单提交
- ✅ 添加异常处理和状态恢复
- ✅ 优化交易逻辑和风险控制

### v1.0 (原始版本)

- 基础双均线策略
- 简单的开仓逻辑
- 无持仓管理
- 无状态恢复

## 📞 技术支持

如有问题，请：

1. 查看日志文件排查问题
2. 参考 OKX 官方文档
3. 在沙盒环境充分测试

---

**免责声明**: 本程序仅供学习和测试使用。加密货币交易存在高风险，使用本程序造成的任何损失，开发者概不负责。请谨慎使用并做好风险控制。
