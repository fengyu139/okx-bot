require("dotenv").config();
const axios = require("axios");
const fs = require('fs');
const dayjs = require('dayjs');
const crypto = require("crypto");
const { ordersPending,ordersHistory } = require("./okxApi");
// ✅ OKX API 配置
const API_KEY = process.env.OKX_API_KEY;
const API_SECRET = process.env.OKX_SECRET_KEY;
const API_PASSPHRASE = process.env.OKX_PASSPHRASE;
const BASE_URL = process.env.OKX_BASE_URL;
//'BTC', 'ETH', 'LINK', 'XRP',
const instArr = ['IP']; // 支持的币种数组

// 动态初始化交易状态
let tradingState = {};
instArr.forEach(instId => {
    tradingState[instId] = { last_order_price: 0, position_side: "", position_size: 0 };
});

const logFile = fs.createWriteStream('okxLeverageBot.log', { flags: 'a' });

function log(message) {
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
    // 如果 message 是对象，则将其转换为字符串
    const logMessage = `[${timestamp}] ${typeof message === 'object' ? JSON.stringify(message) : message}`;
    console.log(logMessage);
    logFile.write(logMessage + '\n');
}
// ✅ 生成 OKX API 签名
function signRequest(method, path, body = "") {
    const timestamp = new Date().toISOString();
    const prehash = timestamp + method + path + body;
    const signature = crypto.createHmac("sha256", API_SECRET).update(prehash).digest("base64");
    return { timestamp, signature };
}

// ✅ 获取 OKX 账户余额
async function getAccountBalance() {
    const path = `/api/v5/account/balance?ccy=${instArr.join(",")},USDT`;
    const { timestamp, signature } = signRequest("GET", path);
    const headers = {
        "OK-ACCESS-KEY": API_KEY,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": API_PASSPHRASE,
    };

    try {
        const response = await axios.get(`${BASE_URL}${path}`, { headers });
        return response.data.data[0]; // 返回账户数据
    } catch (error) {
        console.error("❌ 获取账户余额失败:", error.response.data);
    }
}

// ✅ 获取币种价格
async function getPrice(instId) {
    const url = `${BASE_URL}/api/v5/market/ticker?instId=${instId}-USDT`;
    const response = await axios.get(url);
    return parseFloat(response.data.data[0].last);
}

// ✅ 获取历史 K 线数据
async function getKlines(instId) {
    const url = `${BASE_URL}/api/v5/market/candles?instId=${instId}-USDT&bar=1H&limit=6`;
    const response = await axios.get(url);
    return response.data.data.map(k => parseFloat(k[4])); // 取收盘价
}

// ✅ 执行杠杆交易（开多/开空）
async function placeOrder(instId, side, size) {
    const path = "/api/v5/trade/order";
    const body = JSON.stringify({
        instId: `${instId}-USDT`,
        tdMode: "cross",
        side: side,
        ordType: "market",
        sz: size.toString(),
        lever: "10",
        ccy: "USDT"
    });

    const { timestamp, signature } = signRequest("POST", path, body);
    const headers = {
        "OK-ACCESS-KEY": API_KEY,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": API_PASSPHRASE,
        "Content-Type": "application/json",
    };

    try {
        const response = await axios.post(`${BASE_URL}${path}`, body, { headers });
        log(`✅ ${side === "buy" ? "开多" : "开空"} ${size} ${instId}，价格: 最新市价`);
        tradingState[instId].last_order_price = await getPrice(instId); // 记录开仓价格
        tradingState[instId].position_side = side === "buy" ? "long" : "short"; // 记录持仓方向
        return response.data;
    } catch (error) {
        console.error("❌ 交易失败:", error.response);
        return error.response.data;
    }
}

// ✅ 平仓（盈利 40% 退出）
async function closePosition(instId, size) {
    const path = "/api/v5/trade/order";
    const close_side = tradingState[instId].position_side === "long" ? "sell" : "buy";
    const body = JSON.stringify({
        instId: `${instId}-USDT`,
        tdMode: "cross",
        side: close_side,
        ordType: "market",
        sz: size.toString(),
        ccy: "USDT"
    });

    const { timestamp, signature } = signRequest("POST", path, body);
    const headers = {
        "OK-ACCESS-KEY": API_KEY,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": API_PASSPHRASE,
        "Content-Type": "application/json",
    };

    try {
        let res = await axios.post(`${BASE_URL}${path}`, body, { headers });
        if (res.data.code == 0) {
            tradingState[instId].position_side = ""; // 清空持仓方向
            return res.data;
        } else {
            console.error("❌ 平仓失败:", res.data);
            return res.data;
        }
    } catch (error) {
        console.error("❌ 平仓失败:", error.response.data);
        return error.response.data;
    }
}

// ✅ 交易策略
async function strategy(instId) {
    const prices = await getKlines(instId);
    if (prices.length < 6) return;

    const latest_price = prices[0];
    const price_6_hours_ago = prices[prices.length - 1];
    log(`最新价格(${instId}):${latest_price}`);
    log(`6小时前价格(${instId}):${price_6_hours_ago}`);
    const balance = await getAccountBalance();
    const quote_balance = parseFloat(balance.details.find(b => b.ccy === "USDT")?.availBal);
    const base_balance = parseFloat(balance.details.find(b => b.ccy === instId)?.availBal);
    log(`USDT余额:${quote_balance}`);
    let orders = await ordersPending(`${instId}-USDT`);
    let history = await ordersHistory("SPOT", `${instId}-USDT`);
    let trade_amount = (quote_balance * 0.3) / latest_price * 10;

    // ✅ 开多（价格跌 6%）
    if (latest_price < price_6_hours_ago * 0.94 && quote_balance > 10) {
        let res = await placeOrder(instId, "buy", trade_amount);
        if (res.data.code == 0) {
            log(`开多:${JSON.stringify(res)}`);
            tradingState[instId].position_size += trade_amount;
        } else {
            console.error("❌ 开多失败:", res.data);
        }
    }
    // ✅ 开空（价格涨 5%）
    if (latest_price > price_6_hours_ago * 1.04 && quote_balance > 10) {
        let res = await placeOrder(instId, "sell", trade_amount);
        if (res.data.code == 0) {
            log(`开空:${JSON.stringify(res)}`);
            tradingState[instId].position_size += trade_amount;
        } else {
            console.error("❌ 开空失败:", res.data);
        }
    }
    // ✅ 盈利 40% 平仓
    if (tradingState[instId].position_side === "long" && latest_price >= tradingState[instId].last_order_price * 1.04 && base_balance > 0) {
        await closePosition(instId, tradingState[instId].position_size);
        tradingState[instId].position_size = 0;
    }
    if (tradingState[instId].position_side === "short" && latest_price <= tradingState[instId].last_order_price * 0.96 && base_balance > 0) {
        await closePosition(instId, tradingState[instId].position_size);
        tradingState[instId].position_size = 0;
    }
}

// ✅ 主循环
async function main() {
    while (true) {
        for (const instId of instArr) {
            await strategy(instId);
        }
        await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
    }
}

main();
