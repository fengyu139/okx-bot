const { getBalance, getTicker, placeOrder, getCandles, ordersPending, ordersHistory, cancelOrder } = require("./okxApi");
const fs = require('fs');
const dayjs = require('dayjs');
const symbol = "XRP-USDT"; // 交易对
const tradeAmount = 0.001; // 交易数量
let last_buy_price = 0;  // 记录买入价，用于止损和卖出
let buyCount=0
const logFile = fs.createWriteStream('tradingBot.log', { flags: 'a' });

function log(message) {
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
    // 如果 message 是对象，则将其转换为字符串
    const logMessage = `[${timestamp}] ${typeof message === 'object' ? JSON.stringify(message) : message}`;
    console.log(logMessage);
    logFile.write(logMessage + '\n');
}

function getMarketInfo() {
    const market_str = "XRP_USDT"; // 假设交易对为 XRP_USDT
    let base_currency = "XRP";
    let quote_currency = "USDT";
    if (typeof market_str === "string") {
        [base_currency, quote_currency] = market_str.split("_");
    }
    
    return { base_currency, quote_currency };
}

async function runStrategy() {
    const orders = await ordersPending(symbol);
    const twoHoursAgo = dayjs().subtract(2, 'hour');
    for (const order of orders.data) {
        const orderTime = dayjs((Number(order.cTime))); // 假设订单对象中有 timestamp 字段
        if (orderTime.isBefore(twoHoursAgo)) {
            log(`⏳ 订单 ${order.ordId} 已挂单超过2小时，正在撤销...`);
           let res = await cancelOrder(symbol, order.ordId);
           if(res.code == 0){
            log(`✅ 订单 ${order.ordId} 已撤销`);
           }else{
            log(`❌ 订单 ${order.ordId} 撤销失败`);
            log(res)
           }
        }
    }
    // 获取市场价格
    const ticker = await getTicker(symbol);
    if (!ticker || !ticker.data || ticker.data.length === 0) {
        log("❌ 获取市场数据失败");
        return;
    }
    const lastPrice = parseFloat(ticker.data[0].last);
    log(`📈 当前 XRP 价格: ${lastPrice} USDT`);

    // 获取账户余额
    const balance = await getBalance();
    if (!balance || !balance.data || balance.data.length === 0) {
        log("❌ 获取账户余额失败");
        return;
    }
    const usdtDetail = balance.data[0].details.find(b => b.ccy === "USDT");
    const xrpBalance = balance.data[0].details.find(b => b.ccy === "XRP")?.availBal;
    log(`💰 XRP 余额: ${parseInt(xrpBalance)}`);
    const usdtBalance = parseFloat(usdtDetail?.availBal||10);
    log(`💰 USDT 余额: ${parseInt(usdtBalance)}`);

    // 获取最近 6 根 1 小时 K 线的收盘价
    const bars = await getCandles(symbol);
    const close_prices = bars.data.slice(0,6).map(b => parseFloat(b[4]));
    if (close_prices.length < 6) {
        log("❌ K 线数据不足");
        return;
    }
    const latest_price =  close_prices[0];
    const price_6_hours_ago =close_prices[close_prices.length - 1];
    // 动态获取交易对信息
    const { base_currency, quote_currency } = getMarketInfo();
    // 计算买入数量（30% 资金）
    let trade_amount = (usdtBalance * 0.3) / latest_price;
    if(buyCount==1){
        trade_amount=(usdtBalance * 0.5) / latest_price
    }
    if(buyCount==2){
        trade_amount=(usdtBalance * 0.9) / latest_price
    }
    log(`K线:${JSON.stringify(close_prices)}`)
    // 趋势判断：过去 6 小时价格是否跌幅超过 5%
    if (latest_price < price_6_hours_ago * 0.94 && usdtBalance > 10) {
        
       let res = await placeOrder(symbol, "buy", trade_amount, latest_price);
       if(res.code == 0){
        log(`🟢 买入 ${base_currency}: ${trade_amount}，价格: ${latest_price} ${quote_currency}`);
        last_buy_price = latest_price;
        buyCount++
       }else{
        log(`❌ 买入失败`);
        log(res)
       }
    }

    // 卖出操作：如果买入后价格涨了超过 4%，则卖出
    if (last_buy_price > 0 && latest_price >= last_buy_price * 1.04&&xrpBalance>0) {
        let res = await placeOrder(symbol, "sell", xrpBalance, latest_price);
        if(res.code == 0){
            log(`🔴 卖出 ${base_currency}: ${xrpBalance}，价格: ${latest_price} ${quote_currency}`);
            buyCount=0
        }else{
            log(`❌ 卖出失败`);
            log(res)
        }
    }

    // 止损机制：如果价格下跌超过 5%，卖出
    if (last_buy_price > 0 && latest_price <= last_buy_price * 0.94) {
        log(`🔴 止损卖出 ${base_currency}: ${xrpBalance}，价格: ${latest_price} ${quote_currency}`);
        let res = await placeOrder(symbol, "sell", xrpBalance, latest_price);
        if(res.code == 0){
            log(`🔴 止损卖出 ${base_currency}: ${xrpBalance}，价格: ${latest_price} ${quote_currency}`);
            buyCount=0
        }else{
            log(`❌ 止损卖出失败`);
            log(res)
        }
    }
}

// function scheduleRunStrategy() {
//     const now = new Date();
//     const minutes = now.getMinutes();
//     const seconds = now.getSeconds();
//     const milliseconds = now.getMilliseconds();

//     // 计算距离下一个整点30分钟的时间
//     const delay = ((30 - minutes % 60) * 60 * 1000) - (seconds * 1000) - milliseconds;

//     setTimeout(() => {
//         runStrategy();
//         // 每小时的30分钟运行一次策略
//         setInterval(runStrategy, 60 * 60 * 1000);
//     }, delay);
// }

// scheduleRunStrategy();
setInterval(runStrategy, 60 * 60 * 1000+(Math.floor(Math.random() * 6) + 1)*60*1000);
