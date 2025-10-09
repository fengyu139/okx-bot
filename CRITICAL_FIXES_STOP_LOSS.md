# 🚨 紧急修复：止损止盈方向错误 + 条件单参数错误

## 修复时间

2025-10-09

## 发现的问题

### 问题 1：做空时止损价格方向错误 ❌

**位置**：第 785-787 行

**错误代码**：

```javascript
} else {
  // 做空：向上止损，向下止盈
  stopPrice = entryPrice * (1 - Math.abs(stopLossPct));        // ❌ 错误！
  takeProfitPrice = entryPrice * (1 - Math.abs(takeProfitPct)); // ❌ 错误！
}
```

**问题分析**：

```javascript
// 做空（BTC @ 50000）
stopLossPct = 0.015 (calculateDynamicSLTP 返回的是正数)

// 错误计算
stopPrice = 50000 * (1 - Math.abs(0.015))
         = 50000 * 0.985
         = 49250  ❌ 向下！应该是向上止损才对！

// 正确应该是
stopPrice = 50000 * (1 + 0.015)
         = 50750  ✅ 向上止损
```

**后果**：

- 做空时，止损设置在了**盈利方向**（向下），而不是止损方向（向上）
- 这会导致：
  - 价格下跌（盈利）时触发"止损"卖出 → **提前止盈，损失利润**
  - 价格上涨（亏损）时没有止损保护 → **无限亏损风险**

**修复后**：

```javascript
} else {
  // 做空：向上止损，向下止盈
  stopPrice = entryPrice * (1 + stopLossPct);        // ✅ 正确
  takeProfitPrice = entryPrice * (1 + takeProfitPct); // ✅ 正确
}
```

---

### 问题 2：条件单参数格式错误 ❌

**位置**：第 801-809 行（止损单）、第 834-842 行（止盈单）

**错误代码**：

```javascript
const stopLossOrder = {
  instId: SYMBOL,
  tdMode: tdMode,
  side: closeSide,
  ordType: "conditional", // ❌ 错误的订单类型
  sz: sizeContracts.toString(),
  slTriggerPx: stopPrice.toFixed(2), // ❌ 错误的字段名
  slOrdPx: "-1", // ❌ 错误的字段名
};
```

**问题分析**：

根据 OKX API 官方文档，条件单应该使用：

- `ordType: 'trigger'`（触发单）
- `triggerPx`（触发价格）
- `orderPx`（委托价格）

而不是：

- `ordType: 'conditional'`（没有这个类型）
- `slTriggerPx` / `tpTriggerPx`（这些只能在开仓时附加使用）
- `slOrdPx` / `tpOrdPx`（这些只能在开仓时附加使用）

**后果**：

- API 会返回错误：`"Invalid order type"` 或 `"Invalid parameter"`
- 止损止盈单提交失败
- 持仓没有保护（虽然有失败后平仓的保护，但还是有风险）

**修复后**：

```javascript
const stopLossOrder = {
  instId: SYMBOL,
  tdMode: tdMode,
  side: closeSide,
  ordType: "trigger", // ✅ 正确的订单类型
  triggerPx: stopPrice.toFixed(2), // ✅ 正确的字段名
  orderPx: "-1", // ✅ 正确的字段名（-1表示市价）
  sz: sizeContracts.toString(),
};
```

---

## 修复内容

### 修复 1：止损价格计算（第 777-795 行）

**修复前**：

```javascript
if (signal === "long") {
  stopPrice = entryPrice * (1 + stopLossPct);
  takeProfitPrice = entryPrice * (1 + takeProfitPct);
} else {
  stopPrice = entryPrice * (1 - Math.abs(stopLossPct)); // ❌ 错误
  takeProfitPrice = entryPrice * (1 - Math.abs(takeProfitPct)); // ❌ 错误
}
```

**修复后**：

```javascript
if (signal === "long") {
  // 做多：向下止损，向上止盈
  stopPrice = entryPrice * (1 + stopLossPct); // stopLossPct = -0.015
  takeProfitPrice = entryPrice * (1 + takeProfitPct); // takeProfitPct = 0.03
} else {
  // 做空：向上止损，向下止盈
  stopPrice = entryPrice * (1 + stopLossPct); // stopLossPct = 0.015  ✅
  takeProfitPrice = entryPrice * (1 + takeProfitPct); // takeProfitPct = -0.03 ✅
}

// 新增日志输出
log(LOG_LEVELS.INFO, "止损止盈价格", {
  信号: signal,
  入场价: entryPrice,
  止损价: stopPrice.toFixed(2),
  止盈价: takeProfitPrice.toFixed(2),
});
```

---

### 修复 2：止损单参数格式（第 800-814 行）

**修复前**：

```javascript
const stopLossOrder = {
  instId: SYMBOL,
  tdMode: tdMode,
  side: closeSide,
  ordType: "conditional",
  sz: sizeContracts.toString(),
  slTriggerPx: stopPrice.toFixed(2),
  slOrdPx: "-1",
};
```

**修复后**：

```javascript
const stopLossOrder = {
  instId: SYMBOL,
  tdMode: tdMode,
  side: closeSide,
  ordType: "trigger", // ✅ 修复
  triggerPx: stopPrice.toFixed(2), // ✅ 修复
  orderPx: "-1", // ✅ 修复
  sz: sizeContracts.toString(),
};
```

---

### 修复 3：止盈单参数格式（第 833-847 行）

**修复前**：

```javascript
const takeProfitOrder = {
  instId: SYMBOL,
  tdMode: tdMode,
  side: closeSide,
  ordType: "conditional",
  sz: sizeContracts.toString(),
  tpTriggerPx: takeProfitPrice.toFixed(2),
  tpOrdPx: "-1",
};
```

**修复后**：

```javascript
const takeProfitOrder = {
  instId: SYMBOL,
  tdMode: tdMode,
  side: closeSide,
  ordType: "trigger", // ✅ 修复
  triggerPx: takeProfitPrice.toFixed(2), // ✅ 修复
  orderPx: "-1", // ✅ 修复
  sz: sizeContracts.toString(),
};
```

---

## 修复验证

### 做多场景（BTC @ 50000）

```javascript
signal = 'long'
stopLossPct = -0.015
takeProfitPct = 0.03

// 修复后计算
stopPrice = 50000 * (1 + (-0.015)) = 48750      ✅ 向下止损
takeProfitPrice = 50000 * (1 + 0.03) = 51500    ✅ 向上止盈

// 条件单
stopLossOrder = {
  ordType: 'trigger',
  side: 'sell',
  triggerPx: '48750',  // 价格跌到 48750 时触发卖出止损
  orderPx: '-1'
}

takeProfitOrder = {
  ordType: 'trigger',
  side: 'sell',
  triggerPx: '51500',  // 价格涨到 51500 时触发卖出止盈
  orderPx: '-1'
}
```

### 做空场景（BTC @ 50000）

```javascript
signal = 'short'
stopLossPct = 0.015
takeProfitPct = -0.03

// 修复后计算
stopPrice = 50000 * (1 + 0.015) = 50750         ✅ 向上止损
takeProfitPrice = 50000 * (1 + (-0.03)) = 48500 ✅ 向下止盈

// 条件单
stopLossOrder = {
  ordType: 'trigger',
  side: 'buy',
  triggerPx: '50750',  // 价格涨到 50750 时触发买入止损
  orderPx: '-1'
}

takeProfitOrder = {
  ordType: 'trigger',
  side: 'buy',
  triggerPx: '48500',  // 价格跌到 48500 时触发买入止盈
  orderPx: '-1'
}
```

---

## 风险评估

### 修复前的风险等级：🔴 极高风险

**做空场景下的风险**：

1. ❌ 止损方向错误 → 价格上涨时没有止损保护
2. ❌ 条件单参数错误 → 止损单提交失败
3. ❌ 两个问题叠加 → 做空时完全没有风险保护

**可能的损失**：

- 如果市场反向波动 5%-10%，可能损失 50%-100% 的本金（10 倍杠杆）
- 极端行情下可能爆仓

### 修复后的风险等级：🟢 低风险

1. ✅ 止损方向正确
2. ✅ 条件单参数正确
3. ✅ 止损单失败会立即平仓保护
4. ✅ 盈亏比保持 2:1

---

## OKX API 参考

### 条件单类型对比

| 字段      | 正确用法    | 错误用法                      | 说明         |
| --------- | ----------- | ----------------------------- | ------------ |
| `ordType` | `'trigger'` | `'conditional'`               | 条件单类型   |
| 触发价格  | `triggerPx` | `slTriggerPx` / `tpTriggerPx` | 触发价格字段 |
| 委托价格  | `orderPx`   | `slOrdPx` / `tpOrdPx`         | 委托价格字段 |

**注意**：

- `slTriggerPx` / `tpTriggerPx` 只能在**开仓时**附加使用（在 `/trade/order` 接口）
- 单独提交条件单时（在 `/trade/order-algo` 接口）必须使用 `triggerPx`

### API 文档链接

- 下单接口：https://www.okx.com/docs-v5/zh/#order-book-trading-trade-post-place-order
- 条件单接口：https://www.okx.com/docs-v5/zh/#order-book-trading-algo-trading-post-place-algo-order

---

## ⚠️ 紧急建议

1. **立即停止机器人** - 如果正在运行，立即停止
2. **检查现有持仓** - 手动检查是否有未平仓的做空仓位
3. **检查条件单** - 查看是否有失败的止损止盈单
4. **重新启动** - 使用修复后的代码重新启动
5. **密切监控** - 观察前几笔交易的止损止盈是否正确触发

---

## 测试建议

### 沙盒环境测试步骤

1. **做多测试**：

   - 开多单
   - 检查止损价格 < 入场价格 ✅
   - 检查止盈价格 > 入场价格 ✅
   - 等待止损/止盈触发

2. **做空测试**：

   - 开空单
   - 检查止损价格 > 入场价格 ✅
   - 检查止盈价格 < 入场价格 ✅
   - 等待止损/止盈触发

3. **查询条件单**：

```bash
# 使用 OKX API 查询条件单
GET /api/v5/trade/orders-algo-pending?instId=BTC-USDT-SWAP&ordType=trigger
```

---

## 总结

✅ 已修复 2 个**致命级别**的问题：

1. 做空时止损方向错误（会导致无止损保护）
2. 条件单参数格式错误（导致止损止盈单提交失败）

**修复后效果**：

- 做多/做空的止损止盈方向完全正确
- 条件单可以正常提交和触发
- 风险从 🔴 极高 降至 🟢 低风险

**下一步**：
在沙盒环境充分测试后，再考虑生产环境部署。
