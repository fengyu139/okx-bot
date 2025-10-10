module.exports = {
  apps: [
    {
      name: 'okx-bot-pepe',
      script: './okxNewBot.js',
      env: {
        SYMBOL: 'PEPE-USDT-SWAP',
        STARTING_CAPITAL: '1000',
        RISK_PER_TRADE: '0.01',
        LEVERAGE: '10',
        SHORT_SMA_PERIOD: '7',
        LONG_SMA_PERIOD: '25',
        POLL_INTERVAL_MS: '25000',
        MIN_VOLATILITY: '0.0005',      // 0.05%
        MIN_ATR_RATIO: '0.001',        // 0.2%
        MIN_PRICE_CHANGE: '0.001',     // 0.3%
        MIN_VOLUME_RATIO: '1.2'        // 1.3x
      },
      error_file: './logs/PEPE-error.log',
      out_file: './logs/PEPE-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M'
    },
    {
      name: 'okx-bot-doge',
      script: './okxNewBot.js',
      env: {
        SYMBOL: 'DOGE-USDT-SWAP',
        STARTING_CAPITAL: '1000',
        RISK_PER_TRADE: '0.01',
        LEVERAGE: '10',
        SHORT_SMA_PERIOD: '7',
        LONG_SMA_PERIOD: '25',
        POLL_INTERVAL_MS: '30000',
        // 🔥 DOGE 专属配置：降低阈值以适应小市值币种
        MIN_VOLATILITY: '0.0003',      // 0.03% - DOGE波动较小
        MIN_ATR_RATIO: '0.001',        // 0.1% - 降低ATR要求
        MIN_PRICE_CHANGE: '0.001',     // 0.1% - 降低价格变化要求（从0.3%降至0.1%）
        MIN_VOLUME_RATIO: '1.2'        // 1.2x - 稍微放宽成交量要求
      },
      error_file: './logs/doge-error.log',
      out_file: './logs/doge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M'
    },
    {
      name: 'okx-bot-sol',
      script: './okxNewBot.js',
      env: {
        SYMBOL: 'SOL-USDT-SWAP',
        STARTING_CAPITAL: '1000',
        RISK_PER_TRADE: '0.01',
        LEVERAGE: '10',
        SHORT_SMA_PERIOD: '7',
        LONG_SMA_PERIOD: '25',
        POLL_INTERVAL_MS: '35000',
        MIN_VOLATILITY: '0.0003',      // 0.03% - DOGE波动较小
        MIN_ATR_RATIO: '0.001',        // 0.1% - 降低ATR要求
        MIN_PRICE_CHANGE: '0.001',     // 0.1% - 降低价格变化要求（从0.3%降至0.1%）
        MIN_VOLUME_RATIO: '1.2'        // 1.2x - 稍微放宽成交量要求
      },
      error_file: './logs/sol-error.log',
      out_file: './logs/sol-out.log',
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

