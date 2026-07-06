import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import https from "https";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add JSON parsing middleware
  app.use(express.json());

  // API route for getting rates
  app.get("/api/rates", async (req, res) => {
    try {
      // Fetch Binance P2P Rate
      const binancePayload = {
        page: 1,
        rows: 5,
        payTypes: [],
        countries: [],
        publisherType: null,
        asset: "USDT",
        fiat: "VES",
        tradeType: "SELL"
      };

      const binanceRes = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(binancePayload)
      });
      const binanceData = await binanceRes.json();
      const binanceRate = parseFloat(binanceData.data?.[0]?.adv?.price || "0");

      // Fetch SaldoAR Rate
      const saldoRes = await fetch("https://api.saldo.com.ar/v3/systems/zelle/rates", {
        headers: { "Accept": "application/json" }
      });
      const saldoData = await saldoRes.json();
      
      const rateObj = saldoData.data?.find((r: any) => r.attributes?.system_id === 'banco_ves');
      const saldoPrice = rateObj?.attributes?.price;
      
      let saldoRate = 0;
      if (saldoPrice) {
        // Price is in Zelle -> VES inverse format (e.g., 0.001417)
        // Which means 1 VES = 0.001417 Zelle. 
        // We want VES per 1 Zelle (1 / price)
        saldoRate = 1 / parseFloat(saldoPrice);
      }

      // Fetch BCV Rates
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
        req.end();
      });

      res.json({
        binanceRate,
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
