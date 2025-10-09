# 修复说明：Parameter posSide error (51000)

## 🐛 问题描述

下单时出现错误：

```
"sCode": "51000",
"sMsg": "Parameter posSide error"
```

## 🔍 根本原因

**OKX 交易所有两种持仓模式：**

### 1️⃣ 单向持仓模式（net_mode）- 默认模式

- **特点**: 一个合约只能持有一个方向的仓位
- **开仓**: 使用 `side: "buy"` 或 `side: "sell"`
- **平仓**: 使用相反方向的 `side`
- ❌ **不支持** `posSide` 参数
- 例如：买入开多，卖出平多

### 2️⃣ 双向持仓模式（long_short_mode）

- **特点**: 可以同时持有多头和空头仓位
- **开仓**: 使用 `side + posSide`，如 `side: "buy", posSide: "long"`
- **平仓**: 使用 `side + posSide`，如 `side: "sell", posSide: "long"`
- ✅ **必须传** `posSide` 参数
- 例如：可以同时持有 BTC 的多头和空头

## ⚠️ 原代码问题

```javascript
// ❌ 错误：总是传 posSide 参数
const order = {
  instId: SYMBOL,
  tdMode: tdMode,
  side: side,
  posSide: posSide, // 单向持仓模式下会报错！
  ordType: "market",
  sz: sizeContracts.toString(),
};
```

**如果你的账户是单向持仓模式（大多数人默认是这个），传 `posSide` 就会报 51000 错误！**

## ✅ 修复方案

### 核心改进：自动检测并适配持仓模式

1. **启动时检测账户持仓模式**

```javascript
async function getAccountConfig() {
  const path = "/api/v5/account/config";
  return await okxRequest("GET", path, "");
}

let posMode = "net_mode"; // 默认单向持仓
```

2. **根据模式动态构建订单**

```javascript
// ✅ 修复后：根据持仓模式决定是否传 posSide
const order = {
  instId: SYMBOL,
  tdMode: tdMode,
  side: side,
  ordType: "market",
  sz: sizeContracts.toString(),
};

// 只有双向持仓模式才添加 posSide
if (posMode === "long_short_mode") {
  order.posSide = signal;
}
```

3. **适配所有订单类型**

- ✅ 开仓订单
- ✅ 平仓订单
- ✅ 止损订单
- ✅ 止盈订单

## 📋 修改内容

### 新增函数

```javascript
// 查询账户配置
async function getAccountConfig() {
  const path = "/api/v5/account/config";
  return await okxRequest("GET", path, "");
}
```

### 修改的函数

1. **平仓函数** - 根据持仓模式决定平仓方向
2. **开仓逻辑** - 根据持仓模式决定是否传 posSide
3. **止损止盈订单** - 根据持仓模式决定是否传 posSide
4. **启动函数** - 添加持仓模式检测

## 🚀 使用方法

### 重启机器人即可

```bash
node okxNewBot.js
```

### 启动日志

你会看到：

```
[INFO] 正在检测账户配置...
[INFO] 账户持仓模式检测成功
{
  "posMode": "net_mode",
  "description": "单向持仓（买卖平仓）"
}
```

### 下单日志

```
[INFO] 使用单向持仓模式（不传posSide参数）
{ "posMode": "net_mode" }

[INFO] 下市价单
{
  "instId": "BTC-USDT-SWAP",
  "tdMode": "cross",
  "side": "sell",
  "ordType": "market",
  "sz": "1"
  // 注意：没有 posSide 字段
}
```

## 🔄 两种模式对比

### 单向持仓模式（net_mode）

**开多仓**：

```javascript
{
  side: "buy",
  // 无 posSide
}
```

**平多仓**：

```javascript
{
  side: "sell",
  // 无 posSide
}
```

### 双向持仓模式（long_short_mode）

**开多仓**：

```javascript
{
  side: "buy",
  posSide: "long"
}
```

**开空仓**：

```javascript
{
  side: "sell",
  posSide: "short"
}
```

**平多仓**：

```javascript
{
  side: "sell",
  posSide: "long"
}
```

**平空仓**：

```javascript
{
  side: "buy",
  posSide: "short"
}
```

## 🎯 如何切换持仓模式

### 在 OKX 网站上切换：

1. 登录 OKX 账户
2. 进入 **交易设置**
3. 找到 **持仓模式** 设置
4. 选择 **单向持仓** 或 **双向持仓**

### ⚠️ 注意事项

- 切换持仓模式需要先平掉所有仓位
- 大多数用户使用单向持仓就足够了
- 双向持仓适合同时做多空对冲的策略

## ✅ 验证修复

### 测试步骤：

1. 重启机器人
2. 查看日志确认检测到正确的持仓模式
3. 等待交易信号
4. 观察订单是否成功提交
5. 检查日志中的订单参数是否正确

### 成功标志：

```
[INFO] 下市价单
{
  "instId": "BTC-USDT-SWAP",
  "tdMode": "cross",
  "side": "sell",
  "ordType": "market",
  "sz": "1"
}

[SUCCESS] 开仓成功
{
  "ordId": "123456789",
  "signal": "short",
  "size": 1
}
```

## 📚 相关资源

- [OKX API 文档 - 持仓模式](https://www.okx.com/docs-v5/zh/#order-book-trading-trade-post-place-order)
- [OKX 账户配置 API](https://www.okx.com/docs-v5/zh/#trading-account-rest-api-get-account-configuration)

## 🙋 常见问题

### Q: 我能否手动设置持仓模式？

A: 不建议手动设置。机器人会自动检测你的账户模式。如果检测失败，默认使用单向持仓模式。

### Q: 我想使用双向持仓怎么办？

A: 在 OKX 网站上切换持仓模式，重启机器人即可自动识别。

### Q: 为什么推荐单向持仓？

A:

- ✅ 更简单，不容易出错
- ✅ 大多数策略用单向就够了
- ✅ 资金利用率更高（不会占用两边保证金）

### Q: 修复后还是报错怎么办？

A:

1. 查看日志确认持仓模式检测是否正确
2. 登录 OKX 网站确认账户设置
3. 确保没有其他持仓冲突
4. 检查 API 权限是否完整

---

**修复完成！现在机器人可以自动适配你的账户持仓模式了！** 🎉
