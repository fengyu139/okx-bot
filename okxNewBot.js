/**
 * okx_bot.js
 * Node.js simple trading bot demo for OKX v5 (swap/contracts).
 *
 * Usage:
 *   - Put your keys in environment variables (or a .env during testing).
 *   - npm install axios crypto dotenv
 *   - node okx_bot.js
 *
 * WARNING: This is example code for learning/testing. Use sandbox keys first.
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

// === CONFIG - 从环境变量读取（你已提供这些值；建议使用 .env 或环境变量注入） ===
const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;
const BASE_URL = process.env.OKX_BASE_URL || 'https://www.okx.com'; // 生产

// 🔥 支持单个交易对（多实例模式）
const SYMBOL = process.env.SYMBOL || 'BTC-USDT-SWAP';

const STARTING_CAPITAL = parseFloat(process.env.STARTING_CAPITAL || '1000'); // 1000 USDT
const RISK_PER_TRADE = parseFloat(process.env.RISK_PER_TRADE || '0.015'); // 每次风险 1.5%
const LEVERAGE = parseInt(process.env.LEVERAGE || '10'); // 使用杠杆（示例）
const SHORT_SMA_PERIOD = parseInt(process.env.SHORT_SMA_PERIOD || '7');
const LONG_SMA_PERIOD = parseInt(process.env.LONG_SMA_PERIOD || '25');
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000'); // 15秒查询一次

// 🔥 新增：策略优化参数
const MIN_VOLATILITY = parseFloat(process.env.MIN_VOLATILITY || '0.0005'); // 最小波动率 0.05%（修复：从0.0008降低）
const MIN_ATR_RATIO = parseFloat(process.env.MIN_ATR_RATIO || '0.002'); // 最小ATR比率 0.2%（修复：新增可配置）
const MIN_PRICE_CHANGE = parseFloat(process.env.MIN_PRICE_CHANGE || '0.003'); // 最小价格变化 0.3%（修复：新增可配置）
const MIN_VOLUME_RATIO = parseFloat(process.env.MIN_VOLUME_RATIO || '1.3'); // 成交量倍数 1.3x
const MIN_TRADE_INTERVAL = parseInt(process.env.MIN_TRADE_INTERVAL || '1800000'); // 最小交易间隔 30分钟（修复：从2小时降低）
const DYNAMIC_SL_MULTIPLIER = parseFloat(process.env.DYNAMIC_SL_MULTIPLIER || '1.5'); // 动态止损倍数

if (!API_KEY || !SECRET_KEY || !PASSPHRASE) {
  console.error('Missing API keys — set OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE in env');
  process.exit(1);
}

// === 日志系统 ===
// 🔥 多实例模式：每个币种独立的日志和状态文件
const SYMBOL_SHORT = SYMBOL.replace(/-/g, '_').replace(/\//g, '_');
const LOG_FILE = path.join(__dirname, `logs/okx-${SYMBOL_SHORT}.log`);
const STATE_FILE = path.join(__dirname, `states/botState-${SYMBOL_SHORT}.json`);

// 日志级别
const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
};

function log(level, message, data = null) {
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  
  // 写入文件
  try {
    let fileMessage = logMessage;
    if (data) {
      fileMessage += '\n' + JSON.stringify(data, null, 2);
    }
    fs.appendFileSync(LOG_FILE, fileMessage + '\n');
  } catch (err) {
    console.error('日志写入失败:', err.message);
  }
}

// === 状态管理 ===
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    // 静默保存，不输出日志
  } catch (err) {
    log(LOG_LEVELS.ERROR, '❌ 状态保存失败', { error: err.message });
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    log(LOG_LEVELS.ERROR, '状态加载失败', { error: err.message });
  }
  return {
    lastSignal: 'hold',
    lastTradeTime: null,
    currentPosition: null,
    errorCount: 0
  };
}

let botState = loadState();

// === Helper: create OKX signature per docs ===
// signature = Base64( HMAC_SHA256( timestamp + method + requestPath + body, secretKey ) )
function getTimestamp() {
  // OKX expects seconds (decimal allowed) — use ISO 8601-like seconds with milliseconds fraction is OK.
  return (Date.now() / 1000).toString();
}

function sign(message, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('base64');
}

async function okxRequest(method, requestPath, body = '') {
  // requestPath example: '/api/v5/account/balance' or '/api/v5/trade/order'
  const timestamp = getTimestamp();
  const bodyString = body ? JSON.stringify(body) : '';
  const prehash = timestamp + method.toUpperCase() + requestPath + bodyString;
  const signature = sign(prehash, SECRET_KEY);

  const headers = {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': PASSPHRASE
  };

  const url = BASE_URL + requestPath;
  try {
    const resp = await axios({
      url,
      method,
      headers,
      data: bodyString || undefined,
      timeout: 10000
    });
    return resp.data;
  } catch (err) {
    // 提供更有用的错误信息
    if (err.response) {
      log(LOG_LEVELS.ERROR, 'OKX API Error', { 
        status: err.response.status, 
        data: err.response.data,
        path: requestPath 
      });
      return { error: true, status: err.response.status, data: err.response.data };
    } else {
      log(LOG_LEVELS.ERROR, 'Network/Request Error', { 
        message: err.message, 
        path: requestPath 
      });
      return { error: true, msg: err.message };
    }
  }
}

// === Trading helpers ===

async function getAccountBalance(ccy = 'USDT') {
  // /api/v5/account/balance?ccy=USDT
  const path = `/api/v5/account/balance?ccy=${encodeURIComponent(ccy)}`;
  const res = await okxRequest('GET', path, '');
  if (res && res.data) {
    // find balance object
    const arr = res.data;
    // data is array of currency objects (per OKX response)
    return arr;
  }
  return null;
}

async function getTicker(instId) {
  const path = `/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`;
  return await okxRequest('GET', path, '');
}

async function placeOrder(order) {
  // POST /api/v5/trade/order
  const path = '/api/v5/trade/order';
  return await okxRequest('POST', path, order);
}

async function setLeverage(instId, sz, mgnMode = 'cross') {
  // NOTE: OKX uses /api/v5/account/set-leverage for futures? There is also /api/v5/trade/set-leverage for some SDKs.
  // We'll attempt /api/v5/account/set-leverage (if your account type differs, adjust).
  const path = '/api/v5/account/set-leverage';
  const body = { instId, lever: sz.toString(), mgnMode };
  return await okxRequest('POST', path, body);
}

// 查询账户配置（获取持仓模式）
async function getAccountConfig() {
  const path = '/api/v5/account/config';
  return await okxRequest('GET', path, '');
}

// 全局变量：持仓模式（初始化时检测）
let posMode = 'net_mode'; // 默认单向持仓模式

// 查询持仓
async function getPositions(instId = '') {
  let path = '/api/v5/account/positions';
  if (instId) {
    path += `?instId=${encodeURIComponent(instId)}`;
  }
  return await okxRequest('GET', path, '');
}

// 平仓（市价平仓）
async function closePosition(instId, posSide) {
  // 先查询当前持仓
  const posResp = await getPositions(instId);
  if (!posResp || !posResp.data || posResp.data.length === 0) {
    log(LOG_LEVELS.WARN, '没有找到持仓', { instId });
    return null;
  }
  
  let position;
  if (posMode === 'long_short_mode') {
    // 双向持仓模式：需要匹配 posSide
    position = posResp.data.find(p => p.instId === instId && p.posSide === posSide);
  } else {
    // 单向持仓模式：只需要匹配 instId
    position = posResp.data.find(p => p.instId === instId && parseFloat(p.pos) !== 0);
  }
  
  if (!position || parseFloat(position.pos) === 0) {
    log(LOG_LEVELS.WARN, '没有找到指定的持仓', { instId, posSide });
    return null;
  }
  
  const posSize = Math.abs(parseFloat(position.pos));
  // 平仓方向：单向持仓看持仓正负，双向持仓看posSide
  let side;
  if (posMode === 'long_short_mode') {
    side = posSide === 'long' ? 'sell' : 'buy';
  } else {
    // 单向持仓：pos > 0 是多头，需要卖出平仓；pos < 0 是空头，需要买入平仓
    side = parseFloat(position.pos) > 0 ? 'sell' : 'buy';
  }
  
  const order = {
    instId: instId,
    tdMode: position.mgnMode || 'cross',
    side: side,
    ordType: 'market',
    sz: posSize.toString()
  };
  
  // 只有双向持仓模式才需要 posSide
  if (posMode === 'long_short_mode') {
    order.posSide = posSide;
  }
  
  log(LOG_LEVELS.INFO, '提交平仓订单', order);
  return await placeOrder(order);
}

// 提交止损止盈订单（algo订单）
async function placeAlgoOrder(algoOrder) {
  const path = '/api/v5/trade/order-algo';
  return await okxRequest('POST', path, algoOrder);
}

// 取消algo订单
async function cancelAlgoOrder(params) {
  const path = '/api/v5/trade/cancel-algos';
  return await okxRequest('POST', path, params);
}

// 查询未成交algo订单
async function getAlgoOrders(instId, ordType = 'conditional') {
  const path = `/api/v5/trade/orders-algo-pending?instId=${encodeURIComponent(instId)}&ordType=${ordType}`;
  return await okxRequest('GET', path, '');
}

// === Simple SMA indicator implementation ===
function SMA(values, period) {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

// 🔥 优化 1: 波动率计算（用于趋势过滤）
function calculateVolatility(candles, period = 20) {
  if (candles.length < period + 1) return null;  // 至少需要 period+1 个数据
  
  const recentCandles = candles.slice(-period);
  const returns = [];
  
  for (let i = 1; i < recentCandles.length; i++) {
    const returnPct = (recentCandles[i].close - recentCandles[i-1].close) / recentCandles[i-1].close;
    returns.push(returnPct);
  }
  
  if (returns.length < 2) return null;  // 至少需要2个收益率
  
  // 计算样本标准差（使用 N-1 进行贝塞尔校正）
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);  // ← 修复：N-1
  const volatility = Math.sqrt(variance);
  
  return volatility;
}

// 🔥 优化 1: ATR 计算（平均真实波幅）
function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i-1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }
  
  // 计算 ATR（简单移动平均）
  const recentTRs = trs.slice(-period);
  const atr = recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;
  
  return atr;
}

// 🔥 优化 1: 判断是否处于趋势市场
function isTrendingMarket(candles, currentPrice) {
  if (candles.length < 30) return false;
  
  // 1. 波动率检查
  const volatility = calculateVolatility(candles);
  if (!volatility || volatility < MIN_VOLATILITY) {
    log(LOG_LEVELS.INFO, '市场波动率过低，不适合交易', { 
      volatility: volatility ? (volatility * 100).toFixed(2) + '%' : 'N/A',
      最小要求: (MIN_VOLATILITY * 100).toFixed(2) + '%'
    });
    return false;
  }
  
  // 2. ATR 检查（相对价格的比例）
  const atr = calculateATR(candles);
  if (!atr) return false;
  
  const atrRatio = atr / currentPrice;
  if (atrRatio < MIN_ATR_RATIO) { // 修复：使用可配置的阈值
    log(LOG_LEVELS.INFO, 'ATR 过低，市场波动不足', { 
      atrRatio: (atrRatio * 100).toFixed(2) + '%',
      最小要求: (MIN_ATR_RATIO * 100).toFixed(2) + '%'
    });
    return false;
  }
  
  // 3. 价格方向性检查（是否有明确方向）
  const recent20 = candles.slice(-20);
  const first10Avg = recent20.slice(0, 10).reduce((sum, c) => sum + c.close, 0) / 10;
  const last10Avg = recent20.slice(-10).reduce((sum, c) => sum + c.close, 0) / 10;
  const priceChange = Math.abs((last10Avg - first10Avg) / first10Avg);
  
  if (priceChange < MIN_PRICE_CHANGE) { // 修复：使用可配置的阈值
    log(LOG_LEVELS.INFO, '价格方向性不足，可能是震荡市', { 
      priceChange: (priceChange * 100).toFixed(2) + '%',
      最小要求: (MIN_PRICE_CHANGE * 100).toFixed(2) + '%'
    });
    return false;
  }
  
  log(LOG_LEVELS.SUCCESS, '✅ 市场处于趋势状态', { 
    波动率: (volatility * 100).toFixed(2) + '%',
    ATR比率: (atrRatio * 100).toFixed(2) + '%',
    方向性: (priceChange * 100).toFixed(2) + '%'
  });
  
  return true;
}

// 🔥 优化 2: 多时间框架分析
async function getMultiTimeframeSignal(instId, currentSignal) {
  try {
    // 获取 15 分钟和 1 小时的 K 线
    const candles15m = await fetchRecentCandles(instId, '15m', 50);
    const candles1h = await fetchRecentCandles(instId, '1H', 50);
    
    if (!candles15m || !candles1h) return null;
    
    // 计算 15 分钟的均线
    const prices15m = candles15m.map(c => c.close);
    const short15m = SMA(prices15m, 7);
    const long15m = SMA(prices15m, 25);
    
    // 计算 1 小时的均线
    const prices1h = candles1h.map(c => c.close);
    const short1h = SMA(prices1h, 7);
    const long1h = SMA(prices1h, 25);
    
    if (!short15m || !long15m || !short1h || !long1h) return null;
    
    // 判断各时间框架的趋势
    const trend15m = short15m > long15m ? 'long' : 'short';
    const trend1h = short1h > long1h ? 'long' : 'short';
    
    // 修复：放宽要求，至少2个时间框架一致即可
    // 静默分析，只在确认成功时输出日志
    if (currentSignal === 'long') {
      if (trend15m === 'long' || trend1h === 'long') {
        log(LOG_LEVELS.SUCCESS, `✅ 多时间框架确认：做多 (1m:${currentSignal}, 15m:${trend15m}, 1h:${trend1h})`);
        return 'long';
      }
    }
    
    if (currentSignal === 'short') {
      if (trend15m === 'short' || trend1h === 'short') {
        log(LOG_LEVELS.SUCCESS, `✅ 多时间框架确认：做空 (1m:${currentSignal}, 15m:${trend15m}, 1h:${trend1h})`);
        return 'short';
      }
    }
    
    log(LOG_LEVELS.WARN, `❌ 多时间框架不一致 (1m:${currentSignal}, 15m:${trend15m}, 1h:${trend1h})`);
    return null;
    
  } catch (err) {
    log(LOG_LEVELS.ERROR, '多时间框架分析失败', { error: err.message });
    return null;
  }
}

// 🔥 优化 3: 动态止损止盈计算
function calculateDynamicSLTP(candles, currentPrice, signal) {
  const atr = calculateATR(candles);
  const volatility = calculateVolatility(candles);
  
  if (!atr || !volatility) {
    // 使用默认值
    return {
      stopLossPct: signal === 'long' ? -0.015 : 0.015,
      takeProfitPct: signal === 'long' ? 0.03 : -0.03
    };
  }
  
  // 根据 ATR 和波动率动态调整
  const atrRatio = atr / currentPrice;
  
  // 止损：ATR 的 1.5 倍（更宽松，减少假突破）
  let stopLossRatio = atrRatio * DYNAMIC_SL_MULTIPLIER;
  stopLossRatio = Math.max(0.01, Math.min(0.03, stopLossRatio)); // 限制在 1%-3%
  
  // 止盈：止损的 2 倍（保持 2:1 盈亏比）
  let takeProfitRatio = stopLossRatio * 2;
  
  const stopLossPct = signal === 'long' ? -stopLossRatio : stopLossRatio;
  const takeProfitPct = signal === 'long' ? takeProfitRatio : -takeProfitRatio;
  
  // 静默计算止损止盈，不输出日志
  return { stopLossPct, takeProfitPct };
}

// 🔥 优化 4: 成交量确认
function isVolumeConfirmed(candles) {
  if (candles.length < 21) return true; // 修复：至少需要21根K线（使用倒数第2根）
  
  const recentVolumes = candles.slice(-21, -1).map(c => c.vol); // 最近20根完整K线
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const currentVolume = candles[candles.length - 2].vol; // 修复：使用上一根完整K线
  
  const volumeRatio = currentVolume / avgVolume;
  
  if (volumeRatio >= MIN_VOLUME_RATIO) {
    log(LOG_LEVELS.SUCCESS, '✅ 成交量确认通过', { 
      当前成交量: currentVolume.toFixed(2),
      平均成交量: avgVolume.toFixed(2),
      比率: volumeRatio.toFixed(2) + 'x'
    });
    return true;
  }
  
  log(LOG_LEVELS.WARN, '❌ 成交量不足，信号可疑', { 
    比率: volumeRatio.toFixed(2) + 'x',
    最小要求: MIN_VOLUME_RATIO + 'x'
  });
  return false;
}

// 🔥 优化 5: 交易时间间隔检查
function canTradeNow(lastTradeTime) {
  if (!lastTradeTime) return true;
  
  const now = Date.now();
  const lastTrade = new Date(lastTradeTime).getTime();
  const timeSinceLastTrade = now - lastTrade;
  
  if (timeSinceLastTrade < MIN_TRADE_INTERVAL) {
    const remainingMinutes = Math.ceil((MIN_TRADE_INTERVAL - timeSinceLastTrade) / 60000);
    log(LOG_LEVELS.WARN, '⏱️  距离上次交易时间过短', { 
      等待时间: remainingMinutes + '分钟',
      最小间隔: (MIN_TRADE_INTERVAL / 60000) + '分钟'
    });
    return false;
  }
  
  return true;
}

// === Position sizing: 根据账户净值与风险百分比计算仓位合约张数 ===
// 修复：移除杠杆对止损金额的影响
function computeOrderSize(accountUSDT, entryPrice, stopLossPct, riskPct, leverage) {
  // riskAmt = accountUSDT * riskPct (愿意承受的风险金额)
  const riskAmt = accountUSDT * riskPct;
  
  // 每张合约的止损金额 = 价格 × 止损百分比
  const perContractLoss = entryPrice * Math.abs(stopLossPct);
  
  // 计算合约张数
  const approxContracts = Math.floor(riskAmt / perContractLoss);
  
  return Math.max(approxContracts, 1);
}

// === Bot main logic ===

let priceHistory = []; // store recent close prices for SMA
const maxHistory = 200;

async function fetchRecentCandles(instId, bar = '1m', limit = 200) {
  // GET /api/v5/market/history-candles?instId=BTC-USDT-SWAP&bar=1m&limit=200
  const path = `/api/v5/market/history-candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const res = await okxRequest('GET', path, '');
  if (res && res.data) {
    // OKX returns array of arrays: [time, open, high, low, close, vol, ...]
    return res.data.map(c => ({ time: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), vol: parseFloat(c[5]) }));
  }
  return null;
}

async function mainLoop() {
  try {
    // 重置错误计数
    if (botState.errorCount > 10) {
      log(LOG_LEVELS.ERROR, '错误次数过多，停止机器人');
      process.exit(1);
    }
    
    // 1) 获取账户余额（USDT）
    const balances = await getAccountBalance('USDT');
    // parse available balance
    let usdtAvailable = STARTING_CAPITAL;
    if (balances && balances.length) {
      // 找到 currency 为 USDT 的对象
      const obj = balances[0].details.find(x => x.ccy === 'USDT');
      if (obj) {
        usdtAvailable = parseFloat(obj.availBal || obj.details?.[0]?.availBal || obj.eq) || usdtAvailable;
      }
    }
    
    // 1.5) 检查当前持仓
    const positionsResp = await getPositions(SYMBOL);
    let currentPosition = null;
    if (positionsResp && positionsResp.data && positionsResp.data.length > 0) {
      // 找到非零持仓
      currentPosition = positionsResp.data.find(p => {
        return p.instId === SYMBOL && parseFloat(p.pos) !== 0;
      });
      if (currentPosition) {
        // 静默记录持仓信息，不输出日志（减少噪音）
        botState.currentPosition = {
          posSide: currentPosition.posSide,
          pos: parseFloat(currentPosition.pos),
          avgPx: parseFloat(currentPosition.avgPx),
          instId: currentPosition.instId
        };
      }
    } else {
      botState.currentPosition = null;
    }

    // 2) 获取最近 K 线数据并更新 priceHistory
    const candles = await fetchRecentCandles(SYMBOL, '1m', Math.max(LONG_SMA_PERIOD + 5, 80));
    if (!candles || candles.length === 0) {
      log(LOG_LEVELS.WARN, 'No candles data, skipping cycle');
      botState.errorCount++;
      saveState(botState);
      return;
    }
    priceHistory = candles.map(c => c.close);
    if (priceHistory.length > maxHistory) priceHistory = priceHistory.slice(priceHistory.length - maxHistory);

    // 3) 计算 SMA
    const shortSMA = SMA(priceHistory, SHORT_SMA_PERIOD);
    const longSMA = SMA(priceHistory, LONG_SMA_PERIOD);
    const currentPrice = priceHistory[priceHistory.length - 1];

    if (!shortSMA || !longSMA) {
      // 静默等待数据，不输出日志
      return;
    }

    // 4) 决策：比较上一个周期的 SMA 交叉（简单信号）
    const prevShort = SMA(priceHistory.slice(0, -1), SHORT_SMA_PERIOD);
    const prevLong = SMA(priceHistory.slice(0, -1), LONG_SMA_PERIOD);

    let signal = 'hold';
    if (prevShort && prevLong) {
      if (prevShort <= prevLong && shortSMA > longSMA) signal = 'long'; // 向上金叉
      if (prevShort >= prevLong && shortSMA < longSMA) signal = 'short'; // 向下死叉
    }

    // 🔥 新增：5个关键优化检查
    if (signal !== 'hold') {
      log(LOG_LEVELS.INFO, `📊 检测到${signal === 'long' ? '金叉' : '死叉'}信号，开始验证...`);
      
      // 优化 1: 趋势过滤器
      if (!isTrendingMarket(candles, currentPrice)) {
        log(LOG_LEVELS.WARN, '❌ 未通过趋势过滤，跳过交易');
        return;
      }
      
      // 优化 2: 多时间框架确认
      const confirmedSignal = await getMultiTimeframeSignal(SYMBOL, signal);
      if (!confirmedSignal) {
        log(LOG_LEVELS.WARN, '❌ 多时间框架确认失败，跳过交易');
        return;
      }
      signal = confirmedSignal;
      
      // 优化 4: 成交量确认
      if (!isVolumeConfirmed(candles)) {
        log(LOG_LEVELS.WARN, '❌ 成交量确认失败，跳过交易');
        return;
      }
      
      // 优化 5: 交易时间间隔检查
      if (!canTradeNow(botState.lastTradeTime)) {
        log(LOG_LEVELS.WARN, '❌ 距离上次交易时间过短，跳过交易');
        return;
      }
      
      log(LOG_LEVELS.SUCCESS, '✅ 所有验证通过，准备交易！');
    }

    // 5) 交易逻辑：处理持仓和信号
    // 5.1) 如果有持仓，检查是否需要平仓
    if (currentPosition) {
      const positionSide = currentPosition.posSide;
      
      // 修复：检查止损止盈订单是否存在（静默检查）
      const algoOrders = await getAlgoOrders(SYMBOL, 'trigger');
      if (!algoOrders || !algoOrders.data || algoOrders.data.length === 0) {
        log(LOG_LEVELS.WARN, '⚠️ 持仓没有保护单');
        // TODO: 这里可以添加重新设置止损止盈的逻辑
      }
      
      // 如果信号与持仓方向相反，平仓
      if ((signal === 'long' && positionSide === 'short') || 
          (signal === 'short' && positionSide === 'long')) {
        log(LOG_LEVELS.INFO, `🔄 信号反转: ${positionSide} → ${signal}，平仓中...`);
        
        const closeResp = await closePosition(SYMBOL, positionSide);
        if (closeResp && closeResp.data && closeResp.data[0]?.sCode === '0') {
          log(LOG_LEVELS.SUCCESS, `✅ 平仓成功: ${positionSide} 已平仓`);
          botState.currentPosition = null;
          botState.lastTradeTime = new Date().toISOString();
          saveState(botState);
        } else {
          log(LOG_LEVELS.ERROR, '❌ 平仓失败', closeResp);
          botState.errorCount++;
          saveState(botState);
          return;
        }
      } else {
        // 持仓方向与信号一致或信号为hold，不操作（静默）
        return;
      }
    }
    
    // 5.2) 如果有新信号且无持仓，开仓
    if ((signal === 'long' || signal === 'short') && !currentPosition) {
      // 🔥 优化 3: 使用动态止损止盈
      const { stopLossPct, takeProfitPct } = calculateDynamicSLTP(candles, currentPrice, signal);

      const sizeContracts = computeOrderSize(usdtAvailable, currentPrice, stopLossPct, RISK_PER_TRADE, LEVERAGE);
      if (sizeContracts <= 0) {
        log(LOG_LEVELS.WARN, '计算到的合约数量为 0，跳过下单');
        return;
      }

      // 修复：设置杠杆（静默设置）
      const tdMode = 'cross'; // or 'isolated'
      const leverageResp = await setLeverage(SYMBOL, LEVERAGE, tdMode);
      if (leverageResp && leverageResp.code && leverageResp.code !== '0') {
        // 静默处理，可能已设置过杠杆
      }
      
      const side = signal === 'long' ? 'buy' : 'sell';
      
      // 构建订单参数
      const order = {
        instId: SYMBOL,
        tdMode: tdMode,
        side: side,
        ordType: 'market',
        sz: sizeContracts.toString()
      };
      
      // 🔧 关键修改：只有在双向持仓模式下才添加 posSide 参数
      if (posMode === 'long_short_mode') {
        order.posSide = signal; // 'long' or 'short'
      }

      log(LOG_LEVELS.INFO, `📤 下${signal === 'long' ? '多' : '空'}单: ${sizeContracts}张 @ ${currentPrice.toFixed(6)}`, {
        持仓模式: posMode === 'long_short_mode' ? '双向' : '单向',
        保证金模式: tdMode
      });
      const resp = await placeOrder(order);
      
      if (resp && resp.error) {
        log(LOG_LEVELS.ERROR, '下单返回错误', resp);
        botState.errorCount++;
        saveState(botState);
        return;
      }
      
      if (resp && resp.data && Array.isArray(resp.data) && resp.data[0].sCode === '0') {
        log(LOG_LEVELS.SUCCESS, '开仓成功', { 
          ordId: resp.data[0].ordId, 
          signal: signal,
          size: sizeContracts 
        });

        // 修复：尝试获取实际成交价格，否则使用当前价格
        const entryPrice = parseFloat(resp.data[0].fillPx) || currentPrice;
        log(LOG_LEVELS.INFO, '入场价格', { 
          实际成交价: resp.data[0].fillPx || 'N/A',
          使用价格: entryPrice 
        });

        // 修复：正确计算止损/止盈价格
        let stopPrice, takeProfitPrice;
        if (signal === 'long') {
          // 做多：向下止损，向上止盈
          stopPrice = entryPrice * (1 + stopLossPct);  // stopLossPct 是负数，如 -0.015
          takeProfitPrice = entryPrice * (1 + takeProfitPct);  // takeProfitPct 是正数，如 0.03
        } else {
          // 做空：向上止损，向下止盈
          // 修复：做空时 stopLossPct 是正数，应该向上加
          stopPrice = entryPrice * (1 + stopLossPct);  // stopLossPct 是正数，如 0.015
          takeProfitPrice = entryPrice * (1 + takeProfitPct);  // takeProfitPct 是负数，如 -0.03
        }
        
        // 静默计算止损止盈价格

        // 提交止损止盈algo订单
        const closeSide = signal === 'long' ? 'sell' : 'buy';
        
        // 修复：止损单 - 使用正确的 OKX 条件单格式
        const stopLossOrder = {
          instId: SYMBOL,
          tdMode: tdMode,
          side: closeSide,
          ordType: 'trigger',        // 修复：使用 'trigger' 而不是 'conditional'
          triggerPx: stopPrice.toFixed(2),  // 修复：使用 triggerPx
          orderPx: '-1',             // 修复：使用 orderPx（-1 表示市价）
          sz: sizeContracts.toString()
        };
        
        // 只有双向持仓模式才需要 posSide
        if (posMode === 'long_short_mode') {
          stopLossOrder.posSide = signal;
        }
        
        const slResp = await placeAlgoOrder(stopLossOrder);
        
        // 修复：止损单失败则立即平仓保护
        if (slResp && slResp.data && slResp.data[0]?.sCode === '0') {
          log(LOG_LEVELS.SUCCESS, `✅ 止损单已设置 @ ${stopPrice.toFixed(6)}`);
        } else {
          log(LOG_LEVELS.ERROR, '⚠️ 止损订单提交失败，立即平仓保护！', slResp);
          // 立即平仓
          await closePosition(SYMBOL, signal);
          botState.currentPosition = null;
          saveState(botState);
          return;
        }
        
        // 修复：止盈单 - 使用正确的 OKX 条件单格式
        const takeProfitOrder = {
          instId: SYMBOL,
          tdMode: tdMode,
          side: closeSide,
          ordType: 'trigger',        // 修复：使用 'trigger' 而不是 'conditional'
          triggerPx: takeProfitPrice.toFixed(2),  // 修复：使用 triggerPx
          orderPx: '-1',             // 修复：使用 orderPx（-1 表示市价）
          sz: sizeContracts.toString()
        };
        
        // 只有双向持仓模式才需要 posSide
        if (posMode === 'long_short_mode') {
          takeProfitOrder.posSide = signal;
        }
        
        const tpResp = await placeAlgoOrder(takeProfitOrder);
        
        // 修复：止盈单失败也要记录，但不强制平仓
        if (tpResp && tpResp.data && tpResp.data[0]?.sCode === '0') {
          log(LOG_LEVELS.SUCCESS, `✅ 止盈单已设置 @ ${takeProfitPrice.toFixed(6)}`);
        } else {
          log(LOG_LEVELS.ERROR, '⚠️ 止盈订单提交失败（持仓仍受止损保护）', tpResp);
        }
        
        // 修复：使用 signal 而不是未定义的 posSide
        botState.lastSignal = signal;
        botState.lastTradeTime = new Date().toISOString();
        botState.currentPosition = {
          posSide: signal,  // 修复：使用 signal
          size: sizeContracts,
          entryPrice: entryPrice,
          instId: SYMBOL
        };
        botState.errorCount = 0; // 重置错误计数
        saveState(botState);
        
      } else {
        log(LOG_LEVELS.WARN, '下单响应非成功', resp);
        botState.errorCount++;
        saveState(botState);
      }
    }
    
    // 修复：只在成功交易后重置错误计数，避免覆盖之前的错误
    // 已经在交易成功处重置，这里不再重复
  } catch (e) {
    log(LOG_LEVELS.ERROR, '主循环错误', {
      message: e.message,
      stack: e.stack
    });
    botState.errorCount++;
    saveState(botState);
    
    // 如果错误过多，暂停一段时间
    if (botState.errorCount > 5) {
      log(LOG_LEVELS.WARN, `连续错误 ${botState.errorCount} 次，等待 60 秒后继续...`);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

// === 优雅退出处理 ===
process.on('SIGINT', async () => {
  log(LOG_LEVELS.INFO, '接收到 SIGINT 信号，准备退出...');
  
  // 查询当前持仓并记录
  try {
    const positions = await getPositions(SYMBOL);
    if (positions && positions.data && positions.data.length > 0) {
      log(LOG_LEVELS.WARN, '退出时仍有持仓', positions.data);
    }
  } catch (err) {
    log(LOG_LEVELS.ERROR, '退出时查询持仓失败', { error: err.message });
  }
  
  saveState(botState);
  log(LOG_LEVELS.INFO, 'Bot 已停止');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log(LOG_LEVELS.INFO, '接收到 SIGTERM 信号，准备退出...');
  saveState(botState);
  log(LOG_LEVELS.INFO, 'Bot 已停止');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  log(LOG_LEVELS.ERROR, '未处理的 Promise 拒绝', {
    reason: reason,
    promise: promise
  });
});

process.on('uncaughtException', (error) => {
  log(LOG_LEVELS.ERROR, '未捕获的异常', {
    message: error.message,
    stack: error.stack
  });
  saveState(botState);
  process.exit(1);
});

// 启动定时轮询
log(LOG_LEVELS.INFO, '========================================');
log(LOG_LEVELS.INFO, '🤖 OKX 交易机器人启动中...');
log(LOG_LEVELS.INFO, '========================================');

// 初始化：检测账户持仓模式
async function initBot() {
  try {
    const config = await getAccountConfig();
    
    if (config && config.data && config.data.length > 0) {
      posMode = config.data[0].posMode || 'net_mode';
      log(LOG_LEVELS.INFO, `✅ 持仓模式: ${posMode === 'long_short_mode' ? '双向' : '单向'}`);
    } else {
      log(LOG_LEVELS.WARN, '⚠️ 使用默认持仓模式: 单向');
    }
  } catch (err) {
    log(LOG_LEVELS.WARN, '⚠️ 账户配置检测失败，使用默认: 单向持仓');
  }

  log(LOG_LEVELS.INFO, `📊 ${SYMBOL} | 杠杆${LEVERAGE}x | 风险${(RISK_PER_TRADE * 100).toFixed(1)}% | SMA(${SHORT_SMA_PERIOD},${LONG_SMA_PERIOD})`);

  if (botState.currentPosition) {
    log(LOG_LEVELS.INFO, `📌 恢复持仓: ${botState.currentPosition.posSide} ${botState.currentPosition.size}张 @ ${botState.currentPosition.entryPrice}`);
  }

  // 开始主循环
  setInterval(mainLoop, POLL_INTERVAL_MS);
  mainLoop();
}

// 启动机器人
initBot();
