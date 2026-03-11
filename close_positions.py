# -*- coding: utf-8 -*-
"""
一键平掉当前 OKX 永续合约持仓。
使用与 okx_contract_strategy 相同的 .env，默认平掉 DOGE-USDT-SWAP，可选平掉全部 SWAP。
用法: python close_positions.py
      python close_positions.py --all   # 平掉所有 SWAP 持仓
"""
import sys
from typing import Optional, List, Dict

from dotenv import load_dotenv
import okx.Account as Account
import okx.Trade as Trade

load_dotenv()

API_KEY = __import__("os").getenv("OKX_API_KEY")
API_SECRET = __import__("os").getenv("OKX_SECRET_KEY")
API_PASSPHRASE = __import__("os").getenv("OKX_PASSPHRASE")
OKX_ENV_FLAG = __import__("os").getenv("OKX_ENV_FLAG", "1")

account_api: Optional[Account.AccountAPI] = None
trade_api: Optional[Trade.TradeAPI] = None


def log(msg: str):
    from datetime import datetime
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")


def init_sdk():
    global account_api, trade_api
    if not (API_KEY and API_SECRET and API_PASSPHRASE):
        raise RuntimeError("请配置 .env: OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE")
    account_api = Account.AccountAPI(
        api_key=API_KEY,
        api_secret_key=API_SECRET,
        passphrase=API_PASSPHRASE,
        flag=OKX_ENV_FLAG,
        debug=False,
    )
    trade_api = Trade.TradeAPI(
        api_key=API_KEY,
        api_secret_key=API_SECRET,
        passphrase=API_PASSPHRASE,
        flag=OKX_ENV_FLAG,
        debug=False,
    )


def get_all_swap_positions() -> List[Dict]:
    if account_api is None:
        return []
    try:
        data = account_api.get_positions(instType="SWAP")
        return data.get("data", [])
    except Exception as e:
        log(f"获取持仓失败: {e}")
        return []


def close_one(inst_id: str, pos_raw: float) -> bool:
    """平掉一条持仓。pos_raw>0 为多，用 sell 平；pos_raw<0 为空，用 buy 平。"""
    if trade_api is None:
        return False
    sz = abs(int(pos_raw))
    side = "sell" if pos_raw > 0 else "buy"
    try:
        data = trade_api.place_order(
            instId=inst_id,
            tdMode="cross",
            side=side,
            ordType="market",
            sz=str(sz),
            reduceOnly=True,
        )
        if data.get("code") == "0":
            log(f"已平仓: {inst_id} {side} {sz} 张")
            return True
        log(f"平仓失败 {inst_id}: {data}")
        return False
    except Exception as e:
        log(f"平仓异常 {inst_id}: {e}")
        return False


def main():
    init_sdk()
    close_all = "--all" in sys.argv
    target_inst = "DOGE-USDT-SWAP"  # 默认只平 DOGE
    positions = get_all_swap_positions()
    to_close = [p for p in positions if float(p.get("pos", 0) or 0) != 0]
    if close_all:
        to_close = to_close
    else:
        to_close = [p for p in to_close if p.get("instId") == target_inst]

    if not to_close:
        log("没有需要平掉的持仓。" if close_all else f"没有 {target_inst} 的持仓需要平掉。")
        return

    log(f"共 {len(to_close)} 条持仓待平仓。")
    for p in to_close:
        inst_id = p.get("instId", "")
        pos_raw = float(p.get("pos", 0))
        close_one(inst_id, pos_raw)
    log("平仓指令已发送。")


if __name__ == "__main__":
    main()
