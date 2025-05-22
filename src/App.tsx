import React, { useState, useEffect } from 'react';
import CryptoCard from './components/CryptoCard';
import { TrendingUp, PlusCircle } from 'lucide-react';

/**
 * Represents the structure for a cryptocurrency being tracked.
 * @property symbol - The unique symbol of the cryptocurrency (e.g., "btc", "eth").
 * @property name - The display name of the cryptocurrency (e.g., "Bitcoin", "Ethereum").
 */
interface TrackedCrypto {
  symbol: string;
  name: string;
}

/**
 * Initial list of popular cryptocurrencies to track by default.
 */
const initialPopularCryptos: TrackedCrypto[] = [
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

/**
 * Key used for storing and retrieving the list of tracked cryptocurrencies from `localStorage`.
 */
const CRYPTO_TRACKER_LIST_KEY = 'cryptoTrackerList';

/**
 * The main application component.
 * It manages the list of tracked cryptocurrencies, allows users to add new ones,
 * and displays them using the `CryptoCard` component.
 * The list of tracked cryptocurrencies is persisted in `localStorage`.
 */
function App() {
  /**
   * State for the list of cryptocurrencies currently being tracked.
   * Initialized from `localStorage` if available, otherwise defaults to `initialPopularCryptos`.
   */
  const [trackedCryptos, setTrackedCryptos] = useState<TrackedCrypto[]>(() => {
    try {
      const storedList = localStorage.getItem(CRYPTO_TRACKER_LIST_KEY);
      if (storedList) {
        return JSON.parse(storedList);
      }
    } catch (error) {
      console.error("Error loading cryptos from localStorage:", error);
    }
    return initialPopularCryptos;
  });

  /** State for the input field where users type the symbol of a new cryptocurrency to add. */
  const [newCryptoSymbol, setNewCryptoSymbol] = useState('');
  /** State for displaying error messages related to adding a new cryptocurrency. */
  const [inputError, setInputError] = useState('');

  /**
   * `useEffect` hook to save the current list of `trackedCryptos` to `localStorage`
   * whenever the list changes. This ensures persistence of user customizations.
   */
  useEffect(() => {
    try {
      localStorage.setItem(CRYPTO_TRACKER_LIST_KEY, JSON.stringify(trackedCryptos));
    } catch (error) {
      console.error("Error saving cryptos to localStorage:", error);
    }
  }, [trackedCryptos]);

  /**
   * Handles the addition of a new cryptocurrency to the tracking list.
   * It performs validation (checks for empty input, duplicates) and derives the name
   * for the new cryptocurrency. Updates the `trackedCryptos` state and clears input fields.
   */
  const handleAddCrypto = () => {
    setInputError('');
    const processedSymbol = newCryptoSymbol.trim().toLowerCase();

    if (!processedSymbol) {
      setInputError('Symbol cannot be empty.');
      return;
    }

    if (trackedCryptos.some(crypto => crypto.symbol === processedSymbol)) {
      setInputError(`'${processedSymbol.toUpperCase()}' is already tracked.`);
      setNewCryptoSymbol('');
      return;
    }

    // Derive name
    let derivedName = processedSymbol.toUpperCase();
    const knownCrypto = initialPopularCryptos.find(c => c.symbol === processedSymbol);
    if (knownCrypto) {
      derivedName = knownCrypto.name;
    }
    
    const newCrypto: TrackedCrypto = {
      symbol: processedSymbol,
      name: derivedName
    };

    setTrackedCryptos(prevCryptos => [...prevCryptos, newCrypto]);
    setNewCryptoSymbol('');
  };

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
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCryptoSymbol}
              onChange={(e) => setNewCryptoSymbol(e.target.value)}
              placeholder="Add symbol (e.g., LTC)"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            />
            <button
              onClick={handleAddCrypto}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
              Add
            </button>
          </div>
        </div>
        {inputError && <p className="text-red-500 text-sm mb-4 -mt-4 text-right">{inputError}</p>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trackedCryptos.map(crypto => (
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