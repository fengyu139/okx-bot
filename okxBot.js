const { getBalance, getTicker, placeOrder, getCandles, ordersPending, ordersHistory, cancelOrder } = require("./okxApi");
const fs = require('fs');
const dayjs = require('dayjs');

// 支持多个交易对
//'SUI','XRP','ADA','BNB', 'ETH','DOGE','TRX',
const tradingPairs = ['SUI','XRP','ADA','BNB', 'ETH','DOGE','TRX'];
const tradeAmount = 0.001; // 基础交易数量

// 为每个交易对维护独立的状态
const tradingState = {};
tradingPairs.forEach(coin => {
    tradingState[coin] = {
        symbol: `${coin}-USDT`,
        last_buy_price: 0,
        buyCount: 0
    };
});

const logFile = fs.createWriteStream('tradingBot.log', { flags: 'a' });

function log(message) {
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
    // 如果 message 是对象，则将其转换为字符串
    const logMessage = `[${timestamp}] ${typeof message === 'object' ? JSON.stringify(message) : message}`;
    console.log(logMessage);
    logFile.write(logMessage + '\n');
}

function getMarketInfo(symbol) {
    const [base_currency, quote_currency] = symbol.split("-");
    return { base_currency, quote_currency };
}

async function runStrategyForPair(coin, usdtBalance) {
    const state = tradingState[coin];
    const symbol = state.symbol;
    
    // 检查并取消长时间未成交的订单
    const orders = await ordersPending(symbol);
    const twoHoursAgo = dayjs().subtract(2, 'hour');
    for (const order of orders.data) {
        const orderTime = dayjs((Number(order.cTime)));
        if (orderTime.isBefore(twoHoursAgo)) {
            log(`⏳ ${symbol} 订单 ${order.ordId} 已挂单超过2小时，正在撤销...`);
           let res = await cancelOrder(symbol, order.ordId);
           if(res.code == 0){
            log(`✅ ${symbol} 订单 ${order.ordId} 已撤销`);
           }else{
            log(`❌ ${symbol} 订单 ${order.ordId} 撤销失败`);
            log(res)
           }
        }
    }
    
    // 获取市场价格
    const ticker = await getTicker(symbol);
    if (!ticker || !ticker.data || ticker.data.length === 0) {
        log(`❌ 获取 ${symbol} 市场数据失败`);
        return;
    }
    const lastPrice = parseFloat(ticker.data[0].last);
    log(`📈 当前 ${coin} 价格: ${lastPrice} USDT`);

    // 获取账户余额
    const balance = await getBalance();
    if (!balance || !balance.data || balance.data.length === 0) {
        log(`❌ 获取账户余额失败`);
        return;
    }
    
    const coinBalance = balance.data[0].details.find(b => b.ccy === coin)?.availBal || 0;
    log(`💰 ${coin} 余额: ${parseFloat(coinBalance).toFixed(4)}`);

    // 获取最近 6 根 1 小时 K 线的收盘价
    const bars = await getCandles(symbol);
    const close_prices = bars.data.slice(0,6).map(b => parseFloat(b[4]));
    if (close_prices.length < 6) {
        log(`❌ ${symbol} K 线数据不足`);
        return;
    }
    const latest_price = close_prices[0];
    const price_6_hours_ago = close_prices[close_prices.length - 1];
    
    // 动态获取交易对信息
    const { base_currency, quote_currency } = getMarketInfo(symbol);
    
    // 计算买入数量（根据买入次数调整资金比例）
    let trade_amount;
    if(state.buyCount == 0) {
        trade_amount = (usdtBalance * 0.3) / latest_price;
    } else if(state.buyCount == 1) {
        trade_amount = (usdtBalance * 0.5) / latest_price;
    } else if(state.buyCount == 2) {
        trade_amount = (usdtBalance * 0.9) / latest_price;
    }
    
    log(`${symbol} K线: ${JSON.stringify(close_prices)}`);
    
    // 趋势判断：过去 6 小时价格是否跌幅超过 5%
    if (latest_price < price_6_hours_ago * 0.94 && usdtBalance > 10) {
        let res = await placeOrder(symbol, "buy", trade_amount, latest_price);
        if(res.code == 0) {
            log(`🟢 买入 ${base_currency}: ${trade_amount}，价格: ${latest_price} ${quote_currency}`);
            state.last_buy_price = latest_price;
            state.buyCount++;
        } else {
            log(`❌ ${symbol} 买入失败`);
            log(res);
        }
    }

    // 卖出操作：如果买入后价格涨了超过 4%，则卖出
    if (state.last_buy_price > 0 && latest_price >= state.last_buy_price * 1.04 && coinBalance > 0) {
        let res = await placeOrder(symbol, "sell", coinBalance, latest_price);
        if(res.code == 0) {
            log(`🔴 卖出 ${base_currency}: ${coinBalance}，价格: ${latest_price} ${quote_currency}`);
            state.buyCount = 0;
        } else {
            log(`❌ ${symbol} 卖出失败`);
            log(res);
        }
    }

    // 止损机制：如果价格下跌超过 5%，卖出
    if (state.last_buy_price > 0 && latest_price <= state.last_buy_price * 0.94 && coinBalance > 0) {
        let res = await placeOrder(symbol, "sell", coinBalance, latest_price);
        if(res.code == 0) {
            log(`🔴 止损卖出 ${base_currency}: ${coinBalance}，价格: ${latest_price} ${quote_currency}`);
            state.buyCount = 0;
        } else {
            log(`❌ ${symbol} 止损卖出失败`);
            log(res);
        }
    }
}

async function runStrategy() {
    try {
        // 获取USDT余额
        const balance = await getBalance();
        if (!balance || !balance.data || balance.data.length === 0) {
            log("❌ 获取账户余额失败");
            return;
        }
        const usdtDetail = balance.data[0].details.find(b => b.ccy === "USDT");
        const usdtBalance = parseFloat(usdtDetail?.availBal || 10);
        log(`💰 USDT 总余额: ${parseInt(usdtBalance)}`);
        
        // 为每个交易对分配可用USDT余额
        const availableUsdtPerPair = usdtBalance / tradingPairs.length;
        
        // 为每个交易对执行策略
        for (const coin of tradingPairs) {
            log(`🔄 开始处理 ${coin}-USDT 交易对`);
            await runStrategyForPair(coin, availableUsdtPerPair);
            // 添加短暂延迟，避免API请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        log(`❌ 策略执行出错: ${error.message}`);
        console.error(error);
    }
}

runStrategy();
// 添加随机延迟，避免每小时同一时间执行
setInterval(runStrategy, 60 * 60 * 1000 + (Math.floor(Math.random() * 6) + 1) * 60 * 1000);
