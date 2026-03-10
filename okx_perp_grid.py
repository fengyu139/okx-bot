import os
import time
from datetime import datetime
from typing import Optional, List, Dict

from dotenv import load_dotenv
import okx.Account as Account
import okx.MarketData as MarketData
import okx.Trade as Trade


"""
OKX 永续网格策略（Python 版本）

使用说明（简要）：
1. 在项目根目录准备 .env 文件（可以复用你现在 JS 机器人用的环境变量）：
   OKX_API_KEY=你的key
   OKX_SECRET_KEY=你的secret
   OKX_PASSPHRASE=你的passphrase
   OKX_BASE_URL=https://www.okx.com

2. 根据需要修改下面 CONFIG 中的参数（交易对、网格区间、网格数量、总投资等）。

3. 安装依赖：
   pip install -r requirements.txt

4. 运行：
   python okx_perp_grid.py

本策略为示例级别实现，侧重结构清晰、方便你在此基础上调参与扩展，
请务必在小资金、模拟盘或单币种上先充分测试。
"""


load_dotenv()


API_KEY = os.getenv("OKX_API_KEY")
API_SECRET = os.getenv("OKX_SECRET_KEY")
API_PASSPHRASE = os.getenv("OKX_PASSPHRASE")

# 0: 实盘, 1: 模拟盘（与官方示例保持一致：flag = "1" 为 demo）
OKX_ENV_FLAG = os.getenv("OKX_ENV_FLAG", "1")

account_api: Optional[Account.AccountAPI] = None
market_api: Optional[MarketData.MarketAPI] = None
trade_api: Optional[Trade.TradeAPI] = None


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def init_okx_sdk():
    """
    初始化 python-okx SDK 的 Account / Market / Trade 客户端
    """
    global account_api, market_api, trade_api
    log(OKX_ENV_FLAG)
    if not (API_KEY and API_SECRET and API_PASSPHRASE):
        raise RuntimeError("环境变量缺失：OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE 必须配置")

    # debug=False 表示不输出 SDK 调试日志，flag: 0 实盘，1 模拟盘
    account_api = Account.AccountAPI(API_KEY, API_SECRET, API_PASSPHRASE, False, OKX_ENV_FLAG)
    market_api = MarketData.MarketAPI(flag=OKX_ENV_FLAG)
    trade_api = Trade.TradeAPI(API_KEY, API_SECRET, API_PASSPHRASE, False, OKX_ENV_FLAG)


def get_ticker(inst_id: str) -> float:
    if market_api is None:
        raise RuntimeError("market_api 未初始化，请先调用 init_okx_sdk()")
    resp = market_api.get_ticker(inst_id)
    if resp.get("code") != "0":
        raise RuntimeError(f"ticker error {resp.get('code')}: {resp.get('msg')}")
    return float(resp["data"][0]["last"])


def get_account_balance(ccy: str = "USDT") -> float:
    if account_api is None:
        raise RuntimeError("account_api 未初始化，请先调用 init_okx_sdk()")
    data = account_api.get_account_balance(ccy)
    details = data["data"][0]["details"]
    for item in details:
        if item["ccy"] == ccy:
            return float(item["availBal"])
    return 0.0


def get_open_orders(inst_id: str) -> List[Dict]:
    if trade_api is None:
        raise RuntimeError("trade_api 未初始化，请先调用 init_okx_sdk()")
    # instType 使用 SWAP，过滤该合约的未成交订单
    data = trade_api.get_orders_pending(instType="SWAP", instId=inst_id)
    return data.get("data", [])


def cancel_order(inst_id: str, ord_id: str):
    if trade_api is None:
        raise RuntimeError("trade_api 未初始化，请先调用 init_okx_sdk()")
    data = trade_api.cancel_order(instId=inst_id, ordId=ord_id)
    log(f"取消订单成功 instId={inst_id} ordId={ord_id} resp={data}")


def place_limit_order(inst_id: str, side: str, px: float, sz: float, leverage: int = 5) -> dict:
    """
    side: buy / sell
    px:   限价
    sz:   合约张数（注意 OKX 合约面值，实际下单前请根据品种调整）
    """
    if trade_api is None:
        raise RuntimeError("trade_api 未初始化，请先调用 init_okx_sdk()")
    data = trade_api.place_order(
        instId=inst_id,
        tdMode="cross",
        side=side,
        ordType="limit",
        px=str(px),
        sz=str(sz),
        lever=str(leverage),
    )
    log(f"下单成功 side={side} px={px} sz={sz} resp={data}")
    return data


class GridConfig:
    def __init__(
        self,
        inst_id: str = "DOGE-USDT-SWAP",
        lower_price: float = 0.15,
        upper_price: float = 0.18,
        grid_num: int = 20,
        total_usdt: float = 200.0,
        leverage: int = 5,
        check_interval_sec: int = 20,
    ):
        self.inst_id = inst_id
        self.lower_price = lower_price
        self.upper_price = upper_price
        self.grid_num = grid_num
        self.total_usdt = total_usdt
        self.leverage = leverage
        self.check_interval_sec = check_interval_sec


class PerpGridBot:
    """
    非高频、简化版永续网格：
    - 在价格区间 [lower_price, upper_price] 均匀划分网格
    - 下方网格挂 buy 限价单，上方网格挂 sell 限价单
    - 成交后，在相邻网格再挂反向单，形成“低买高卖”循环
    """

    def __init__(self, config: GridConfig):
        self.cfg = config
        self.grid_prices = self._build_grid_prices()
        # 记录每条网格当前挂单的 ordId，便于后续检查 / 取消 / 重新挂单
        self.order_map: Dict[float, Dict] = {}

    def _build_grid_prices(self) -> List[float]:
        step = (self.cfg.upper_price - self.cfg.lower_price) / self.cfg.grid_num
        prices = [round(self.cfg.lower_price + i * step, 6) for i in range(self.cfg.grid_num + 1)]
        log(f"生成网格价格 {len(prices)} 条，从 {prices[0]} 到 {prices[-1]}，步长 {step:.6f}")
        return prices

    def _calc_size_per_grid(self, last_price: float) -> float:
        """
        这里使用一个非常保守的估算方式：
        假设面值≈1 USDT，按 total_usdt / grid_num 再适当折扣。
        实盘前请根据 OKX 合约规格微调。
        """
        usdt_per_grid = self.cfg.total_usdt / max(self.cfg.grid_num, 1)
        est_contract_value = last_price  # 假设每张≈1 个标的
        if est_contract_value <= 0:
            est_contract_value = 1
        sz = max(usdt_per_grid / est_contract_value, 1)
        return round(sz, 0)

    def init_grid_orders(self):
        last_price = get_ticker(self.cfg.inst_id)
        balance = get_account_balance("USDT")
        log(f"当前价格: {last_price}, 可用 USDT: {balance}")

        size = self._calc_size_per_grid(last_price)
        log(f"估算每个网格下单张数: {size}")

        # 先取消该交易对已有挂单（可选）
        try:
            open_orders = get_open_orders(self.cfg.inst_id)
            for o in open_orders:
                cancel_order(self.cfg.inst_id, o["ordId"])
            if open_orders:
                log(f"已尝试取消原有挂单数量: {len(open_orders)}")
        except Exception as e:
            log(f"取消原有挂单时出错（忽略继续）: {e}")

        for px in self.grid_prices:
            if px < last_price:
                side = "buy"
            elif px > last_price:
                side = "sell"
            else:
                # 正好在当前价附近的网格，略过
                continue
            try:
                resp = place_limit_order(self.cfg.inst_id, side, px, size, self.cfg.leverage)
                ord_id = resp["data"][0]["ordId"]
                self.order_map[px] = {"side": side, "ordId": ord_id}
                log(f"初始化网格单: px={px}, side={side}, ordId={ord_id}")
            except Exception as e:
                log(f"初始化网格单失败 px={px} side={side} err={e}")

    def sync_orders(self):
        """
        简化版检查：
        - 查询当前挂单列表
        - 若某价格网格订单已不在挂单列表，则认为该网格已成交
          -> 在相邻网格方向上重新挂反向单
        """
        try:
            open_orders = get_open_orders(self.cfg.inst_id)
        except Exception as e:
            log(f"获取挂单失败，稍后重试: {e}")
            return

        open_ids = {o["ordId"] for o in open_orders}

        last_price = get_ticker(self.cfg.inst_id)
        size = self._calc_size_per_grid(last_price)

        for px, info in list(self.order_map.items()):
            ord_id = info["ordId"]
            side = info["side"]
            if ord_id not in open_ids:
                # 认为该网格订单已经成交
                log(f"检测到网格成交 px={px} side={side} ordId={ord_id}")

                # 找到在价格轴上的“对称网格” price'
                idx = self.grid_prices.index(px)
                if side == "buy" and idx + 1 < len(self.grid_prices):
                    new_px = self.grid_prices[idx + 1]
                    new_side = "sell"
                elif side == "sell" and idx - 1 >= 0:
                    new_px = self.grid_prices[idx - 1]
                    new_side = "buy"
                else:
                    # 已经在边界网格，暂不继续扩展
                    log(f"px={px} 在边界，跳过继续补单")
                    self.order_map.pop(px, None)
                    continue

                try:
                    resp = place_limit_order(self.cfg.inst_id, new_side, new_px, size, self.cfg.leverage)
                    new_id = resp["data"][0]["ordId"]
                    self.order_map[new_px] = {"side": new_side, "ordId": new_id}
                    log(f"补单成功 new_px={new_px} side={new_side} ordId={new_id}")
                except Exception as e:
                    log(f"补单失败 new_px={new_px} side={new_side} err={e}")

                # 当前网格记录可以删掉
                self.order_map.pop(px, None)

    def run_forever(self):
        log("启动永续网格策略……")
        self.init_grid_orders()
        while True:
            try:
                self.sync_orders()
            except Exception as e:
                log(f"主循环异常: {e}")
            time.sleep(self.cfg.check_interval_sec)


def main():
    try:
        init_okx_sdk()
    except Exception as e:
        log(f"初始化 OKX SDK 失败: {e}")
        return

    # 你可以在这里根据需要改参数
    cfg = GridConfig(
        inst_id="DOGE-USDT-SWAP",   # 永续合约交易对
        lower_price=0.15,           # 网格下边界
        upper_price=0.18,           # 网格上边界
        grid_num=20,                # 网格数量
        total_usdt=200,             # 计划投入 USDT 总量（估算用）
        leverage=5,                 # 杠杆倍数
        check_interval_sec=20,      # 轮询检查间隔（秒）
    )

    bot = PerpGridBot(cfg)
    bot.run_forever()


if __name__ == "__main__":
    main()

