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

  // API route for getting rates
  app.get("/api/rates", async (req, res) => {
    try {
      const amount = parseFloat(req.query.amount as string) || 100;

      // Wrap in try-catch to avoid complete failure if Binance blocks/throttles
      let baselineRate = 40.0; // Sensible default fallback
      let binanceUsdZelleRate = 1.03; // Sensible default fallback

      try {
        const baselinePayload = {
          page: 1,
          rows: 5,
          payTypes: [],
          countries: [],
          publisherType: null,
          asset: "USDT",
          fiat: "VES",
          tradeType: "SELL"
        };

        const [baselineRes, binanceZelleRes] = await Promise.all([
          fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(baselinePayload),
            signal: AbortSignal.timeout(4000)
          }),
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
            signal: AbortSignal.timeout(4000)
          })
        ]);

        if (baselineRes.ok && binanceZelleRes.ok) {
          const [baselineData, binanceZelleData] = await Promise.all([
            baselineRes.json(),
            binanceZelleRes.json()
          ]);

          const parsedBaseline = parseFloat(baselineData.data?.[0]?.adv?.price || "0");
          if (parsedBaseline > 0) baselineRate = parsedBaseline;

          const parsedZelle = parseFloat(binanceZelleData.data?.[0]?.adv?.price || "0");
          if (parsedZelle > 0) {
            binanceUsdZelleRate = parsedZelle;
          } else {
            // Fallback if no ads match the USD transAmount limit
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
              signal: AbortSignal.timeout(4000)
            });
            if (fallbackZelleRes.ok) {
              const fallbackZelleData = await fallbackZelleRes.json();
              const parsedFallback = parseFloat(fallbackZelleData.data?.[0]?.adv?.price || "0");
              if (parsedFallback > 0) binanceUsdZelleRate = parsedFallback;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching baseline Binance rates:", err);
      }

      // Step 2: Calculate target VES amounts for the refined queries
      const usdtZelleAmount = amount / (binanceUsdZelleRate || 1);
      const vesZelleAmount = usdtZelleAmount * (baselineRate || 40);
      const vesUsdtAmount = amount * (baselineRate || 40);

      let binanceZelleToVesRate = baselineRate;
      let binanceRate = baselineRate;

      try {
        // Step 3: Fetch refined USDT -> VES rates for both paths using calculated VES amounts
        const [refinedZelleToVesRes, refinedUsdtToVesRes] = await Promise.all([
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
            signal: AbortSignal.timeout(4000)
          }),
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
            signal: AbortSignal.timeout(4000)
          })
        ]);

        if (refinedZelleToVesRes.ok && refinedUsdtToVesRes.ok) {
          const [refinedZelleToVesData, refinedUsdtToVesData] = await Promise.all([
            refinedZelleToVesRes.json(),
            refinedUsdtToVesRes.json()
          ]);

          const parsedZelleToVes = parseFloat(refinedZelleToVesData.data?.[0]?.adv?.price || "0");
          if (parsedZelleToVes > 0) binanceZelleToVesRate = parsedZelleToVes;

          const parsedUsdtToVes = parseFloat(refinedUsdtToVesData.data?.[0]?.adv?.price || "0");
          if (parsedUsdtToVes > 0) binanceRate = parsedUsdtToVes;
        }
      } catch (err) {
        console.error("Error fetching refined Binance rates:", err);
      }

      // Fetch SaldoAR Rate with safety
      let saldoRate = 0;
      try {
        const saldoRes = await fetch("https://api.saldo.com.ar/v3/systems/zelle/rates", {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(4000)
        });
        if (saldoRes.ok) {
          const saldoData = await saldoRes.json();
          const rateObj = saldoData.data?.find((r: any) => r.attributes?.system_id === 'banco_ves');
          const saldoPrice = rateObj?.attributes?.price;
          
          if (saldoPrice) {
            saldoRate = 1 / parseFloat(saldoPrice);
          }
        }
      } catch (err) {
        console.error("Error fetching SaldoAR rate:", err);
      }

      // Fetch BCV Rates with absolute timeout
      const bcvRates = await new Promise<{ usd: number; eur: number }>((resolve) => {
        const options = {
          hostname: "www.bcv.org.ve",
          path: "/",
          method: "GET",
          rejectUnauthorized: false,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          }
        };
        const req = https.request(options, (res) => {
          let body = "";
          res.on("data", d => body += d);
          res.on("end", () => {
            try {
              const usdMatch = body.match(/<div id=\"dolar\"[^>]*>.*?<strong[^>]*>\s*([\d,.]+)\s*<\/strong>/is);
              const eurMatch = body.match(/<div id=\"euro\"[^>]*>.*?<strong[^>]*>\s*([\d,.]+)\s*<\/strong>/is);
              
              const usdStr = usdMatch ? usdMatch[1].replace(",", ".") : "0";
              const eurStr = eurMatch ? eurMatch[1].replace(",", ".") : "0";
              
              resolve({
                usd: parseFloat(usdStr),
                eur: parseFloat(eurStr)
              });
            } catch (e) {
              resolve({ usd: 0, eur: 0 });
            }
          });
        });
        req.on("error", () => resolve({ usd: 0, eur: 0 }));
        req.setTimeout(3500, () => {
          req.destroy();
          resolve({ usd: 0, eur: 0 });
        });
        req.end();
      });

      res.json({
        binanceRate,
        binanceUsdZelleRate,
        binanceZelleToVesRate: binanceUsdZelleRate > 0 ? (1 / binanceUsdZelleRate) * binanceZelleToVesRate : 0,
        saldoRate,
        bcvUsdRate: bcvRates.usd,
        bcvEurRate: bcvRates.eur,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching rates:", error);
      res.status(500).json({ error: "Failed to fetch exchange rates" });
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
