import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, RefreshCcw, Flag } from 'lucide-react';
import { cn, formatPrice, formatPercentChange, formatTimestamp } from '../lib/utils';
import { cryptoWebSocket } from '../lib/websocket';

/**
 * Defines the structure of ticker messages received from the WebSocket,
 * specific to the data consumed by `CryptoCard`.
 * @property product_id - The product identifier (e.g., "BTC-USD").
 * @property price - The current price as a string.
 * @property time - The timestamp of the data point in ISO 8601 format.
 * @property volume_24h - Optional: The trading volume over the last 24 hours as a string.
 * @property low_24h - Optional: The lowest price in the last 24 hours as a string.
 * @property high_24h - Optional: The highest price in the last 24 hours as a string.
 * @property open_24h - Optional: The opening price from 24 hours ago as a string.
 */
interface CoinbaseTickerMessage {
  product_id: string;
  price: string;
  time: string;
  volume_24h?: string;
  low_24h?: string;
  high_24h?: string;
  open_24h?: string;
}

/**
 * Props for the `CryptoCard` component.
 * @property symbol - The cryptocurrency symbol (e.g., "btc", "eth").
 * @property name - The display name of the cryptocurrency (e.g., "Bitcoin", "Ethereum").
 */
interface CryptoCardProps {
  symbol: string;
  name: string;
}

/**
 * Represents the processed and displayable data for a cryptocurrency.
 * @property currentPrice - The current price of the cryptocurrency.
 * @property change24h - The percentage change in price over the last 24 hours.
 * @property volume24h - The trading volume over the last 24 hours.
 * @property high24h - The highest price in the last 24 hours.
 * @property low24h - The lowest price in the last 24 hours.
 */
interface CryptoData {
  currentPrice: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

/**
 * Represents a single data point for the price history chart.
 * @property timestamp - The Unix timestamp (in milliseconds) of the data point.
 * @property price - The price at that specific timestamp.
 */
interface ChartDataPoint {
  timestamp: number;
  price: number;
}

/**
 * Represents the state of a marked price point for tracking changes.
 * @property price - The price at which the point was marked.
 * @property timestamp - The Unix timestamp (in milliseconds) when the point was marked.
 * @property percentChange - The percentage change in price since the point was marked.
 */
interface MarkedChange {
  price: number;
  timestamp: number;
  percentChange: number;
}

/**
 * Defines the structure for storing marked price point information in `localStorage`.
 * @property price - The price at which the point was marked.
 * @property timestamp - The Unix timestamp (in milliseconds) when the point was marked.
 */
interface StoredMarkedInfo {
  price: number;
  timestamp: number;
}

/**
 * `CryptoCard` is a React functional component that displays real-time information
 * for a single cryptocurrency. It includes current price, 24-hour statistics,
 * a historical price chart, and a feature to mark a price point for change tracking.
 * Data is received via a WebSocket connection and persisted states (like marked price)
 * are stored in `localStorage`.
 *
 * @param {CryptoCardProps} props - The props for the component, including `symbol` and `name`.
 */
const CryptoCard: React.FC<CryptoCardProps> = ({ symbol, name }) => {
  /** Key used for storing and retrieving this crypto's marked point from localStorage. */
  const localStorageKey = `markedChange_${symbol.toUpperCase()}`;

  /** State for the current processed cryptocurrency data. */
  const [data, setData] = useState<CryptoData | null>(null);
  /** State for the historical price data points for the chart. */
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  /** State to manage the initial loading visual state. */
  const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null); // setError was unused
  /** State for the user-marked price point. */
  const [markedChange, setMarkedChange] = useState<MarkedChange | null>(null);
  /** State to manage the loading/disabled status of the "Mark Start Point" button. */
  const [isMarking, setIsMarking] = useState(false);

  /**
   * Callback function to process incoming WebSocket messages for the subscribed cryptocurrency.
   * It updates the component's state with the new price, volume, and other relevant data.
   * It also updates the chart data and recalculates the percentage change from any marked point.
   *
   * This function is memoized using `useCallback` to prevent unnecessary re-renders.
   * @param {CoinbaseTickerMessage} wsData - The ticker data received from the WebSocket.
   */
  const handleWebSocketData = useCallback((wsData: CoinbaseTickerMessage) => {
    const price = parseFloat(wsData.price);
    const timestamp = new Date(wsData.time).getTime();
    
    setData(prevData => {
      if (!prevData) return {
        currentPrice: price,
        change24h: 0,
        volume24h: parseFloat(wsData.volume_24h || '0'),
        high24h: parseFloat(wsData.high_24h || '0'),
        low24h: parseFloat(wsData.low_24h || '0')
      };

      const change24h = ((price - prevData.currentPrice) / prevData.currentPrice) * 100;
      return {
        currentPrice: price,
        change24h,
        volume24h: parseFloat(wsData.volume_24h || '0'),
        high24h: parseFloat(wsData.high_24h || '0'),
        low24h: parseFloat(wsData.low_24h || '0')
      };
    });

    setChartData(prevData => {
      const newData = [...prevData, { timestamp, price }];
      if (newData.length > 100) newData.shift();
      return newData;
    });

    if (markedChange) {
      setMarkedChange(prev => {
        if (!prev) return null;
        return {
          ...prev,
          percentChange: ((price - prev.price) / prev.price) * 100
        };
      });
    }
  }, [markedChange]);

  useEffect(() => {
    const productId = `${symbol.toUpperCase()}-USD`;
    console.log('Subscribing to:', productId);
    const unsubscribe = cryptoWebSocket.subscribe(productId, handleWebSocketData);
    setLoading(false);
    
    return () => {
      unsubscribe();
    };
  }, [symbol, handleWebSocketData]);

  // Effect to load markedChange from localStorage on mount
  /**
   * `useEffect` hook to load a previously marked price point from `localStorage`
   * when the component mounts. This allows persistence of the marked point across sessions.
   */
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(localStorageKey);
      if (storedData) {
        const parsedData: StoredMarkedInfo = JSON.parse(storedData);
        // Basic validation of the parsed data
        if (parsedData && typeof parsedData.price === 'number' && typeof parsedData.timestamp === 'number') {
          // Set the loaded data. percentChange will be calculated by handleWebSocketData
          // once current price is available.
          setMarkedChange({
            price: parsedData.price,
            timestamp: parsedData.timestamp,
            percentChange: 0 // Initialize with 0, will be updated
          });
        } else {
          console.warn(`Invalid stored marked data for ${symbol}:`, parsedData);
          localStorage.removeItem(localStorageKey); // Remove invalid data
        }
      }
    } catch (error) {
      console.error(`Error loading markedChange for ${symbol} from localStorage:`, error);
    }
  }, [localStorageKey, symbol]);

  /**
   * Handles the action of marking a new start point for price change tracking.
   * It captures the current price and timestamp, updates the `markedChange` state,
   * and saves this information to `localStorage`.
   */
  const markStartPoint = () => {
    setIsMarking(true);
    if (data) {
      const newMark: MarkedChange = {
        price: data.currentPrice,
        timestamp: Date.now(),
        percentChange: 0 // Will be immediately recalculated if data.currentPrice is the same, or by next tick
      };
      setMarkedChange(newMark);

      try {
        const dataToStore: StoredMarkedInfo = { price: newMark.price, timestamp: newMark.timestamp };
        localStorage.setItem(localStorageKey, JSON.stringify(dataToStore));
      } catch (error) {
        console.error(`Error saving markedChange for ${symbol} to localStorage:`, error);
      }
    }
    setIsMarking(false);
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 h-[300px] animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-800 rounded w-1/4 mb-8"></div>
        <div className="h-32 bg-gray-800 rounded mb-4"></div>
        <div className="h-8 bg-gray-800 rounded"></div>
      </div>
    );
  }

  if (error) return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="text-red-500">{error}</div>
    </div>
  );

  if (!data) return null;

  const isPositive = data.change24h >= 0;

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {isPositive ? (
                <ArrowUpCircle className="w-5 h-5 text-green-500" />
              ) : (
                <ArrowDownCircle className="w-5 h-5 text-red-500" />
              )}
              {symbol.toUpperCase()}
            </h3>
            <p className="text-gray-400">{name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">
              ${formatPrice(data.currentPrice)}
            </p>
            <p className={cn(
              "text-sm font-medium flex items-center justify-end gap-1",
              isPositive ? "text-green-500" : "text-red-500"
            )}>
              {formatPercentChange(data.change24h)}
            </p>
          </div>
        </div>
        
        <div className="h-32 mt-6 mb-4 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="timestamp"
                tickFormatter={formatTimestamp}
                type="number"
                domain={['dataMin', 'dataMax']}
                hide
              />
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                labelFormatter={(label) => new Date(label).toLocaleString()}
                formatter={(value: number) => [`$${formatPrice(value)}`, 'Price']}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-800 p-2 rounded">
            <p className="text-gray-400 text-xs">24h High</p>
            <p className="text-white">${formatPrice(data.high24h)}</p>
          </div>
          <div className="bg-gray-800 p-2 rounded">
            <p className="text-gray-400 text-xs">24h Low</p>
            <p className="text-white">${formatPrice(data.low24h)}</p>
          </div>
        </div>

        {markedChange && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Since marked:</span>
              <span className={cn(
                "text-sm font-bold",
                markedChange.percentChange >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatPercentChange(markedChange.percentChange)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Marked at ${formatPrice(markedChange.price)}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-between gap-3">
          <button
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            )}
            onClick={markStartPoint}
            disabled={isMarking}
          >
            <Flag className="w-4 h-4" />
            {isMarking ? 'Marking...' : markedChange ? 'Mark New' : 'Mark Start'}
          </button>
          <button
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              "bg-gray-800 hover:bg-gray-700 text-white"
            )}
            onClick={() => setChartData([])}
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CryptoCard;