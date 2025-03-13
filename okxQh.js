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

let last_order_price = 0; // 记录上一次开仓价格
let position_side = ""; // 记录当前持仓方向（"long" 或 "short"）
let position_size = 0; // 记录当前持仓数量
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
    const path = "/api/v5/account/balance";
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

// ✅ 获取 XRP 价格
async function getXRPPrice() {
    const url = `${BASE_URL}/api/v5/market/ticker?instId=XRP-USDT`;
    const response = await axios.get(url);
    return parseFloat(response.data.data[0].last);
}

// ✅ 获取历史 K 线数据
async function getKlines() {
    const url = `${BASE_URL}/api/v5/market/candles?instId=XRP-USDT&bar=1H&limit=6`;
    const response = await axios.get(url);
    return response.data.data.map(k => parseFloat(k[4])); // 取收盘价
}

// ✅ 执行杠杆交易（开多/开空）
async function placeOrder(side, size) {
    const path = "/api/v5/trade/order";
    const body = JSON.stringify({
        instId: "XRP-USDT",
        tdMode: "cross", // 10 倍杠杆
        side: side, // "buy" = 开多, "sell" = 开空
        ordType: "market",
        sz: size.toString(), // 下单数量
        lever: "10", // 10x 杠杆
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
        log(`✅ ${side === "buy" ? "开多" : "开空"} ${size} XRP，价格: 最新市价`);
        last_order_price = await getXRPPrice(); // 记录开仓价格
        position_side = side === "buy" ? "long" : "short"; // 记录持仓方向
        return response.data
    } catch (error) {
        console.error("❌ 交易失败:", error.response);
        return error.response.data
    }
}

// ✅ 平仓（盈利 40% 退出）
async function closePosition(size) {
    const path = "/api/v5/trade/order";
    const close_side = position_side === "long" ? "sell" : "buy"; // 多头用 "sell" 平仓, 空头用 "buy" 平仓
    const body = JSON.stringify({
        instId: "XRP-USDT",
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
       if(res.data.code == 0){
        log(`✅ 平仓 ${size} USDT 40%`);
        position_side = ""; // 清空持仓方向
        return res.data
       }else{
        console.error("❌ 平仓失败:", res.data);
        return res.data
       }
    } catch (error) {
        console.error("❌ 平仓失败:", error.response.data);
        return error.response.data
    }
}

// ✅ 交易策略
async function strategy() {
    const prices = await getKlines();
    if (prices.length < 6) return; // 确保有足够数据

    const latest_price =prices[0] // 最新价格
    const price_6_hours_ago =  prices[prices.length - 1]; // 6 小时前价格
    log(`最新价格:${latest_price}`)
    log(`6小时前价格:${price_6_hours_ago}`)
    const balance = await getAccountBalance();
    const quote_balance = parseFloat(balance.details.find(b => b.ccy === "USDT").availBal);
    const base_balance = parseFloat(balance.details.find(b => b.ccy === "XRP").availBal);
    log(`USDT余额:${quote_balance}`)
    let orders = await ordersPending("XRP-USDT");
    // log(`挂单:${JSON.stringify(orders)}`)
    let history = await ordersHistory("SPOT","XRP-USDT");
    // log(`历史:${JSON.stringify(history.data[0])}`)
    let trade_amount = (quote_balance * 0.3) / latest_price*10;

    // ✅ 开多（价格跌 6%）
    if (latest_price < price_6_hours_ago * 0.94 && quote_balance > 10) {
        let res = await placeOrder("buy", trade_amount);
        if(res.data.code == 0){
            log(`开多:${JSON.stringify(res)}`)
            position_size = position_size+trade_amount;
        }else{
            console.error("❌ 开多失败:", res.data);
        }
    }
    // ✅ 开空（价格涨 5%）
    if (latest_price > price_6_hours_ago * 1.04 && quote_balance > 10) {
       let res = await placeOrder("sell", trade_amount);
       if(res.data.code == 0){
        log(`开空:${JSON.stringify(res)}`)
        position_size = position_size+trade_amount;
       }else{
        console.error("❌ 开空失败:", res.data);
       }
    }
    // ✅ 盈利 40% 平仓
    if (position_side === "long" && latest_price >= last_order_price * 1.04 && base_balance > 0) {
        await closePosition(position_size);
        position_size = 0;
    }
    if (position_side === "short" && latest_price <= last_order_price * 0.96 && base_balance > 0) {
        await closePosition(position_size);
        position_size = 0;
    }
}

// ✅ 主循环
async function main() {
    while (true) {
        await strategy();
        await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000)); // 每小时执行一次
    }
}

main();
