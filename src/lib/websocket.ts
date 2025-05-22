/**
 * Enum representing the various states of the WebSocket connection.
 */
export enum WebSocketState {
  /** The WebSocket is attempting to connect. */
  CONNECTING = 'CONNECTING',
  /** The WebSocket is successfully connected and operational. */
  CONNECTED = 'CONNECTED',
  /** The WebSocket is disconnected. This can be due to a manual close, network issues, or failed reconnection attempts. */
  DISCONNECTED = 'DISCONNECTED',
  /** An error occurred with the WebSocket connection. The connection might be closed or attempting to reconnect. */
  ERROR = 'ERROR',
  /** The WebSocket is temporarily disconnected and attempting to reconnect. */
  RECONNECTING = 'RECONNECTING',
}

/**
 * Interface for the ticker data object passed to subscriber callbacks.
 */
interface TickerData {
  price: string;
  time: string;
  product_id: string;
  volume_24h?: string;
  low_24h?: string;
  high_24h?: string;
  open_24h?: string;
}

/**
 * CryptoWebSocket handles WebSocket connections for real-time cryptocurrency data.
 * It provides mechanisms for subscribing to product tickers and receiving status updates
 * on the WebSocket connection.
 */
export class CryptoWebSocket {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, (data: TickerData) => void> = new Map();
  private statusCallbacks: Array<(status: WebSocketState) => void> = [];
  private currentState: WebSocketState = WebSocketState.CONNECTING;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes a new CryptoWebSocket instance and attempts to establish a connection.
   * Sets the initial state to CONNECTING.
   */
  constructor() {
    // Initial status is CONNECTING, set before calling connect
    // connect() might synchronously fail and change state.
    this.updateStatus(WebSocketState.CONNECTING);
    this.connect();
  }

  private updateStatus(newState: WebSocketState) {
    this.currentState = newState;
    this.statusCallbacks.forEach(callback => {
      try {
        callback(this.currentState);
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }

  private connect() {
    // Ensure state is CONNECTING at the beginning of each connection attempt.
    // If it was RECONNECTING, it should now be CONNECTING.
    // If it was DISCONNECTED and this is the first attempt, it should be CONNECTING.
    if (this.currentState !== WebSocketState.RECONNECTING) {
      this.updateStatus(WebSocketState.CONNECTING);
    }
    try {
      this.ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

      this.ws.onopen = () => {
        console.log('WebSocket Connected');
        this.updateStatus(WebSocketState.CONNECTED);
        this.reconnectAttempts = 0;
        this.subscribeToProducts();
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ticker' && data.product_id) {
          const callback = this.subscribers.get(data.product_id);
          if (callback) {
            callback({
              price: data.price,
              time: data.time,
              product_id: data.product_id,
              volume_24h: data.volume_24h,
              low_24h: data.low_24h,
              high_24h: data.high_24h,
              open_24h: data.open_24h
            });
          }
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        this.updateStatus(WebSocketState.ERROR);
        // WebSocket usually closes after an error, onclose will handle actual DISCONNECTED state
      };

      this.ws.onclose = () => {
        console.log('WebSocket Closed');
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
        }
        // Update status to DISCONNECTED before attempting to reconnect
        this.updateStatus(WebSocketState.DISCONNECTED);
        this.handleReconnect();
      };
    } catch (error) {
      console.error('WebSocket Connection Error:', error);
      // If constructor or new WebSocket fails.
      this.updateStatus(WebSocketState.ERROR); // Or DISCONNECTED if more appropriate
      this.handleReconnect(); // Attempt to reconnect even on initial connection error
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.updateStatus(WebSocketState.RECONNECTING);
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.log('Max reconnect attempts reached. WebSocket will remain disconnected.');
      // Ensure state is DISCONNECTED if max attempts are reached and no more retries.
      // The onclose handler would have already set it to DISCONNECTED.
      // If it was RECONNECTING and then failed, it should be set to DISCONNECTED.
      if (this.currentState !== WebSocketState.DISCONNECTED) {
         this.updateStatus(WebSocketState.DISCONNECTED);
      }
    }
  }

  private subscribeToProducts() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const products = Array.from(this.subscribers.keys());
      if (products.length > 0) {
        const subscribeMessage = {
          type: 'subscribe',
          channels: [
            {
              name: 'ticker',
              product_ids: products
            }
          ]
        };
        console.log('Subscribing to products:', products);
        this.ws.send(JSON.stringify(subscribeMessage));
      }
    }
  }

  /**
   * Subscribes to real-time ticker updates for a specific product ID (e.g., "BTC-USD").
   * The provided callback will be invoked with new data for that product.
   * If the WebSocket is not currently connected, the subscription will be activated
   * once the connection is established.
   *
   * @param productId - The product ID to subscribe to (e.g., "BTC-USD", "ETH-USD").
   *                    The symbol should typically be in uppercase.
   * @param callback - A function to be called with the ticker data for the subscribed product.
   *                   The data object includes fields like `price`, `time`, `product_id`, etc.
   * @returns A function that can be called to unsubscribe from this specific product's updates.
   */
  subscribe(productId: string, callback: (data: TickerData) => void): () => void {
    this.subscribers.set(productId, callback);
    
    // If already connected, send the subscribe message immediately.
    // Otherwise, subscribeToProducts() will handle it upon connection.
    if (this.ws?.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        channels: [
          {
            name: 'ticker',
            product_ids: [productId]
          }
        ]
      };
      console.log('Subscribing to product:', productId);
      this.ws.send(JSON.stringify(subscribeMessage));
    }

    return () => {
      this.subscribers.delete(productId);
      if (this.ws?.readyState === WebSocket.OPEN) {
        const unsubscribeMessage = {
          type: 'unsubscribe',
          channels: [
            {
              name: 'ticker',
              product_ids: [productId]
            }
          ]
        };
        this.ws.send(JSON.stringify(unsubscribeMessage));
      }
    };
  }

  /**
   * Registers a callback function to be invoked when the WebSocket connection status changes.
   * The callback will also be immediately invoked with the current status upon registration.
   * @param callback - The function to call with the new WebSocketState.
   */
  onStatusChange(callback: (status: WebSocketState) => void) {
    if (!this.statusCallbacks.includes(callback)) {
      this.statusCallbacks.push(callback);
    }
    // Immediately notify the new subscriber of the current state
    try {
      callback(this.currentState);
    } catch (error) {
      console.error('Error in initial status callback:', error);
    }
  }

  /**
   * Unregisters a previously registered status change callback function.
   * @param callback - The callback function to remove.
   */
  offStatusChange(callback: (status: WebSocketState) => void) {
    this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Closes the WebSocket connection.
   * Status will be updated to DISCONNECTED via the onclose event.
   */
  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.ws) {
      // Setting maxReconnectAttempts to 0 ensures it won't try to reconnect after a manual close.
      this.reconnectAttempts = this.maxReconnectAttempts; 
      this.ws.close();
      // Note: ws will be set to null in onclose or after reconnect attempts fail
    }
  }

  /**
   * Gets the current WebSocket connection state.
   * @returns The current WebSocketState.
   */
  public getCurrentState(): WebSocketState {
    return this.currentState;
  }
}

export const cryptoWebSocket = new CryptoWebSocket();