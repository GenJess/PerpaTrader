import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, RefreshCcw, Flag } from 'lucide-react';
import { cn, formatPrice, formatPercentChange, formatTimestamp } from '../lib/utils';
import { cryptoWebSocket } from '../lib/websocket';

interface CryptoCardProps {
  symbol: string;
  name: string;
}

interface CryptoData {
  currentPrice: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

interface ChartDataPoint {
  timestamp: number;
  price: number;
}

interface MarkedChange {
  price: number;
  timestamp: number;
  percentChange: number;
}

const CryptoCard: React.FC<CryptoCardProps> = ({ symbol, name }) => {
  const [data, setData] = useState<CryptoData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markedChange, setMarkedChange] = useState<MarkedChange | null>(null);
  const [isMarking, setIsMarking] = useState(false);

  const handleWebSocketData = useCallback((wsData: any) => {
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

  const markStartPoint = () => {
    setIsMarking(true);
    if (data) {
      setMarkedChange({
        price: data.currentPrice,
        timestamp: Date.now(),
        percentChange: 0
      });
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