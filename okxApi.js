const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;
const BASE_URL = process.env.OKX_BASE_URL;

/**
 * 生成 OKX API 签名
 */
function createSignature(timestamp, method, requestPath, body = "") {
    const message = timestamp + method + requestPath + body;
    return crypto.createHmac("sha256", SECRET_KEY).update(message).digest("base64");
}

/**
 * 发送 API 请求
 */
async function okxRequest(method, path, body = {}) {
    const timestamp = new Date().toISOString();
    const requestPath = `/api/v5${path}`;
    const signature = createSignature(timestamp, method, requestPath, JSON.stringify(body));

    const headers = {
        "OK-ACCESS-KEY": API_KEY,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": PASSPHRASE,
        "Content-Type": "application/json",
    };

    try {
        const response = await axios({
            method,
            url: `${BASE_URL}${requestPath}`,
            headers,
            data: body,
        });
        return response.data;
    } catch (error) {
        console.error("❌ API 错误:", error.response ? error.response.data : error.message);
        return null;
    }
}

// 获取账户余额
async function getBalance() {
    return await okxRequest("GET", "/account/balance");
}

// 获取市场行情
async function getTicker(symbol) {
    return await okxRequest("GET", `/market/ticker?instId=${symbol}`);
}
async function getCandles(symbol) {
    return await okxRequest("GET", `/market/candles?instId=${symbol}&bar=1H`);
}
// 下单交易
async function placeOrder(symbol, side, size, price) {
    const orderData = {
        instId: symbol,
        tdMode: "cash",  // 交叉保证金模式
        side: side,        // buy / sell
        ordType: "limit",  // 限价单
        sz: size.toString(),
        px: price.toString(),
        ccy: "USDT",
    };
    return await okxRequest("POST", "/trade/order", orderData);
}
async function ordersPending(symbol) {
    return await okxRequest("GET", `/trade/orders-pending?instId=${symbol}`);
}
async function ordersHistory(instType="SPOT",symbol) {
    return await okxRequest("GET", `/trade/orders-history?instType=${instType}&instId=${symbol}`);
}
async function cancelOrder(symbol, orderId) {
    return await okxRequest("POST", `/trade/cancel-order`, {
        instId: symbol,
        ordId: orderId,
    });
}

module.exports = { getBalance, getTicker, placeOrder, getCandles, ordersPending, ordersHistory, cancelOrder };
