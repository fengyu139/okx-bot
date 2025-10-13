/**
 * PM2 配置文件 - K线趋势反转策略
 * 
 * 策略说明：
 * - 每5分钟检测一次
 * - 判断最近5根10分钟K线
 * - 5根都上涨 → 做空（逆势）
 * - 5根都下跌 → 做多（逆势）
 * - 止盈3%，止损2%
 * 
 * 使用方法：
 * pm2 start ecosystem.reverse.config.js
 * pm2 logs reverse-btc
 * pm2 stop ecosystem.reverse.config.js
 */

module.exports = {
  apps: [
    {
      name: 'reverse-btc',
      script: './okxReverseBot.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        SYMBOL: 'BTC-USDT-SWAP',
        LEVERAGE: '10',              // 10倍杠杆
        POLL_INTERVAL_MS: '300000',  // 5分钟检测一次
        KLINE_COUNT: '5',            // 判断5根K线
        POSITION_SIZE_PCT: '0.5',    // 50%仓位
        TAKE_PROFIT_PCT: '0.03',     // 3%止盈
        STOP_LOSS_PCT: '0.02'        // 2%止损
      },
      error_file: './logs/reverse-btc-error.log',
      out_file: './logs/reverse-btc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'reverse-eth',
      script: './okxReverseBot.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        SYMBOL: 'ETH-USDT-SWAP',
        LEVERAGE: '10',
        POLL_INTERVAL_MS: '300000',
        KLINE_COUNT: '5',
        POSITION_SIZE_PCT: '0.5',
        TAKE_PROFIT_PCT: '0.03',
        STOP_LOSS_PCT: '0.02'
      },
      error_file: './logs/reverse-eth-error.log',
      out_file: './logs/reverse-eth-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'reverse-doge',
      script: './okxReverseBot.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        SYMBOL: 'DOGE-USDT-SWAP',
        LEVERAGE: '10',
        POLL_INTERVAL_MS: '300000',
        KLINE_COUNT: '5',
        POSITION_SIZE_PCT: '0.5',
        TAKE_PROFIT_PCT: '0.03',
        STOP_LOSS_PCT: '0.02'
      },
      error_file: './logs/reverse-doge-error.log',
      out_file: './logs/reverse-doge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};

