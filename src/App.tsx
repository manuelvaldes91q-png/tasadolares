/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RatesComparison } from './components/RatesComparison';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-gray-900 selection:text-white">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Tx</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">TradeOptimize</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <RatesComparison />
      </main>
    </div>
  );
}
