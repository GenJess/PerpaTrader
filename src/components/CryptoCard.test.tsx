import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react'; // Removed waitFor
import { vi } from 'vitest';
import CryptoCard from './CryptoCard'; // Adjust path as necessary
import { WebSocketState } from '../lib/websocket'; // Assuming this is needed for mocks

// --- Mocks ---

// Re-define CoinbaseTickerMessage for use in mockWebSocketCallback type
// Ideally, this would be imported from a shared types file or CryptoCard.tsx itself if module resolution allows.
interface CoinbaseTickerMessage {
  product_id: string;
  price: string;
  time: string;
  volume_24h?: string;
  low_24h?: string;
  high_24h?: string;
  open_24h?: string;
}

// Mock lucide-react icons
vi.mock('lucide-react', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal() as any;
  return {
    ...actual,
    ArrowUpCircle: () => <span data-testid="icon-arrow-up">Up</span>,
    ArrowDownCircle: () => <span data-testid="icon-arrow-down">Down</span>,
    Flag: () => <span data-testid="icon-flag">Flag</span>,
    RefreshCcw: () => <span data-testid="icon-refresh">Refresh</span>,
  };
});

// Mock recharts
vi.mock('recharts', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal() as any;
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Line: () => <div data-testid="line" />,
  };
});

// Mock ../lib/websocket
let mockWebSocketCallback: ((data: CoinbaseTickerMessage) => void) | null = null;
const mockUnsubscribe = vi.fn();
vi.mock('../lib/websocket', () => ({
  cryptoWebSocket: {
    subscribe: vi.fn((productId, callback) => {
      mockWebSocketCallback = callback;
      // console.log(`Mock subscribe called for ${productId}`);
      return mockUnsubscribe; // Return the mock unsubscribe function
    }),
    // Mock other methods if CryptoCard uses them directly (e.g., onStatusChange)
    onStatusChange: vi.fn((callback) => callback(WebSocketState.CONNECTED)), // Simulate connected state
    offStatusChange: vi.fn(),
    getCurrentState: vi.fn(() => WebSocketState.CONNECTED),
  },
  WebSocketState: { // Ensure WebSocketState enum is available if needed by the component
      CONNECTING: 'CONNECTING',
      CONNECTED: 'CONNECTED',
      DISCONNECTED: 'DISCONNECTED',
      ERROR: 'ERROR',
      RECONNECTING: 'RECONNECTING',
  }
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });


// --- Utility Functions for Tests ---
const initialCryptoData = {
  symbol: 'BTC',
  name: 'Bitcoin',
};

const sampleWebSocketData = {
  product_id: 'BTC-USD',
  price: '50000.00',
  time: new Date().toISOString(),
  volume_24h: '1000',
  low_24h: '48000.00',
  high_24h: '52000.00',
  open_24h: '49000.00',
};

describe('CryptoCard Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    localStorageMock.clear();
    mockWebSocketCallback = null; // Reset shared callback
  });

  it('renders initial loading state and basic info', () => {
    render(<CryptoCard {...initialCryptoData} />);
    
    // Check for name and symbol
    expect(screen.getByText(initialCryptoData.symbol.toUpperCase())).toBeInTheDocument();
    expect(screen.getByText(initialCryptoData.name)).toBeInTheDocument();

    // The component structure has changed, loading state is brief.
    // We check that subscribe was called, indicating it's trying to load data.
    expect(vi.mocked(global.cryptoWebSocket.subscribe)).toHaveBeenCalledWith(
      `${initialCryptoData.symbol.toUpperCase()}-USD`,
      expect.any(Function)
    );
    // Initial data is null, so some elements reflecting data might not be there yet.
    // Price might show $0.00 or a placeholder if data is null initially.
    // Let's check for a common element that would be there even before first data.
    expect(screen.getByText('24h High')).toBeInTheDocument(); // This part of layout should be there
  });

  it('displays data correctly after WebSocket update', async () => {
    render(<CryptoCard {...initialCryptoData} />);

    expect(mockWebSocketCallback).not.toBeNull();
    if (mockWebSocketCallback) {
      act(() => {
        mockWebSocketCallback(sampleWebSocketData);
      });
    }

    // Check for price (formatted)
    // formatPrice(50000) -> "50,000.00"
    await screen.findByText('$50,000.00'); 
    
    // Check for 24h high and low
    // formatPrice(52000) -> "52,000.00"
    // formatPrice(48000) -> "48,000.00"
    expect(screen.getByText('$52,000.00')).toBeInTheDocument();
    expect(screen.getByText('$48,000.00')).toBeInTheDocument();

    // Percentage change (initial change is vs itself so 0, then updates)
    // The component initializes data.change24h to 0, then calculates.
    // First data point: price = 50000. prevData is null. change24h = 0.
    // Let's send another update to see a change.
    const secondWebSocketData = { ...sampleWebSocketData, price: '51000.00', time: new Date().toISOString() };
    if (mockWebSocketCallback) {
      act(() => {
        mockWebSocketCallback(secondWebSocketData);
      });
    }
    // Price: 51000. Prev Price: 50000. Change: ((51000-50000)/50000)*100 = 2%
    // formatPercentChange(2) -> "+2.00%"
    await screen.findByText('+2.00%');
    expect(screen.getByTestId('icon-arrow-up')).toBeInTheDocument(); // Positive change
  });

  it('handles "Mark Start Point" interaction and localStorage', async () => {
    render(<CryptoCard {...initialCryptoData} />);

    // Ensure data is loaded first so mark button can use currentPrice
    expect(mockWebSocketCallback).not.toBeNull();
    if (mockWebSocketCallback) {
      act(() => {
        mockWebSocketCallback(sampleWebSocketData); // Price: 50000
      });
    }
    await screen.findByText('$50,000.00'); // Wait for price to render

    const markButton = screen.getByRole('button', { name: /Mark Start/i });
    expect(markButton).toBeInTheDocument();

    fireEvent.click(markButton);

    // Check localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `markedChange_${initialCryptoData.symbol.toUpperCase()}`,
      JSON.stringify({ price: 50000, timestamp: expect.any(Number) })
    );

    // Check if "Since marked" section appears
    // formatPercentChange(0) initially -> "+0.00%"
    expect(await screen.findByText('Since marked:')).toBeInTheDocument();
    expect(screen.getByText('+0.00%')).toBeInTheDocument(); // Initial marked change is 0%
    expect(screen.getByText(/Marked at \$50,000.00/i)).toBeInTheDocument();


    // Simulate new WebSocket data to see "Since marked" update
    const updatedData = { ...sampleWebSocketData, price: '55000.00', time: new Date().toISOString() }; // 10% increase
    if (mockWebSocketCallback) {
      act(() => {
        mockWebSocketCallback(updatedData);
      });
    }
    // (55000 - 50000) / 50000 * 100 = 10%
    // formatPercentChange(10) -> "+10.00%"
    // Need to use await findByText for text that updates due to state change
    expect(await screen.findByText('+10.00%')).toBeInTheDocument();
    expect(screen.getByTestId('icon-arrow-up')).toBeInTheDocument(); // Positive change indicator
  });
  
  it('loads marked point from localStorage on mount', async () => {
    const storedMark = { price: 45000, timestamp: Date.now() - 100000 };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedMark));

    render(<CryptoCard {...initialCryptoData} />);
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith(`markedChange_${initialCryptoData.symbol.toUpperCase()}`);
    
    // "Since marked" section should appear with loaded data
    expect(await screen.findByText('Since marked:')).toBeInTheDocument();
    expect(screen.getByText(/Marked at \$45,000.00/i)).toBeInTheDocument();

    // Send WebSocket data to calculate percentChange based on loaded mark
    // Price: 50000 (from sampleWebSocketData), Marked Price: 45000
    // Change: ((50000 - 45000) / 45000) * 100 = 11.111...%
    // formatPercentChange(11.111...) -> "+11.11%"
    if (mockWebSocketCallback) {
      act(() => {
        mockWebSocketCallback(sampleWebSocketData);
      });
    }
    expect(await screen.findByText('+11.11%')).toBeInTheDocument();
  });


  it('renders the chart container', () => {
    render(<CryptoCard {...initialCryptoData} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('calls unsubscribe on unmount', () => {
    const { unmount } = render(<CryptoCard {...initialCryptoData} />);
    
    expect(vi.mocked(global.cryptoWebSocket.subscribe)).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
