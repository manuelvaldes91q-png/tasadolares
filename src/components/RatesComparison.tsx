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
  timestamp: string;
}

export function RatesComparison() {
  const [data, setData] = useState<RatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('100');
  
  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rates');
      if (!res.ok) throw new Error('Failed to fetch rates');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchRates, 60000);
    return () => clearInterval(interval);
  }, []);

  const numAmount = parseFloat(amount) || 0;
  
  const binanceReceived = numAmount * (data?.binanceRate || 0);
  const binanceZelleToVesReceived = numAmount * (data?.binanceZelleToVesRate || 0);
  const saldoReceived = numAmount * (data?.saldoRate || 0);
  
  const bcvUsdReceived = numAmount * (data?.bcvUsdRate || 0);
  const bcvEurReceived = numAmount * (data?.bcvEurRate || 0);
  
  // Calculate which option is best between the Zelle->VES options
  const bestZelleRate = Math.max(
    data?.binanceZelleToVesRate || 0,
    data?.saldoRate || 0
  );
  
  const isBinanceZelleBetter = bestZelleRate === data?.binanceZelleToVesRate && data?.binanceZelleToVesRate > 0;
  const isSaldoBetter = bestZelleRate === data?.saldoRate && data?.saldoRate > 0;
  const zelleDifference = Math.abs(binanceZelleToVesReceived - saldoReceived);
  
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Real-time Rates</h2>
          <p className="text-sm text-gray-500 mt-1">Live market data for USDT and Zelle to VES</p>
        </div>
        <button
          onClick={fetchRates}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Updating...' : 'Refresh Rates'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Binance Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <span className="w-2 h-2 rounded-full bg-[#FCD535]"></span>
              Binance P2P (USDT)
            </div>
            <CardTitle className="text-2xl">
              {data ? data.binanceRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 font-normal">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400">1 USDT</p>
          </CardHeader>
        </Card>

        {/* Binance Zelle to VES Card */}
        <Card className={`relative overflow-hidden ${isBinanceZelleBetter && data ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}>
          {isBinanceZelleBetter && data && (
            <div className="absolute top-4 right-4 text-emerald-500 flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Best Option
            </div>
          )}
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <span className="w-2 h-2 rounded-full bg-[#FCD535]"></span>
              Binance P2P (Zelle)
            </div>
            <CardTitle className="text-2xl">
              {data ? data.binanceZelleToVesRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 font-normal">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400">1 USD (Zelle)</p>
          </CardHeader>
        </Card>

        {/* SaldoAR Card */}
        <Card className={`relative overflow-hidden ${isSaldoBetter && data ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}>
          {isSaldoBetter && data && (
            <div className="absolute top-4 right-4 text-emerald-500 flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Best Option
            </div>
          )}
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              SaldoAR
            </div>
            <CardTitle className="text-2xl">
              {data ? data.saldoRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 font-normal">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400">1 USD (Zelle)</p>
          </CardHeader>
        </Card>
        
        {/* BCV USD Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              BCV Oficial
            </div>
            <CardTitle className="text-2xl">
              {data && data.bcvUsdRate > 0 ? data.bcvUsdRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 font-normal">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400">1 USD</p>
          </CardHeader>
        </Card>

        {/* BCV EUR Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-800"></span>
              BCV Oficial
            </div>
            <CardTitle className="text-2xl">
              {data && data.bcvEurRate > 0 ? data.bcvEurRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'} <span className="text-sm text-gray-500 font-normal">VES</span>
            </CardTitle>
            <p className="text-xs text-gray-400">1 EUR</p>
          </CardHeader>
        </Card>

      </div>

      {/* Calculator Section */}
      <Card className="bg-gray-50 border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-gray-400" />
            Conversion Calculator
          </CardTitle>
        </CardHeader>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Convert (USD / USDT)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-gray-500 font-medium">$</span>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-lg font-medium text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
            <span className="text-xs font-medium text-gray-500 mb-1">Binance (USDT)</span>
            <span className="text-lg font-semibold text-gray-900">
              {binanceReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
            <span className="text-xs font-medium text-gray-500 mb-1">Binance (Zelle)</span>
            <span className="text-lg font-semibold text-gray-900">
              {binanceZelleToVesReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
            <span className="text-xs font-medium text-gray-500 mb-1">Via SaldoAR</span>
            <span className="text-lg font-semibold text-gray-900">
              {saldoReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
            <span className="text-xs font-medium text-gray-500 mb-1">Via BCV (USD)</span>
            <span className="text-lg font-semibold text-gray-900">
              {bcvUsdReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
            <span className="text-xs font-medium text-gray-500 mb-1">Via BCV (EUR)</span>
            <span className="text-lg font-semibold text-gray-900">
              {bcvEurReceived.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
            </span>
          </div>
        </div>

        {data && numAmount > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 flex items-start gap-3 bg-indigo-50 text-indigo-800 p-4 rounded-xl"
          >
            <TrendingUp className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              <strong>Recommendation: </strong> 
              Using <strong>{isBinanceZelleBetter ? 'Binance P2P (Zelle)' : 'SaldoAR'}</strong> will yield 
              you <span className="font-semibold">{zelleDifference.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES</span> more 
              for this transaction compared to the other platform.
            </p>
          </motion.div>
        )}
        
        {data && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Last updated: {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        )}
      </Card>
      
    </div>
  );
}
