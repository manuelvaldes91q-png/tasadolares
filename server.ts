import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import https from "https";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Add JSON parsing middleware
  app.use(express.json());

  // In-memory cache for resilient fallbacks
  const cachedRates = {
    binanceRate: 721.35,
    binanceBuyRate: 721.35, // Compra (user buys USDT, advertiser sells: SELL)
    binanceSellRate: 709.69, // Venta (user sells USDT, advertiser buys: BUY)
    binanceUsdZelleRate: 1.039,
    binanceZelleToVesRate: 792.58,
    saldoRate: 783.66,
    bcvUsdRate: 721.35,
    bcvEurRate: 823.64,
    bcvLastFetchTime: 0,
    venezuelaExchangesRate: 770.0,
    venezuelaExchangesPaypalRate: 735.0,
    venezuelaExchangesCardRate: 735.0,
    timestamp: new Date().toISOString()
  };

  // Health check endpoint for keep-alive services
  app.get("/api/health", (req, res) => {
    res.status(200).send("OK");
  });

  // API route for getting rates
  app.get("/api/rates", async (req, res) => {
    try {
      const amount = parseFloat(req.query.amount as string) || 100;

      // Wrap in try-catch to avoid complete failure if Binance blocks/throttles
      let binanceUsdZelleRate = cachedRates.binanceUsdZelleRate;
      let binanceBuyRate = cachedRates.binanceBuyRate;
      let binanceSellRate = cachedRates.binanceSellRate;

      // Calculate target VES amounts for the refined queries using cached baseline rates
      const currentUsdRate = cachedRates.binanceBuyRate || 720;
      const vesUsdtAmount = amount * currentUsdRate;
      const vesZelleAmount = (amount / (cachedRates.binanceUsdZelleRate || 1.04)) * currentUsdRate;

      let binanceZelleToVesRate = currentUsdRate;

      try {
        const [binanceZelleRes, binanceBuyRes, binanceSellRes, refinedZelleToVesRes] = await Promise.all([
          // Zelle USD -> USDT (tradeType: BUY, asset: USDT, fiat: USD)
          fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              page: 1,
              rows: 5,
              payTypes: ["Zelle"],
              countries: [],
              publisherType: null,
              asset: "USDT",
              fiat: "USD",
              tradeType: "BUY",
              transAmount: amount.toString()
            }),
            signal: AbortSignal.timeout(8000)
          }),
          // Compra de USDT (user pays VES, receives USDT -> advertiser tradeType: SELL)
          fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              page: 1,
              rows: 5,
              payTypes: [],
              countries: [],
              publisherType: null,
              asset: "USDT",
              fiat: "VES",
              tradeType: "SELL",
              transAmount: Math.round(vesUsdtAmount).toString()
            }),
            signal: AbortSignal.timeout(8000)
          }),
          // Venta de USDT (user sells USDT, receives VES -> advertiser tradeType: BUY)
          fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              page: 1,
              rows: 5,
              payTypes: [],
              countries: [],
              publisherType: null,
              asset: "USDT",
              fiat: "VES",
              tradeType: "BUY",
              transAmount: Math.round(vesUsdtAmount).toString()
            }),
            signal: AbortSignal.timeout(8000)
          }),
          // Zelle to VES path (refined Zelle to VES -> advertiser tradeType: SELL)
          fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              page: 1,
              rows: 5,
              payTypes: [],
              countries: [],
              publisherType: null,
              asset: "USDT",
              fiat: "VES",
              tradeType: "SELL",
              transAmount: Math.round(vesZelleAmount).toString()
            }),
            signal: AbortSignal.timeout(8000)
          })
        ]);

        if (binanceZelleRes.ok) {
          const zelleData = await binanceZelleRes.json();
          const parsedZelle = parseFloat(zelleData.data?.[0]?.adv?.price || "0");
          if (parsedZelle > 0) {
            binanceUsdZelleRate = parsedZelle;
            cachedRates.binanceUsdZelleRate = parsedZelle;
          } else {
            // Fallback without amount constraint
            const fallbackZelleRes = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                page: 1,
                rows: 5,
                payTypes: ["Zelle"],
                countries: [],
                publisherType: null,
                asset: "USDT",
                fiat: "USD",
                tradeType: "BUY"
              }),
              signal: AbortSignal.timeout(5000)
            });
            if (fallbackZelleRes.ok) {
              const fallbackZelleData = await fallbackZelleRes.json();
              const parsedFallback = parseFloat(fallbackZelleData.data?.[0]?.adv?.price || "0");
              if (parsedFallback > 0) {
                binanceUsdZelleRate = parsedFallback;
                cachedRates.binanceUsdZelleRate = parsedFallback;
              }
            }
          }
        }

        if (binanceBuyRes.ok) {
          const buyData = await binanceBuyRes.json();
          const parsedBuy = parseFloat(buyData.data?.[0]?.adv?.price || "0");
          if (parsedBuy > 0) {
            binanceBuyRate = parsedBuy;
            cachedRates.binanceBuyRate = parsedBuy;
            cachedRates.binanceRate = parsedBuy; // update legacy
          } else {
            // Fallback without amount constraint
            const fallbackBuyRes = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                page: 1,
                rows: 5,
                payTypes: [],
                countries: [],
                publisherType: null,
                asset: "USDT",
                fiat: "VES",
                tradeType: "SELL"
              }),
              signal: AbortSignal.timeout(5000)
            });
            if (fallbackBuyRes.ok) {
              const fallbackBuyData = await fallbackBuyRes.json();
              const parsedFallback = parseFloat(fallbackBuyData.data?.[0]?.adv?.price || "0");
              if (parsedFallback > 0) {
                binanceBuyRate = parsedFallback;
                cachedRates.binanceBuyRate = parsedFallback;
                cachedRates.binanceRate = parsedFallback;
              }
            }
          }
        }

        if (binanceSellRes.ok) {
          const sellData = await binanceSellRes.json();
          const parsedSell = parseFloat(sellData.data?.[0]?.adv?.price || "0");
          if (parsedSell > 0) {
            binanceSellRate = parsedSell;
            cachedRates.binanceSellRate = parsedSell;
          } else {
            // Fallback without amount constraint
            const fallbackSellRes = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                page: 1,
                rows: 5,
                payTypes: [],
                countries: [],
                publisherType: null,
                asset: "USDT",
                fiat: "VES",
                tradeType: "BUY"
              }),
              signal: AbortSignal.timeout(5000)
            });
            if (fallbackSellRes.ok) {
              const fallbackSellData = await fallbackSellRes.json();
              const parsedFallback = parseFloat(fallbackSellData.data?.[0]?.adv?.price || "0");
              if (parsedFallback > 0) {
                binanceSellRate = parsedFallback;
                cachedRates.binanceSellRate = parsedFallback;
              }
            }
          }
        }

        binanceZelleToVesRate = binanceBuyRate; // default
        if (refinedZelleToVesRes.ok) {
          const refinedZelleToVesData = await refinedZelleToVesRes.json();
          const parsedZelleToVes = parseFloat(refinedZelleToVesData.data?.[0]?.adv?.price || "0");
          if (parsedZelleToVes > 0) {
            binanceZelleToVesRate = parsedZelleToVes;
          }
        }
      } catch (err) {
        console.warn("Error fetching Binance rates, using cache:", err);
      }

      // Update cached rate calculation
      if (binanceUsdZelleRate > 0) {
        cachedRates.binanceZelleToVesRate = (1 / binanceUsdZelleRate) * binanceZelleToVesRate;
      }

      // Fetch SaldoAR Rate with safety
      let saldoRate = cachedRates.saldoRate;
      try {
        const saldoRes = await fetch("https://api.saldo.com.ar/v3/systems/zelle/rates", {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000)
        });
        if (saldoRes.ok) {
          const saldoData = await saldoRes.json();
          const rateObj = saldoData.data?.find((r: any) => r.attributes?.system_id === 'banco_ves');
          const saldoPrice = rateObj?.attributes?.price;
          
          if (saldoPrice) {
            const parsedSaldo = 1 / parseFloat(saldoPrice);
            if (parsedSaldo > 0) {
              saldoRate = parsedSaldo;
              cachedRates.saldoRate = parsedSaldo;
            }
          }
        }
      } catch (err) {
        console.warn("Error fetching SaldoAR rate, using cache:", err);
      }

      // Fetch Venezuela Exchanges with safety
      let venezuelaExchangesRate = cachedRates.venezuelaExchangesRate;
      let venezuelaExchangesPaypalRate = cachedRates.venezuelaExchangesPaypalRate;
      let venezuelaExchangesCardRate = cachedRates.venezuelaExchangesCardRate;
      try {
        const vexRes = await fetch("https://us-central1-venezuela-exchange-527e6.cloudfunctions.net/getlandingdata", {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000)
        });
        if (vexRes.ok) {
          const vexData = await vexRes.json();
          if (vexData.usd) {
            const parsedVexUsd = parseFloat(vexData.usd.toString().replace(",", "."));
            if (parsedVexUsd > 0) {
              venezuelaExchangesRate = parsedVexUsd;
              cachedRates.venezuelaExchangesRate = parsedVexUsd;
            }
          }
          if (vexData.paypal) {
            const parsedVexPaypal = parseFloat(vexData.paypal.toString().replace(",", "."));
            if (parsedVexPaypal > 0) {
              venezuelaExchangesPaypalRate = parsedVexPaypal;
              cachedRates.venezuelaExchangesPaypalRate = parsedVexPaypal;
            }
          }
          if (vexData.saldo_tarjeta) {
            const parsedVexCard = parseFloat(vexData.saldo_tarjeta.toString().replace(",", "."));
            if (parsedVexCard > 0) {
              venezuelaExchangesCardRate = parsedVexCard;
              cachedRates.venezuelaExchangesCardRate = parsedVexCard;
            }
          }
        }
      } catch (err) {
        console.warn("Error fetching Venezuela Exchanges rate, using cache:", err);
      }

      // Fetch BCV Rates from API
      let bcvUsdRate = cachedRates.bcvUsdRate;
      let bcvEurRate = cachedRates.bcvEurRate;
      
      const now = Date.now();
      const FIVE_HOURS = 5 * 60 * 60 * 1000;
      
      if (now - cachedRates.bcvLastFetchTime > FIVE_HOURS) {
        let bcvRates = { usd: 0, eur: 0 };
        try {
          const [bcvUsdRes, bcvEurRes] = await Promise.all([
            fetch("https://exchange.vcoud.com/coins/latest?type=bolivar&base=usd", { signal: AbortSignal.timeout(5000) }),
            fetch("https://exchange.vcoud.com/coins/latest?type=bolivar&base=eur", { signal: AbortSignal.timeout(5000) })
          ]);
          
          if (bcvUsdRes.ok) {
            const usdData = await bcvUsdRes.json();
            const bcvUsdMatch = usdData.find((coin: any) => coin.slug === "dolar-bcv");
            if (bcvUsdMatch && bcvUsdMatch.price > 0) {
              bcvRates.usd = bcvUsdMatch.price;
            }
          }
          if (bcvEurRes.ok) {
            const eurData = await bcvEurRes.json();
            const bcvEurMatch = eurData.find((coin: any) => coin.slug === "euro-bcv");
            if (bcvEurMatch && bcvEurMatch.price > 0) {
              bcvRates.eur = bcvEurMatch.price;
            }
          }
        } catch (err) {
          console.warn("CriptoDolar BCV fetch failed:", err);
        }

        if (bcvRates.usd > 0) {
          bcvUsdRate = bcvRates.usd;
          cachedRates.bcvUsdRate = bcvRates.usd;
        }
        if (bcvRates.eur > 0) {
          bcvEurRate = bcvRates.eur;
          cachedRates.bcvEurRate = bcvRates.eur;
        }
        
        if (bcvRates.usd > 0 && bcvRates.eur > 0) {
          cachedRates.bcvLastFetchTime = now;
        } else {
          // If both failed, retry in 1 minute instead of waiting 5 hours
          cachedRates.bcvLastFetchTime = now - FIVE_HOURS + 60000;
        }
      }

      cachedRates.timestamp = new Date().toISOString();

      res.json({
        binanceRate: binanceBuyRate || cachedRates.binanceBuyRate,
        binanceBuyRate: binanceBuyRate || cachedRates.binanceBuyRate,
        binanceSellRate: binanceSellRate || cachedRates.binanceSellRate,
        binanceUsdZelleRate: binanceUsdZelleRate || cachedRates.binanceUsdZelleRate,
        binanceZelleToVesRate: binanceUsdZelleRate > 0 ? (1 / binanceUsdZelleRate) * binanceZelleToVesRate : cachedRates.binanceZelleToVesRate,
        saldoRate: saldoRate || cachedRates.saldoRate,
        bcvUsdRate: bcvUsdRate || cachedRates.bcvUsdRate,
        bcvEurRate: bcvEurRate || cachedRates.bcvEurRate,
        venezuelaExchangesRate: venezuelaExchangesRate || cachedRates.venezuelaExchangesRate,
        venezuelaExchangesPaypalRate: venezuelaExchangesPaypalRate || cachedRates.venezuelaExchangesPaypalRate,
        venezuelaExchangesCardRate: venezuelaExchangesCardRate || cachedRates.venezuelaExchangesCardRate,
        timestamp: cachedRates.timestamp
      });
    } catch (error) {
      console.error("Critical error in rates endpoint:", error);
      // Absolute fallback - return whatever we have cached with the current timestamp
      res.json({
        ...cachedRates,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
