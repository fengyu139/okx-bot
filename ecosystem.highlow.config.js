/**
 * PM2 配置文件 - 高低点突破策略
 * 
 * 使用方法：
 * pm2 start ecosystem.highlow.config.js     # 启动所有实例
 * pm2 stop ecosystem.highlow.config.js      # 停止所有实例
 * pm2 restart ecosystem.highlow.config.js   # 重启所有实例
 * pm2 delete ecosystem.highlow.config.js    # 删除所有实例
 * pm2 logs highlow-btc                      # 查看日志
 */

module.exports = {
  apps: [
    {
      name: 'highlow-btc',
      script: './okxHighLowBot.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        SYMBOL: 'BTC-USDT-SWAP',
        LEVERAGE: '10',
        POLL_INTERVAL_MS: '600000',        // 10分钟
        LOOKBACK_HOURS: '12',              // 12小时
        POSITION_SIZE_PCT: '0.5',          // 50%仓位
        TAKE_PROFIT_PCT: '0.05',           // 5%止盈
        STOP_LOSS_PCT: '0.03'              // 3%止损
      },
      error_file: './logs/highlow-btc-error.log',
      out_file: './logs/highlow-btc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'highlow-eth',
      script: './okxHighLowBot.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        SYMBOL: 'ETH-USDT-SWAP',
        LEVERAGE: '10',
        POLL_INTERVAL_MS: '600000',
        LOOKBACK_HOURS: '12',
        POSITION_SIZE_PCT: '0.5',
        TAKE_PROFIT_PCT: '0.05',
        STOP_LOSS_PCT: '0.03'
      },
      error_file: './logs/highlow-eth-error.log',
      out_file: './logs/highlow-eth-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'highlow-sol',
      script: './okxHighLowBot.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        SYMBOL: 'SOL-USDT-SWAP',
        LEVERAGE: '10',
        POLL_INTERVAL_MS: '600000',
        LOOKBACK_HOURS: '12',
        POSITION_SIZE_PCT: '0.5',
        TAKE_PROFIT_PCT: '0.05',
        STOP_LOSS_PCT: '0.03'
      },
      error_file: './logs/highlow-sol-error.log',
      out_file: './logs/highlow-sol-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
    // 可以继续添加更多币种
    // {
    //   name: 'highlow-doge',
    //   script: './okxHighLowBot.js',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '200M',
    //   env: {
    //     NODE_ENV: 'production',
    //     SYMBOL: 'DOGE-USDT-SWAP',
    //     LEVERAGE: '10',
    //     POLL_INTERVAL_MS: '600000',
    //     LOOKBACK_HOURS: '12',
    //     POSITION_SIZE_PCT: '0.5',
    //     TAKE_PROFIT_PCT: '0.05',
    //     STOP_LOSS_PCT: '0.03'
    //   },
    //   error_file: './logs/highlow-doge-error.log',
    //   out_file: './logs/highlow-doge-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss'
    // }
  ]
};

