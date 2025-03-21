export class CryptoWebSocket {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

      this.ws.onopen = () => {
        console.log('WebSocket Connected');
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
      };

      this.ws.onclose = () => {
        console.log('WebSocket Closed');
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
        }
        this.handleReconnect();
      };
    } catch (error) {
      console.error('WebSocket Connection Error:', error);
      this.handleReconnect();
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
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
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

  subscribe(productId: string, callback: (data: any) => void) {
    this.subscribers.set(productId, callback);
    
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

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const cryptoWebSocket = new CryptoWebSocket();