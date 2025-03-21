import React from 'react';
import CryptoCard from './components/CryptoCard';
import { TrendingUp } from 'lucide-react';

const popularCryptos = [
  { symbol: 'btc', name: 'Bitcoin' },
  { symbol: 'eth', name: 'Ethereum' },
  { symbol: 'xrp', name: 'XRP' },
  { symbol: 'ada', name: 'Cardano' },
  { symbol: 'sol', name: 'Solana' },
  { symbol: 'dot', name: 'Polkadot' },
  { symbol: 'doge', name: 'Dogecoin' },
  { symbol: 'avax', name: 'Avalanche' },
  { symbol: 'matic', name: 'Polygon' }
];

function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              Crypto Tracker
            </h1>
            <p className="text-gray-400 mt-1">
              Real-time cryptocurrency price tracking with WebSocket
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularCryptos.map(crypto => (
            <CryptoCard
              key={crypto.symbol}
              symbol={crypto.symbol}
              name={crypto.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;