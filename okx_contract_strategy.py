# -*- coding: utf-8 -*-
"""
OKX 永续合约策略：8 小时涨跌超 7% 反向开单，止盈 6%，止损 5%。

规则：
- 最近 8 小时内涨幅 >= 7% -> 开空，10 倍杠杆，仓位 = 账户余额的 2/3（名义价值）
- 最近 8 小时内跌幅 >= 7% -> 开多，10 倍杠杆，仓位 = 账户余额的 2/3
- 止盈 6%，止损 5%（按开仓价计算）

依赖：.env 配置 OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE，pip install python-okx python-dotenv
"""
import json
import os
import time
from typing import Optional, List, Dict, Tuple

from dotenv import load_dotenv
import okx.Account as Account
import okx.MarketData as MarketData
import okx.Trade as Trade

load_dotenv()

API_KEY = os.getenv("OKX_API_KEY")
API_SECRET = os.getenv("OKX_SECRET_KEY")
API_PASSPHRASE = os.getenv("OKX_PASSPHRASE")
OKX_ENV_FLAG = os.getenv("OKX_ENV_FLAG", "1")
OKX_PUBLIC_BASE = os.getenv("OKX_BASE_URL", "https://www.okx.com")

account_api: Optional[Account.AccountAPI] = None
market_api: Optional[MarketData.MarketAPI] = None
trade_api: Optional[Trade.TradeAPI] = None


def log(msg: str):
    from datetime import datetime
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def init_okx_sdk():
    global account_api, market_api, trade_api
    if not (API_KEY and API_SECRET and API_PASSPHRASE):
        raise RuntimeError("环境变量缺失：OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE 必须配置")
    account_api = Account.AccountAPI(
        api_key=API_KEY,
        api_secret_key=API_SECRET,
        passphrase=API_PASSPHRASE,
        flag=OKX_ENV_FLAG,
        debug=False,
    )
    market_api = MarketData.MarketAPI(flag=OKX_ENV_FLAG)
    trade_api = Trade.TradeAPI(
        api_key=API_KEY,
        api_secret_key=API_SECRET,
        passphrase=API_PASSPHRASE,
        flag=OKX_ENV_FLAG,
        debug=False,
    )


def get_ticker(inst_id: str) -> float:
    if market_api is None:
        raise RuntimeError("market_api 未初始化")
    resp = market_api.get_ticker(inst_id)
    if resp.get("code") != "0":
        raise RuntimeError(f"ticker error {resp.get('code')}: {resp.get('msg')}")
    return float(resp["data"][0]["last"])


def get_account_balance(ccy: str = "USDT") -> float:
    if account_api is None:
        raise RuntimeError("account_api 未初始化")
    data = account_api.get_account_balance(ccy)
    details = data["data"][0]["details"]
    for item in details:
        if item["ccy"] == ccy:
            return float(item["availBal"])
    return 0.0


def get_candles_8h(inst_id: str) -> List[float]:
    """
    返回最近 8 小时内每根 1H K 线的收盘价列表（从新到旧）。
    [0]=最新一根收盘，[1]=1小时前，...，[8]=8小时前。共 9 个价格。
    """
    url = f"{OKX_PUBLIC_BASE}/api/v5/market/candles?instId={inst_id}&bar=1H&limit=9"
    # 为兼容老系统的 OpenSSL 版本，这里只使用标准库 urllib，不再回退到 requests/urllib3
    try:
        from urllib.request import urlopen
        with urlopen(url, timeout=10) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        log(f"获取 8H K 线失败: {e}")
        raise
    if data.get("code") != "0" or not data.get("data") or len(data["data"]) < 9:
        raise RuntimeError("8H K 线数据不足")
    # 倒序：data[0]=最新一根，data[8]=8小时前；每根 [4] 为收盘价
    closes = [float(c[4]) for c in data["data"]]
    return closes


def get_contract_value(inst_id: str) -> float:
    """获取合约面值（每张合约对应的标的数量，如 DOGE 为 10）。"""
    url = f"{OKX_PUBLIC_BASE}/api/v5/public/instruments?instType=SWAP&instId={inst_id}"
    # 同样只使用 urllib，避免触发 urllib3 对旧 OpenSSL 的限制
    try:
        from urllib.request import urlopen
        with urlopen(url, timeout=10) as r:
            data = json.loads(r.read().decode())
    except Exception:
        return 10.0  # 常见 DOGE 等为 10
    if data.get("code") != "0" or not data.get("data"):
        return 10.0
    ct_val = data["data"][0].get("ctVal", "10")
    return float(ct_val)


def set_leverage(inst_id: str, leverage: int):
    if account_api is None:
        return
    try:
        account_api.set_leverage(instId=inst_id, lever=str(leverage), mgnMode="cross")
        log(f"设置杠杆 {inst_id} -> {leverage}x")
    except Exception as e:
        log(f"设置杠杆失败: {e}")


def get_positions(inst_id: str) -> List[Dict]:
    if account_api is None:
        return []
    try:
        data = account_api.get_positions(instType="SWAP", instId=inst_id)
        return data.get("data", [])
    except Exception as e:
        log(f"获取持仓失败: {e}")
        return []


def place_market_order(inst_id: str, side: str, sz: float) -> Dict:
    """市价开仓。side: buy 开多 / sell 开空。sz 为合约张数。"""
    if trade_api is None:
        raise RuntimeError("trade_api 未初始化")
    data = trade_api.place_order(
        instId=inst_id,
        tdMode="cross",
        side=side,
        ordType="market",
        sz=str(int(sz)),
    )
    return data


def close_position_market(inst_id: str, side: str, sz: float) -> Dict:
    """市价平仓。side: 平多用 sell，平空用 buy。sz 为合约张数。"""
    if trade_api is None:
        raise RuntimeError("trade_api 未初始化")
    data = trade_api.place_order(
        instId=inst_id,
        tdMode="cross",
        side=side,
        ordType="market",
        sz=str(int(sz)),
        reduceOnly=True,
    )
    return data


# --------------- 策略参数 ---------------
INST_ID = "DOGE-USDT-SWAP"
LOOKBACK_HOURS = 8
THRESHOLD_PCT = 7.0
LEVERAGE = 10
BALANCE_RATIO = 2 / 3
TP_PCT = 6.0
SL_PCT = 5.0
CHECK_INTERVAL_SEC = 60


def notional_to_contracts(notional_usdt: float, price: float, ct_val: float) -> float:
    """名义价值 USDT -> 合约张数。notional = sz * ct_val * price => sz = notional / (ct_val * price)"""
    if price <= 0:
        return 0
    return notional_usdt / (ct_val * price)


def run_once():
    balance = get_account_balance("USDT")
    price_now = get_ticker(INST_ID)
    ct_val = get_contract_value(INST_ID)
    positions = get_positions(INST_ID)
    # 只处理当前交易对、有持仓量的
    pos = next((p for p in positions if p.get("instId") == INST_ID and float(p.get("pos", 0) or 0) != 0), None)

    if pos:
        # 已有持仓：只做止盈止损检查。净持仓下 pos>0 为多，pos<0 为空
        avg_px = float(pos.get("avgPx", 0))
        pos_raw = float(pos.get("pos", 0))
        pos_sz = abs(int(pos_raw))
        pos_side = "long" if pos_raw > 0 else "short"
        if pos_sz <= 0:
            return
        mark_px = float(pos.get("markPx", 0)) or price_now
        if pos_side == "long":
            tp_px = avg_px * (1 + TP_PCT / 100)
            sl_px = avg_px * (1 - SL_PCT / 100)
            if mark_px >= tp_px:
                log(f"多单止盈: 当前 {mark_px:.4f} >= TP {tp_px:.4f}")
                close_position_market(INST_ID, "sell", pos_sz)
                return
            if mark_px <= sl_px:
                log(f"多单止损: 当前 {mark_px:.4f} <= SL {sl_px:.4f}")
                close_position_market(INST_ID, "sell", pos_sz)
                return
        else:
            tp_px = avg_px * (1 - TP_PCT / 100)
            sl_px = avg_px * (1 + SL_PCT / 100)
            if mark_px <= tp_px:
                log(f"空单止盈: 当前 {mark_px:.4f} <= TP {tp_px:.4f}")
                close_position_market(INST_ID, "buy", pos_sz)
                return
            if mark_px >= sl_px:
                log(f"空单止损: 当前 {mark_px:.4f} >= SL {sl_px:.4f}")
                close_position_market(INST_ID, "buy", pos_sz)
                return
        # 打印详细持仓信息
        tp_px = avg_px * (1 + TP_PCT / 100) if pos_side == "long" else avg_px * (1 - TP_PCT / 100)
        sl_px = avg_px * (1 - SL_PCT / 100) if pos_side == "long" else avg_px * (1 + SL_PCT / 100)
        upl = float(pos.get("upl", 0) or 0)
        upl_ratio = float(pos.get("uplRatio", 0) or 0) * 100
        liq_px = pos.get("liqPx") or ""
        lever = pos.get("lever", "")
        margin = pos.get("margin", "")
        mgn_ratio = pos.get("mgnRatio", "")
        return

    # 无持仓：当前价与最近 8 小时内「每一小时」的收盘价比较，任一小时满足 ±7% 即触发
    try:
        hourly_closes = get_candles_8h(INST_ID)
    except Exception as e:
        log(f"跳过本周期: {e}")
        return
    # 当前价与最近 8 小时内每一根小时收盘价比较，任一小时满足 ±7% 即触发
    should_short = False
    should_long = False
    for i, close_i in enumerate(hourly_closes):
        if close_i <= 0:
            continue
        change_pct = (price_now - close_i) / close_i * 100
        if change_pct >= THRESHOLD_PCT:
            should_short = True
            log(f"当前价 {price_now:.4f} 相对第 {i} 根(约 {i}h 前)收盘 {close_i:.4f} 涨幅 {change_pct:+.2f}% >= {THRESHOLD_PCT}% -> 满足开空")
        if change_pct <= -THRESHOLD_PCT:
            should_long = True
            log(f"当前价 {price_now:.4f} 相对第 {i} 根(约 {i}h 前)收盘 {close_i:.4f} 跌幅 {change_pct:+.2f}% <= -{THRESHOLD_PCT}% -> 满足开多")
    if not should_short and not should_long:
        min_c, max_c = min(hourly_closes), max(hourly_closes)
        log(f"近 {LOOKBACK_HOURS} 小时: 当前={price_now:.4f} 区间=[{min_c:.4f}, {max_c:.4f}] 未达 ±{THRESHOLD_PCT}%")

    # 保证金 = 账户余额的 2/3；实际仓位名义价值 = 保证金 × 杠杆（10 倍）
    margin = balance * BALANCE_RATIO
    notional = margin * LEVERAGE
    sz = notional_to_contracts(notional, price_now, ct_val)
    if sz < 1:
        log("计算张数不足 1，跳过开仓")
        return

    set_leverage(INST_ID, LEVERAGE)

    # 若同时满足多空条件，优先开空（可改为优先开多或按其他规则）
    if should_short:
        log(f"触发开空，保证金≈{margin:.0f} USDT x{LEVERAGE}倍 -> 名义≈{notional:.0f} USDT，张数={sz:.0f}")
        res = place_market_order(INST_ID, "sell", sz)
        if res.get("code") == "0":
            log("开空成功")
        else:
            log(f"开空失败: {res}")
    elif should_long:
        log(f"触发开多，保证金≈{margin:.0f} USDT x{LEVERAGE}倍 -> 名义≈{notional:.0f} USDT，张数={sz:.0f}")
        res = place_market_order(INST_ID, "buy", sz)
        if res.get("code") == "0":
            log("开多成功")
        else:
            log(f"开多失败: {res}")


def main():
    try:
        init_okx_sdk()
    except Exception as e:
        log(f"初始化失败: {e}")
        return
    log("OKX 合约策略启动：8H 涨跌超 7% 反向开单，止盈 6%，止损 5%")
    while True:
        try:
            run_once()
        except Exception as e:
            log(f"本轮异常: {e}")
        time.sleep(CHECK_INTERVAL_SEC)


if __name__ == "__main__":
    main()
