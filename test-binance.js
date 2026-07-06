const https = require('https');

const binanceData = JSON.stringify({
  page: 1,
  rows: 5,
  payTypes: [],
  countries: [],
  publisherType: null,
  asset: "USDT",
  fiat: "VES",
  tradeType: "SELL"
});

const binanceOptions = {
  hostname: 'p2p.binance.com',
  path: '/bapi/c2c/v2/friendly/c2c/adv/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(binanceData)
  }
};

const reqBinance = https.request(binanceOptions, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
      const parsed = JSON.parse(body);
      console.log('Binance First Ad Price:', parsed.data?.[0]?.adv?.price);
  });
});
reqBinance.write(binanceData);
reqBinance.end();
