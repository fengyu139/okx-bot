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
//'BTC', 'ETH', 'LINK', 'XRP','TRUMP','DOGE','PEPE'
const instArr = ['ETH', 'LINK', 'XRP','TRUMP','DOGE','PEPE','IP','SOL','TON','FIL','DOT','XAUT','SHIB']; // 支持的币种数组

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
        if(response.data.data[0].sCode==0){
            log(`✅ ${side === "buy" ? "开多" : "开空"} ${size} ${instId}，价格: 最新市价`);
        tradingState[instId].last_order_price = await getPrice(instId); // 记录开仓价格
        tradingState[instId].position_side = side === "buy" ? "long" : "short"; // 记录持仓方向
        }
        return response.data;
    } catch (error) {
        log("❌ 交易接口失败:", error.response);
        log(JSON.stringify(body));
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
        if (res.data.data[0].sCode == 0) {
            tradingState[instId].position_side = ""; // 清空持仓方向
            tradingState[instId].position_size = 0;
            log(`✅ 平仓:${JSON.stringify(res.data)}`);
            log(`平仓金额:${size}USDT`);
            return res.data;
        } else {
            log("❌ 平仓失败:", res.data);
            log(JSON.stringify(body));
            return res.data;
        }
    } catch (error) {
        log("❌ 平仓接口失败:", error.response.data);
        log(JSON.stringify(body));
        return error.response.data;
    }
}

let accountBalance = {};

// 获取账户余额
async function updateAccountBalance() {
    try {
        const balance = await getAccountBalance();
        accountBalance.quote_balance = parseFloat(balance.details.find(b => b.ccy === "USDT")?.availBal);
        accountBalance.frozenBal = parseFloat(balance.details.find(b => b.ccy === "USDT")?.frozenBal);
        instArr.forEach(instId => {
            accountBalance[instId] = parseFloat(balance.details.find(b => b.ccy === instId)?.availBal);
        });
        log(`--------USDT余额:${parseInt(accountBalance.quote_balance)}----------`);
        log(`--------冻结余额:${parseInt(accountBalance.frozenBal)}----------`);
    } catch (error) {
        console.error("❌ 更新账户余额失败:", error);
    }
}
async function checkPosition(){
    let res = await getPositions();
    res.data.forEach(b=>{
       log(`${b.instId}：持仓数量:${parseInt(b.availPos)},开仓价格:${b.avgPx},当前价格:${b.markPx}`);
    });
}
// 获取持仓数据
async function getPositions(instId) {
    const path = `/api/v5/account/positions`;
    const { timestamp, signature } = signRequest("GET", path);
    const headers = {
        "OK-ACCESS-KEY": API_KEY,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": API_PASSPHRASE,
    };

    try {
        const response = await axios.get(`${BASE_URL}${path}`, { headers });
        return response.data;
    } catch (error) {
        console.error("❌ 获取持仓数据失败:", error.response.data);
    }
}
// 交易策略
async function strategy(instId) {
    const prices = await getKlines(instId);
    if (prices.length < 3) return;

    const latest_price = prices[0];
    const price_6_hours_ago = prices[prices.length - 1];
    log(`${instId}：最新价格:${latest_price}，3小时前价格:${price_6_hours_ago}`);
    const quote_balance = accountBalance.quote_balance;
    const frozenBal = accountBalance.frozenBal;
    let trade_amount = quote_balance / 0.4  * 10;
    if(accountBalance.frozenBal<80){
        tradingState[instId].position_side = "";
        tradingState[instId].position_size = 0;
    }
    // ✅ 开多（价格涨 2.5%）
    if (latest_price < price_6_hours_ago * 0.945 && quote_balance > 10&&frozenBal<80) {
        let res = await placeOrder(instId, "buy", trade_amount);
        if (res.data[0].sCode == 0) {
            log(`开多:${JSON.stringify(res)}`);
            tradingState[instId].position_size += trade_amount;
        } else {
           log("❌ 开多失败:", res.data);
           log(instId,latest_price,price_6_hours_ago,trade_amount,);
        }
    }
    // ✅ 开空（价格跌 2.5%）
    if (latest_price > price_6_hours_ago * 1.055 && quote_balance > 10&&frozenBal<80) {
        let res = await placeOrder(instId, "sell", trade_amount);
        if (res.data[0].sCode == 0) {
            log(`开空:${JSON.stringify(res)}`);
            tradingState[instId].position_size += trade_amount;
        } else {
            log("❌ 开空失败:", res.data);
            log(instId,latest_price,price_6_hours_ago,trade_amount,frozenBal);
        }
    }
    // ✅ 止盈 35% 平仓
    if (tradingState[instId].position_side === "long" && latest_price >= tradingState[instId].last_order_price * 1.035 && frozenBal > 10) {
        let res = await getPositions(instId);
        let availPos=res.data.find(b=>b.availPos>1)?.availPos||0;
        if(availPos>1){
            await closePosition(instId, availPos);
            tradingState[instId].position_size = 0;
        }
    }
    // ✅ 止损 5% 平仓（多仓）
    if (tradingState[instId].position_side === "long" && latest_price <= tradingState[instId].last_order_price * 0.947 && frozenBal > 10) {
        let res = await getPositions(instId);
        let availPos=res.data.find(b=>b.availPos>1)?.availPos||0;
        if(availPos>1){
            log(`触发止损：多仓价格下跌超过5%`);
            await closePosition(instId, availPos);
            tradingState[instId].position_size = 0;
        }
    }
    if (tradingState[instId].position_side === "short" && latest_price <= tradingState[instId].last_order_price * 0.975 && frozenBal > 10) {
        let res = await getPositions(instId);
        let availPos=res.data.find(b=>b.availPos>1)?.availPos||0;
        if(availPos>1){
            await closePosition(instId, availPos);
            tradingState[instId].position_size = 0;
        }
    }
    // ✅ 止损 5% 平仓（空仓）
    if (tradingState[instId].position_side === "short" && latest_price >= tradingState[instId].last_order_price * 1.053 && frozenBal > 10) {
        let res = await getPositions(instId);
        let availPos=res.data.find(b=>b.availPos>1)?.availPos||0;
        if(availPos>1){
            log(`触发止损：空仓价格上涨超过5%`);
            await closePosition(instId, availPos);
            tradingState[instId].position_size = 0;
        }
    }
}
// 手动使用限价单平仓（更保守但可能不会立即成交）
async function closeIPPositionLimit(instId) {
    // 先获取当前市价
    const ticker = await axios.get(`${BASE_URL}/api/v5/market/ticker?instId=${instId}-USDT`);
    const currentPrice = parseFloat(ticker.data.data[0].last);
    
    const path = "/api/v5/trade/order";
    const body = JSON.stringify({
        instId: `${instId}-USDT`,
        tdMode: "cross",
        side: "buy",
        ordType: "limit",       // 限价单
        px: currentPrice.toString(), // 以当前市价挂单
        sz: "3170",
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
        if(response.data.data[0].sCode == 0) {
            log(`✅ IP-USDT 平仓成功，数量: 98.57133`);
            return response.data;
        } else {
            log(`❌ 平仓失败: ${JSON.stringify(response.data)}`);
            return response.data;
        }
    } catch (error) {
        log("❌ 平仓接口调用失败:", error.response?.data || error);
        return error.response?.data;
    }
}
// closeIPPositionLimit('LINK');
// ✅ 主循环
async function main() {
    while (true) {
        await updateAccountBalance(); // 在每次循环开始时更新账户余额
        await checkPosition();
        for (const instId of instArr) {
            await strategy(instId);
        }
        await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
    }
}

main();
