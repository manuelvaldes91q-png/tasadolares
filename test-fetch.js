const https = require('https');

// Test Binance P2P
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
    'Content-Length': binanceData.length
  }
};

const reqBinance = https.request(binanceOptions, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log('Binance First Ad Price:', parsed.data?.[0]?.adv?.price);
    } catch (e) {
      console.log('Binance failed to parse');
    }
  });
});
reqBinance.write(binanceData);
reqBinance.end();

// Test SaldoAR
https.get('https://saldo.com.ar/api/calculator?envio=zelle&recibo=banco_ves', (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log('SaldoAR response (first 200 chars):', body.substring(0, 200));
    });
}).on('error', (e) => console.log('SaldoAR fetch error:', e.message));

https.get('https://saldoar.com/cobrar/zelle-a-banco_ves', (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log('SaldoAR HTML (first 200 chars):', body.substring(0, 200));
        // quick regex check
        const match = body.match(/(\d+(?:\.\d+)?)\s*VES/i);
        console.log('Regex match VES:', match ? match[1] : 'none');
    });
});
