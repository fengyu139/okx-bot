/**
 * okxHighLowBot.js
 * OKX 高低点突破策略机器人（币币杠杆交易）
 * 
 * 策略说明：
 * 1. 每隔10分钟循环一次
 * 2. 判断当前价格是否达到12小时内最高点或最低点
 * 3. 最高点：开10倍杠杆做多
 * 4. 最低点：开10倍杠杆做空
 * 5. 开仓金额：账户余额的一半
 * 6. 止盈：5%
 * 7. 止损：3%
 * 
 * 交易模式：币币杠杆（Margin Trading）
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

// === 配置参数 ===
const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;
const BASE_URL = process.env.OKX_BASE_URL || 'https://www.okx.com';

// 策略参数
const SYMBOL = process.env.SYMBOL || 'XRP-USDT'; // 币币杠杆交易对
const LEVERAGE = parseInt(process.env.LEVERAGE || '10'); // 10倍杠杆
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '300000'); // 5分钟 = 300000ms
const LOOKBACK_HOURS = parseInt(process.env.LOOKBACK_HOURS || '12'); // 回溯12小时
const POSITION_SIZE_PCT = parseFloat(process.env.POSITION_SIZE_PCT || '0.4'); // 仓位50%
const TAKE_PROFIT_PCT = parseFloat(process.env.TAKE_PROFIT_PCT || '0.015'); // 止盈5%
const STOP_LOSS_PCT = parseFloat(process.env.STOP_LOSS_PCT || '0.03'); // 止损3%
const MARGIN_MODE = process.env.MARGIN_MODE || 'cross'; // 保证金模式：cross(全仓) 或 isolated(逐仓)

if (!API_KEY || !SECRET_KEY || !PASSPHRASE) {
  console.error('❌ 缺少 API 密钥 - 请在环境变量中设置 OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE');
  process.exit(1);
}

// === 日志系统 ===
const SYMBOL_SHORT = SYMBOL.replace(/-/g, '_').replace(/\//g, '_');
const LOG_FILE = path.join(__dirname, `logs/okx-highlow-margin-${SYMBOL_SHORT}.log`);
const STATE_FILE = path.join(__dirname, `states/botState-highlow-margin-${SYMBOL_SHORT}.json`);

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
  } catch (err) {
    log(LOG_LEVELS.ERROR, '❌ 状态保存失败', { error: err.message });
  }
}

function loadState() {
  let state = {
    currentPosition: null,
    lastTradeTime: null,
    errorCount: 0,
    manualSLTP: {
      enabled: false,
      stopPrice: null,
      takeProfitPrice: null,
      entryPrice: null,
      signal: null
    }
  };
  
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const loadedState = JSON.parse(data);
      
      // 合并状态，确保新字段总是存在
      state = {
        ...state,
        ...loadedState,
        manualSLTP: {
          ...state.manualSLTP,
          ...(loadedState.manualSLTP || {})
        }
      };
    }
  } catch (err) {
    log(LOG_LEVELS.ERROR, '状态加载失败，使用默认状态', { error: err.message });
  }
  
  return state;
}

let botState = loadState();

// === OKX API 签名 ===
function getTimestamp() {
  return (Date.now() / 1000).toString();
}

function sign(message, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('base64');
}

async function okxRequest(method, requestPath, body = '') {
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
    if (err.response) {
      log(LOG_LEVELS.ERROR, 'OKX API 错误', { 
        status: err.response.status, 
        data: err.response.data,
        path: requestPath 
      });
      return { error: true, status: err.response.status, data: err.response.data };
    } else {
      log(LOG_LEVELS.ERROR, '网络/请求错误', { 
        message: err.message, 
        path: requestPath 
      });
      return { error: true, msg: err.message };
    }
  }
}

// === 交易 API ===
async function getAccountBalance(ccy = 'USDT') {
  const path = `/api/v5/account/balance?ccy=${encodeURIComponent(ccy)}`;
  const res = await okxRequest('GET', path, '');
  if (res && res.data) {
    return res.data;
  }
  return null;
}

async function setLeverage(instId, sz, mgnMode = 'cross') {
  const path = '/api/v5/account/set-leverage';
  const body = { instId, lever: sz.toString(), mgnMode };
  return await okxRequest('POST', path, body);
}

async function getAccountConfig() {
  const path = '/api/v5/account/config';
  return await okxRequest('GET', path, '');
}

async function getPositions(instId = '') {
  let path = '/api/v5/account/positions';
  if (instId) {
    path += `?instId=${encodeURIComponent(instId)}`;
  }
  return await okxRequest('GET', path, '');
}

async function placeOrder(order) {
  const path = '/api/v5/trade/order';
  return await okxRequest('POST', path, order);
}

async function placeAlgoOrder(algoOrder) {
  const path = '/api/v5/trade/order-algo';
  return await okxRequest('POST', path, algoOrder);
}

async function closePosition(instId, posSide) {
  const posResp = await getPositions(instId);
  if (!posResp || !posResp.data || posResp.data.length === 0) {
    log(LOG_LEVELS.WARN, '没有找到持仓', { instId });
    return null;
  }
  
  // 币币杠杆使用单向持仓模式
  const position = posResp.data.find(p => p.instId === instId && parseFloat(p.pos) !== 0);
  
  if (!position || parseFloat(position.pos) === 0) {
    log(LOG_LEVELS.WARN, '没有找到指定的持仓', { instId, posSide });
    return null;
  }
  
  const posSize = Math.abs(parseFloat(position.pos));
  const side = parseFloat(position.pos) > 0 ? 'sell' : 'buy';
  
  const order = {
    instId: instId,
    tdMode: position.mgnMode || MARGIN_MODE,
    side: side,
    ordType: 'market',
    sz: posSize.toString(),
    ccy: 'USDT' // 保证金币种
  };
  
  log(LOG_LEVELS.INFO, '提交平仓订单', order);
  return await placeOrder(order);
}

// === 获取K线数据 ===
async function fetchCandles(instId, bar = '5m', limit = 200) {
  const path = `/api/v5/market/history-candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const res = await okxRequest('GET', path, '');
  if (res && res.data) {
    return res.data.map(c => ({ 
      time: parseInt(c[0]), 
      open: parseFloat(c[1]), 
      high: parseFloat(c[2]), 
      low: parseFloat(c[3]), 
      close: parseFloat(c[4]), 
      vol: parseFloat(c[5]) 
    }));
  }
  return null;
}

// === 核心策略逻辑 ===
/**
 * 判断当前价格是否为12小时内的最高点或最低点
 */
async function analyzeHighLow(instId) {
  try {
    // 获取12小时的K线数据（5分钟级别，12小时 = 144根K线）
    const candles = await fetchCandles(instId, '5m', 150);
    
    if (!candles || candles.length < 100) {
      log(LOG_LEVELS.WARN, 'K线数据不足，跳过本次循环');
      return null;
    }
    
    // 获取最近12小时的数据
    const lookbackCandles = candles.slice(0, Math.floor(LOOKBACK_HOURS * 24)); // 12小时 = 144根5分钟K线
    const currentPrice = candles[0].close; // OKX返回的数据是从最新到最旧
    
    // 计算12小时内的最高价和最低价
    const highPrices = lookbackCandles.map(c => c.high);
    const lowPrices = lookbackCandles.map(c => c.low);
    
    const highest12h = Math.max(...highPrices);
    const lowest12h = Math.min(...lowPrices);
    // 判断是否触及最高点或最低点（允许0.1%的误差）
    const highThreshold = highest12h * 0.999; // 99.9%的最高点
    const lowThreshold = lowest12h * 1.001; // 100.1%的最低点
    
    let signal = null;
    
    if (currentPrice >= highThreshold) {
      log(LOG_LEVELS.SUCCESS, '🔥 触及12小时最高点！准备做空');
      signal = 'short';
    } else if (currentPrice <= lowThreshold) {
      log(LOG_LEVELS.SUCCESS, '❄️ 触及12小时最低点！准备做多');
      signal = 'long';
    }
    
    return {
      signal,
      currentPrice,
      highest12h,
      lowest12h
    };
    
  } catch (err) {
    log(LOG_LEVELS.ERROR, '高低点分析失败', { error: err.message });
    return null;
  }
}

/**
 * 计算开仓数量（币币杠杆交易）
 * @param {number} balance - 可用USDT余额
 * @param {number} price - 当前价格
 * @param {number} leverage - 杠杆倍数
 * @param {number} sizePct - 仓位比例
 * @returns {string} - 返回币的数量（保留4位小数）
 */
function calculatePositionSize(balance, price, leverage, sizePct) {
  // 使用账户余额的指定比例
  const capitalToUse = balance * sizePct;
  
  // 考虑杠杆后的名义价值（USDT）
  const nominalValue = capitalToUse * leverage;
  
  // 计算可以买入/卖出的币数量
  const coinAmount = nominalValue / price;
  
  // 保留4位小数，确保精度
  return coinAmount.toFixed(4);
}

// 全局变量：持仓模式（币币杠杆固定为单向持仓）
let posMode = 'net_mode';

// === 手动止盈止损检查 ===
/**
 * 手动检查止盈止损条件（当自动订单设置失败时使用）
 */
async function checkManualSLTP() {
  // 只有在手动止盈止损模式启用且有持仓时才执行
  if (!botState.manualSLTP || !botState.manualSLTP.enabled || !botState.currentPosition) {
    return false;
  }

  try {
    // 获取当前价格
    const candles = await fetchCandles(SYMBOL, '1m', 1);
    if (!candles || candles.length === 0) {
      log(LOG_LEVELS.WARN, '无法获取当前价格，跳过止盈止损检查');
      return false;
    }

    const currentPrice = candles[0].close;
    const { stopPrice, takeProfitPrice, entryPrice, signal } = botState.manualSLTP;

    log(LOG_LEVELS.INFO, `🔍 手动止盈止损检查`, {
      当前价格: currentPrice.toFixed(4),
      入场价: entryPrice.toFixed(4),
      止损价: stopPrice.toFixed(4),
      止盈价: takeProfitPrice.toFixed(4),
      持仓方向: signal
    });

    let shouldClose = false;
    let closeReason = '';

    if (signal === 'long') {
      // 做多：价格跌破止损价或超过止盈价
      if (currentPrice <= stopPrice) {
        shouldClose = true;
        closeReason = '触发止损';
      } else if (currentPrice >= takeProfitPrice) {
        shouldClose = true;
        closeReason = '触发止盈';
      }
    } else if (signal === 'short') {
      // 做空：价格涨破止损价或跌破止盈价
      if (currentPrice >= stopPrice) {
        shouldClose = true;
        closeReason = '触发止损';
      } else if (currentPrice <= takeProfitPrice) {
        shouldClose = true;
        closeReason = '触发止盈';
      }
    }

    if (shouldClose) {
      log(LOG_LEVELS.SUCCESS, `🎯 ${closeReason} - 执行手动平仓`, {
        触发价格: currentPrice.toFixed(4),
        盈亏: signal === 'long' ? 
          ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2) + '%' :
          ((entryPrice - currentPrice) / entryPrice * 100).toFixed(2) + '%'
      });

      // 执行平仓
      const closeResp = await closePosition(SYMBOL, signal);
      
      if (closeResp && closeResp.data && closeResp.data[0]?.sCode === '0') {
        log(LOG_LEVELS.SUCCESS, `✅ 手动平仓成功 - ${closeReason}`);
        
        // 清理状态
        botState.currentPosition = null;
        botState.manualSLTP = {
          enabled: false,
          stopPrice: null,
          takeProfitPrice: null,
          entryPrice: null,
          signal: null
        };
        botState.lastTradeTime = new Date().toISOString();
        saveState(botState);
        
        return true;
      } else {
        log(LOG_LEVELS.ERROR, '❌ 手动平仓失败', closeResp);
        return false;
      }
    }

    return false;
  } catch (err) {
    log(LOG_LEVELS.ERROR, '手动止盈止损检查失败', { error: err.message });
    return false;
  }
}

// === 主循环 ===
async function mainLoop() {
  try {
    // 检查错误计数
    if (botState.errorCount > 10) {
      log(LOG_LEVELS.ERROR, '错误次数过多，停止机器人');
      process.exit(1);
    }
    
    // 0. 优先检查手动止盈止损（如果启用）
    const manualCloseExecuted = await checkManualSLTP();
    if (manualCloseExecuted) {
      // 如果执行了手动平仓，本次循环结束，等待下次循环
      log(LOG_LEVELS.INFO, '已执行手动平仓，等待下次循环...');
      return;
    }

    // 1. 获取账户余额
    const balances = await getAccountBalance('USDT');
    let usdtAvailable = 0;
    if (balances && balances.length) {
      const obj = balances[0].details.find(x => x.ccy === 'USDT');
      if (obj) {
        usdtAvailable = parseFloat(obj.availBal || obj.eq) || 0;
      }
    }
    
    log(LOG_LEVELS.INFO, `💰 可用余额: ${usdtAvailable.toFixed(2)} USDT`);
    
    if (usdtAvailable < 10) {
      log(LOG_LEVELS.WARN, '余额不足，跳过交易');
      return;
    }
    
    // 2. 检查当前持仓
    const positionsResp = await getPositions(SYMBOL);
    let currentPosition = null;
    if (positionsResp && positionsResp.data && positionsResp.data.length > 0) {
      currentPosition = positionsResp.data.find(p => {
        return p.instId === SYMBOL && Math.abs(parseFloat(p.pos))>20;
      });
      
      if (currentPosition) {
        log(LOG_LEVELS.INFO, `📌 当前持仓`, {
          方向: parseFloat(currentPosition.pos) > 0 ? '做多' : '做空',
          数量: Math.abs(parseFloat(currentPosition.pos)),
          入场价: parseFloat(currentPosition.avgPx).toFixed(2),
          未实现盈亏: parseFloat(currentPosition.upl).toFixed(2) + ' USDT'
        });
        
        botState.currentPosition = {
          posSide: parseFloat(currentPosition.pos) > 0 ? 'long' : 'short',
          pos: parseFloat(currentPosition.pos),
          avgPx: parseFloat(currentPosition.avgPx),
          instId: currentPosition.instId
        };
        
        // 如果有持仓，暂时不开新仓
        log(LOG_LEVELS.INFO, '已有持仓，等待平仓后再开新仓');
        return;
      }
    } else {
      botState.currentPosition = null;
    }
    
    // 3. 分析高低点信号
    const analysis = await analyzeHighLow(SYMBOL);
    
    if (!analysis || !analysis.signal) {
      return;
    }
    
    const { signal, currentPrice } = analysis;
    
    // 4. 如果有信号且无持仓，则开仓
    if ((signal === 'long' || signal === 'short') && !currentPosition) {
      log(LOG_LEVELS.SUCCESS, `✅ 触发${signal === 'long' ? '做多' : '做空'}信号`);
      
      // 设置杠杆
      await setLeverage(SYMBOL, LEVERAGE, MARGIN_MODE);
      
      // 计算开仓数量（币的数量）
      const coinSize = calculatePositionSize(usdtAvailable, currentPrice, LEVERAGE, POSITION_SIZE_PCT);
      
      log(LOG_LEVELS.INFO, `📊 开仓参数`, {
        方向: signal === 'long' ? '做多' : '做空',
        杠杆: LEVERAGE + 'x',
        保证金模式: MARGIN_MODE === 'cross' ? '全仓' : '逐仓',
        使用资金: (usdtAvailable * POSITION_SIZE_PCT).toFixed(2) + ' USDT',
        币数量: coinSize,
        当前价格: currentPrice.toFixed(2)
      });
      
      if (parseFloat(coinSize) <= 0) {
        log(LOG_LEVELS.WARN, '计算到的币数量为 0，跳过下单');
        return;
      }
      
      // 构建开仓订单（币币杠杆）
      const side = signal === 'long' ? 'buy' : 'sell';
      const order = {
        instId: SYMBOL,
        tdMode: MARGIN_MODE,
        side: side,
        ordType: 'market',
        sz: signal =='long'?coinSize*currentPrice:coinSize,
        ccy: 'USDT' // 保证金币种
      }
      
      log(LOG_LEVELS.INFO, `📤 提交开仓订单...`);
      const resp = await placeOrder(order);
      
      if (resp && resp.error) {
        log(LOG_LEVELS.ERROR, '开仓失败', resp);
        botState.errorCount++;
        saveState(botState);
        return;
      }
      
      if (resp && resp.data && Array.isArray(resp.data) && resp.data[0].sCode === '0') {
        log(LOG_LEVELS.SUCCESS, '✅ 开仓成功', { 
          ordId: resp.data[0].ordId,
          signal: signal,
          size: coinSize 
        });
        
        // 获取成交价格
        const entryPrice = parseFloat(resp.data[0].fillPx) || currentPrice;
        
        // 计算止损止盈价格
        let stopPrice, takeProfitPrice;
        if (signal === 'long') {
          // 做多：向下止损3%，向上止盈5%
          stopPrice = entryPrice * (1 - STOP_LOSS_PCT);
          takeProfitPrice = entryPrice * (1 + TAKE_PROFIT_PCT);
        } else {
          // 做空：向上止损3%，向下止盈5%
          stopPrice = entryPrice * (1 + STOP_LOSS_PCT);
          takeProfitPrice = entryPrice * (1 - TAKE_PROFIT_PCT);
        }
        
        log(LOG_LEVELS.INFO, `🎯 止盈止损设置`, {
          入场价: entryPrice.toFixed(2),
          止损价: stopPrice.toFixed(2),
          止盈价: takeProfitPrice.toFixed(2),
          止损幅度: (STOP_LOSS_PCT * 100).toFixed(1) + '%',
          止盈幅度: (TAKE_PROFIT_PCT * 100).toFixed(1) + '%'
        });
        
        const closeSide = signal === 'long' ? 'sell' : 'buy';
        
        // 设置止损单
        const stopLossOrder = {
          instId: SYMBOL,
          tdMode: MARGIN_MODE,
          side: closeSide,
          ordType: 'conditional',
          slTriggerPx: stopPrice.toFixed(2),
          slOrdPx: '-1',
          sz:signal =='long'?coinSize:coinSize*entryPrice,
          reduceOnly: true,
          ccy: 'USDT',
        }
        
        const slResp = await placeAlgoOrder(stopLossOrder);
        let stopLossSuccess = false;
        
        if (slResp && slResp.data && slResp.data[0]?.sCode === '0') {
          log(LOG_LEVELS.SUCCESS, `✅ 止损单已设置 @ ${stopPrice.toFixed(2)}`);
          stopLossSuccess = true;
        } else {
          log(LOG_LEVELS.ERROR, '⚠️ 止损订单提交失败，将启用手动止盈止损保护', slResp);
        }
        
        // 设置止盈单
        const takeProfitOrder = {
          instId: SYMBOL,
          tdMode: MARGIN_MODE,
          side: closeSide,
          ordType: 'conditional',
          tpTriggerPx: takeProfitPrice.toFixed(2),
          tpOrdPx: '-1',
          sz: signal =='long'?coinSize:coinSize*entryPrice,
          reduceOnly: true,
          ccy: 'USDT'
        }
        
        const tpResp = await placeAlgoOrder(takeProfitOrder);
        let takeProfitSuccess = false;
        
        if (tpResp && tpResp.data && tpResp.data[0]?.sCode === '0') {
          log(LOG_LEVELS.SUCCESS, `✅ 止盈单已设置 @ ${takeProfitPrice.toFixed(2)}`);
          takeProfitSuccess = true;
        } else {
          log(LOG_LEVELS.ERROR, '⚠️ 止盈订单提交失败，将启用手动止盈止损保护', tpResp);
        }

        // 检查是否需要启用手动止盈止损模式
        if (!stopLossSuccess || !takeProfitSuccess) {
          log(LOG_LEVELS.WARN, '🔧 启用手动止盈止损模式', {
            止损单状态: stopLossSuccess ? '成功' : '失败',
            止盈单状态: takeProfitSuccess ? '成功' : '失败'
          });
          
          // 启用手动模式
          botState.manualSLTP = {
            enabled: true,
            stopPrice: stopPrice,
            takeProfitPrice: takeProfitPrice,
            entryPrice: entryPrice,
            signal: signal
          };
        } else {
          log(LOG_LEVELS.SUCCESS, '✅ 自动止盈止损订单设置完成');
          
          // 确保手动模式处于关闭状态
          botState.manualSLTP = {
            enabled: false,
            stopPrice: null,
            takeProfitPrice: null,
            entryPrice: null,
            signal: null
          };
        }
        
        // 更新状态
        botState.lastTradeTime = new Date().toISOString();
        botState.currentPosition = {
          posSide: signal,
          size: coinSize,
          entryPrice: entryPrice,
          instId: SYMBOL
        };
        botState.errorCount = 0;
        saveState(botState);
        
      } else {
        log(LOG_LEVELS.WARN, '下单响应非成功', resp);
        botState.errorCount++;
        saveState(botState);
      }
    }
    
  } catch (e) {
    log(LOG_LEVELS.ERROR, '主循环错误', {
      message: e.message,
      stack: e.stack
    });
    botState.errorCount++;
    saveState(botState);
    
    if (botState.errorCount > 5) {
      log(LOG_LEVELS.WARN, `连续错误 ${botState.errorCount} 次，等待 60 秒后继续...`);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

// === 优雅退出处理 ===
process.on('SIGINT', async () => {
  log(LOG_LEVELS.INFO, '接收到 SIGINT 信号，准备退出...');
  
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

// === 初始化并启动 ===
async function initBot() {
  try {
    log(LOG_LEVELS.INFO, '========================================');
    log(LOG_LEVELS.INFO, '🤖 OKX 高低点突破策略机器人启动中...');
    log(LOG_LEVELS.INFO, '📌 交易模式: 币币杠杆（Margin Trading）');
    log(LOG_LEVELS.INFO, '========================================');
    
    // 检测账户持仓模式（币币杠杆固定为单向持仓）
    const config = await getAccountConfig();
    if (config && config.data && config.data.length > 0) {
      posMode = config.data[0].posMode || 'net_mode';
      log(LOG_LEVELS.INFO, `✅ 账户持仓模式: ${posMode === 'long_short_mode' ? '双向' : '单向'}`);
    } else {
      log(LOG_LEVELS.WARN, '⚠️ 使用默认持仓模式: 单向');
    }
    
    log(LOG_LEVELS.INFO, `📊 策略参数`, {
      交易类型: '币币杠杆',
      交易对: SYMBOL,
      杠杆: LEVERAGE + 'x',
      保证金模式: MARGIN_MODE === 'cross' ? '全仓' : '逐仓',
      回溯周期: LOOKBACK_HOURS + '小时',
      仓位比例: (POSITION_SIZE_PCT * 100) + '%',
      止盈: (TAKE_PROFIT_PCT * 100) + '%',
      止损: (STOP_LOSS_PCT * 100) + '%',
      检测间隔: (POLL_INTERVAL_MS / 1000 / 60) + '分钟'
    });
    
    if (botState.currentPosition) {
      log(LOG_LEVELS.INFO, `📌 恢复持仓: ${botState.currentPosition.posSide} ${botState.currentPosition.size} 币 @ ${botState.currentPosition.entryPrice}`);
      
      // 如果启用了手动止盈止损模式，显示相关信息
      if (botState.manualSLTP && botState.manualSLTP.enabled) {
        log(LOG_LEVELS.WARN, `🔧 手动止盈止损模式已启用`, {
          止损价: botState.manualSLTP.stopPrice?.toFixed(4),
          止盈价: botState.manualSLTP.takeProfitPrice?.toFixed(4),
          入场价: botState.manualSLTP.entryPrice?.toFixed(4)
        });
      }
    }
    
    // 立即执行一次
    await mainLoop();
    
    // 开始定时循环
    setInterval(mainLoop, POLL_INTERVAL_MS);
    
  } catch (err) {
    log(LOG_LEVELS.ERROR, '初始化失败', { error: err.message });
    process.exit(1);
  }
}

// 启动机器人
initBot();

