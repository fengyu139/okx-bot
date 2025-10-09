module.exports = {
  apps: [
    {
      name: 'okx-bot-btc',
      script: './okxNewBot.js',
      env: {
        SYMBOL: 'BTC-USDT-SWAP',
        STARTING_CAPITAL: '2000',
        RISK_PER_TRADE: '0.01',
        LEVERAGE: '10',
        SHORT_SMA_PERIOD: '7',
        LONG_SMA_PERIOD: '25',
        POLL_INTERVAL_MS: '15000'
      },
      error_file: './logs/btc-error.log',
      out_file: './logs/btc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M'
    },
    {
      name: 'okx-bot-doge',
      script: './okxNewBot.js',
      env: {
        SYMBOL: 'DOGE-USDT-SWAP',
        STARTING_CAPITAL: '2000',
        RISK_PER_TRADE: '0.01',
        LEVERAGE: '10',
        SHORT_SMA_PERIOD: '7',
        LONG_SMA_PERIOD: '25',
        POLL_INTERVAL_MS: '15000'
      },
      error_file: './logs/doge-error.log',
      out_file: './logs/doge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M'
    },
    // {
    //   name: 'okx-bot-eth',
    //   script: './okxNewBot.js',
    //   env: {
    //     SYMBOL: 'ETH-USDT-SWAP',
    //     STARTING_CAPITAL: '1500',
    //     RISK_PER_TRADE: '0.015',
    //     LEVERAGE: '10',
    //     SHORT_SMA_PERIOD: '7',
    //     LONG_SMA_PERIOD: '25',
    //     POLL_INTERVAL_MS: '18000'  // 稍微错开时间避免API冲突
    //   },
    //   error_file: './logs/eth-error.log',
    //   out_file: './logs/eth-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss',
    //   max_memory_restart: '300M'
    // },
    // {
    //   name: 'okx-bot-sol',
    //   script: './okxNewBot.js',
    //   env: {
    //     SYMBOL: 'SOL-USDT-SWAP',
    //     STARTING_CAPITAL: '1000',
    //     RISK_PER_TRADE: '0.02',
    //     LEVERAGE: '10',
    //     SHORT_SMA_PERIOD: '7',
    //     LONG_SMA_PERIOD: '25',
    //     POLL_INTERVAL_MS: '21000'  // 稍微错开时间
    //   },
    //   error_file: './logs/sol-error.log',
    //   out_file: './logs/sol-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss',
    //   max_memory_restart: '300M'
    // }
    // 如需添加更多币种，复制上面的配置并修改 SYMBOL
  ]
};

