import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowRightLeft, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { motion } from 'motion/react';

interface RatesData {
  binanceRate: number;
  binanceUsdZelleRate: number;
  binanceZelleToVesRate: number;
  saldoRate: number;
  bcvUsdRate: number;
  bcvEurRate: number;
  venezuelaExchangesRate?: number;
  venezuelaExchangesPaypalRate?: number;
  venezuelaExchangesCardRate?: number;
  timestamp: string;
}

export function RatesComparison() {
  const [data, setData] = useState<RatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('100');
  const [debouncedAmount, setDebouncedAmount] = useState<string>('100');
  
  const fetchRates = async (currentAmount?: string) => {
    setLoading(true);
    setError(null);
    
    const amt = currentAmount || amount || '100';
    let success = false;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`/api/rates?amount=${encodeURIComponent(amt)}`);
        if (!res.ok) {
          throw new Error('No se pudieron obtener las tasas desde el servidor.');
        }
        const result = await res.json();
        setData(result);
        success = true;
        break; // Success! Exit loop.
      } catch (err: any) {
        lastError = err;
        if (attempt < 3) {
          // Wait 1.5 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    
    if (!success) {
      console.error("Error fetching rates on client after 3 attempts:", lastError);
      const isNetworkError = lastError?.message?.includes('fetch') || lastError?.name === 'TypeError';
      const msg = isNetworkError 
        ? 'Error de conexión: No se pudo conectar con el servidor. Por favor, intenta de nuevo haciendo clic en "Actualizar Tasas".'
        : (lastError?.message || 'Ocurrió un error inesperado al obtener las tasas.');
      setError(msg);
    }
    setLoading(false);
  };

  // Debounce the amount input to avoid excessive API requests while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmount(amount);
    }, 600);
    return () => clearTimeout(timer);
  }, [amount]);

  // Fetch rates when the debounced amount changes
  useEffect(() => {
    const parsed = parseFloat(debouncedAmount);
    if (!isNaN(parsed) && parsed > 0) {
      fetchRates(debouncedAmount);
    }
  }, [debouncedAmount]);

  // Auto-refresh every 60 seconds using the current amount
  useEffect(() => {
    const interval = setInterval(() => {
      const parsed = parseFloat(amount);
      if (!isNaN(parsed) && parsed > 0) {
        fetchRates(amount);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [amount]);

  const handleRefresh = () => {
    const parsed = parseFloat(amount);
    if (!isNaN(parsed) && parsed > 0) {
      fetchRates(amount);
    }
  };

  const numAmount = parseFloat(amount) || 0;
  
  const binanceReceived = numAmount * (data?.binanceRate || 0);
  const binanceZelleToVesReceived = numAmount * (data?.binanceZelleToVesRate || 0);
  const saldoReceived = numAmount * (data?.saldoRate || 0);
  const venezuelaExchangesReceived = numAmount * (data?.venezuelaExchangesRate || 0);
  
  const bcvUsdReceived = numAmount * (data?.bcvUsdRate || 0);
  const bcvEurReceived = numAmount * (data?.bcvEurRate || 0);
  
  // Calculate which option is best between the Zelle->VES options
  const bestZelleRate = Math.max(
    data?.binanceZelleToVesRate || 0,
    data?.saldoRate || 0,
    data?.venezuelaExchangesRate || 0
  );
  
  const isBinanceZelleBetter = bestZelleRate === data?.binanceZelleToVesRate && data?.binanceZelleToVesRate > 0;
  const isSaldoBetter = bestZelleRate === data?.saldoRate && data?.saldoRate > 0;
  const isVenezuelaExchangesBetter = bestZelleRate === data?.venezuelaExchangesRate && (data?.venezuelaExchangesRate || 0) > 0;

  // Get dynamic recommendation text
  let recommendationText = '';
  if (data && numAmount > 0) {
    const options = [
      { name: 'Binance P2P (Zelle)', amount: binanceZelleToVesReceived, rate: data.binanceZelleToVesRate },
      { name: 'SaldoAR', amount: saldoReceived, rate: data.saldoRate },
      { name: 'Venezuela Exchanges', amount: venezuelaExchangesReceived, rate: data.venezuelaExchangesRate || 0 }
    ].filter(opt => opt.rate > 0);

    options.sort((a, b) => b.amount - a.amount);
    
    if (options.length >= 2) {
      const best = options[0];
      const second = options[1];
      const diff = best.amount - second.amount;
      recommendationText = `Usar ${best.name} te dará ${diff.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES más en esta transacción en comparación con ${second.name}.`;
    } else if (options.length === 1) {
      recommendationText = `La única opción de Zelle disponible es ${options[0].name}.`;
    }
  }
  
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight transition-colors">Tasas en Tiempo Real</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 transition-colors">Datos de mercado en vivo para USDT y Zelle a bolívares (VES)</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-slate-950 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Actualizando...' : 'Actualizar Tasas'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 border border-red-100 dark:border-red-900/50 transition-colors">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Binance Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1 transition-colors">
              <span className="w-2 h-2 rounded-full bg-[#FCD535]"></span>
              Binance P2P (USDT)
            </div>
            <CardTitle className="text-2xl">
              {data ? data.binanceRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 dark:text-gray-400 font-normal transition-colors">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">1 USDT</p>
          </CardHeader>
        </Card>

        {/* Binance Zelle to VES Card */}
        <Card className={`relative overflow-hidden transition-all ${isBinanceZelleBetter && data ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 ring-offset-2 dark:ring-offset-slate-950' : ''}`}>
          {isBinanceZelleBetter && data && (
            <div className="absolute top-4 right-4 text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" /> Mejor Opción
            </div>
          )}
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1 transition-colors">
              <span className="w-2 h-2 rounded-full bg-[#FCD535]"></span>
              Binance P2P (Zelle)
            </div>
            <CardTitle className="text-2xl">
              {data ? data.binanceZelleToVesRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 dark:text-gray-400 font-normal transition-colors">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">1 USD (Zelle)</p>
          </CardHeader>
        </Card>

        {/* SaldoAR Card */}
        <Card className={`relative overflow-hidden transition-all ${isSaldoBetter && data ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 ring-offset-2 dark:ring-offset-slate-950' : ''}`}>
          {isSaldoBetter && data && (
            <div className="absolute top-4 right-4 text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" /> Mejor Opción
            </div>
          )}
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1 transition-colors">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              SaldoAR
            </div>
            <CardTitle className="text-2xl">
              {data ? data.saldoRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 dark:text-gray-400 font-normal transition-colors">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">1 USD (Zelle)</p>
          </CardHeader>
        </Card>

        {/* Venezuela Exchanges Card */}
        <Card className={`relative overflow-hidden transition-all ${isVenezuelaExchangesBetter && data ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 ring-offset-2 dark:ring-offset-slate-950' : ''}`}>
          {isVenezuelaExchangesBetter && data && (
            <div className="absolute top-4 right-4 text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" /> Mejor Opción
            </div>
          )}
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1 transition-colors">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              Venezuela Exchanges (Zelle)
            </div>
            <CardTitle className="text-2xl">
              {data && data.venezuelaExchangesRate ? data.venezuelaExchangesRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 dark:text-gray-400 font-normal transition-colors">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">1 USD (Zelle)</p>
          </CardHeader>
        </Card>
        
        {/* BCV USD Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1 transition-colors">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              BCV Oficial
            </div>
            <CardTitle className="text-2xl">
              {data && data.bcvUsdRate > 0 ? data.bcvUsdRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 dark:text-gray-400 font-normal transition-colors">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">1 USD</p>
          </CardHeader>
        </Card>

        {/* BCV EUR Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1 transition-colors">
              <span className="w-2 h-2 rounded-full bg-blue-800"></span>
              BCV Oficial
            </div>
            <CardTitle className="text-2xl">
              {data && data.bcvEurRate > 0 ? data.bcvEurRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 dark:text-gray-400 font-normal transition-colors">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">1 EUR</p>
          </CardHeader>
        </Card>

      </div>

      {/* Calculator Section */}
      <Card className="bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="text-gray-400 dark:text-gray-500 w-5 h-5 transition-colors" />
            Calculadora de Conversión
          </CardTitle>
        </CardHeader>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">Monto a Convertir (USD / USDT)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-gray-500 dark:text-gray-400 font-medium transition-colors">$</span>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-lg font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none transition-all"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col justify-center transition-colors">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 transition-colors">Binance (USDT)</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white transition-colors sm:text-lg">
              {binanceReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col justify-center transition-colors">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 transition-colors">Binance (Zelle)</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white transition-colors sm:text-lg">
              {binanceZelleToVesReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col justify-center transition-colors">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 transition-colors">SaldoAR (Zelle)</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white transition-colors sm:text-lg">
              {saldoReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col justify-center transition-colors">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 transition-colors">VenezuelaEx (Zelle)</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white transition-colors sm:text-lg">
              {venezuelaExchangesReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col justify-center transition-colors">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 transition-colors">Por BCV (USD)</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white transition-colors sm:text-lg">
              {bcvUsdReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col justify-center transition-colors">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 transition-colors">Por BCV (EUR)</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white transition-colors sm:text-lg">
              {bcvEurReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
        </div>

        {data && numAmount > 0 && recommendationText && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 flex items-start gap-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 transition-colors"
          >
            <TrendingUp className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              <strong>Recomendación: </strong> 
              {recommendationText}
            </p>
          </motion.div>
        )}
        
        {data && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6 transition-colors">
            Última actualización: {new Date(data.timestamp).toLocaleTimeString('es-VE')}
          </p>
        )}
      </Card>
      
    </div>
  );
}
