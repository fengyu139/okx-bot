const { getBalance, getTicker, placeOrder, getCandles, ordersPending, cancelOrder } = require("./okxApi");
const fs = require('fs');
const dayjs = require('dayjs');
const symbol = "XRP-USDT"; // 交易对
let last_buy_price = 0;  // 记录买入价，用于止损和卖出
let buyCount = 0;
const logFile = fs.createWriteStream('tradingBot.log', { flags: 'a' });

function log(message) {
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const logMessage = `[${timestamp}] ${typeof message === 'object' ? JSON.stringify(message) : message}`;
    console.log(logMessage);
    logFile.write(logMessage + '\n');
}

async function runLeverageStrategy() {
    const orders = await ordersPending(symbol);
    const twoHoursAgo = dayjs().subtract(2, 'hour');
    for (const order of orders.data) {
        const orderTime = dayjs((Number(order.cTime)));
        if (orderTime.isBefore(twoHoursAgo)) {
            log(`⏳ 订单 ${order.ordId} 已挂单超过2小时，正在撤销...`);
            let res = await cancelOrder(symbol, order.ordId);
            if (res.code == 0) {
                log(`✅ 订单 ${order.ordId} 已撤销`);
            } else {
                log(`❌ 订单 ${order.ordId} 撤销失败`);
                log(res);
            }
        }
    }

    const ticker = await getTicker(symbol);
    if (!ticker || !ticker.data || ticker.data.length === 0) {
        log("❌ 获取市场数据失败");
        return;
    }
    const lastPrice = parseFloat(ticker.data[0].last);
    log(`📈 当前 XRP 价格: ${lastPrice} USDT`);

    const balance = await getBalance();
    if (!balance || !balance.data || balance.data.length === 0) {
        log("❌ 获取账户余额失败");
        return;
    }
    const usdtDetail = balance.data[0].details.find(b => b.ccy === "USDT");
    const xrpBalance = balance.data[0].details.find(b => b.ccy === "XRP")?.availBal;
    log(`💰 XRP 余额: ${parseInt(xrpBalance)}`);
    const usdtBalance = parseFloat(usdtDetail?.availBal || 10);
    log(`💰 USDT 余额: ${parseInt(usdtBalance)}`);

    const bars = await getCandles(symbol);
    const close_prices = bars.data.slice(0, 6).map(b => parseFloat(b[4]));
    if (close_prices.length < 6) {
        log("❌ K 线数据不足");
        return;
    }
    const latest_price = close_prices[0];
    const price_6_hours_ago = close_prices[close_prices.length - 1];

    let trade_amount = (usdtBalance * 0.3) / latest_price;
    if (buyCount == 1) {
        trade_amount = (usdtBalance * 0.5) / latest_price;
    }
    if (buyCount == 2) {
        trade_amount = (usdtBalance * 0.9) / latest_price;
    }
    log(`K线:${JSON.stringify(close_prices)}`);

    if (latest_price < price_6_hours_ago * 0.95 && usdtBalance > 10) {
        let res = await placeOrder(symbol, "buy", trade_amount, latest_price, "cross"); // 使用杠杆模式
        if (res.code == 0) {
            log(`🟢 杠杆买入 ${trade_amount}，价格: ${latest_price}`);
            last_buy_price = latest_price;
            buyCount++;
        } else {
            log(`❌ 杠杆买入失败`);
            log(res);
        }
    }

    if (last_buy_price > 0 && latest_price >= last_buy_price * 1.04 && xrpBalance > 0) {
        let res = await placeOrder(symbol, "sell", xrpBalance, latest_price, "cross"); // 使用杠杆模式
        if (res.code == 0) {
            log(`🔴 杠杆卖出 ${xrpBalance}，价格: ${latest_price}`);
            buyCount = 0;
        } else {
            log(`❌ 杠杆卖出失败`);
            log(res);
        }
    }

    if (last_buy_price > 0 && latest_price <= last_buy_price * 0.95) {
        log(`🔴 杠杆止损卖出 ${xrpBalance}，价格: ${latest_price}`);
        let res = await placeOrder(symbol, "sell", xrpBalance, latest_price, "cross"); // 使用杠杆模式
        if (res.code == 0) {
            log(`🔴 杠杆止损卖出 ${xrpBalance}，价格: ${latest_price}`);
            buyCount = 0;
        } else {
            log(`❌ 杠杆止损卖出失败`);
            log(res);
        }
    }
}

runLeverageStrategy();
setInterval(runLeverageStrategy, 60 * 60 * 1000 + 120000); 