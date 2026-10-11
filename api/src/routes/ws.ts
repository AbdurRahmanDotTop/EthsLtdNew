import { Hono } from 'hono';

// Track WebSocket connections per user for position update broadcasts
const userConnections: Map<string, Set<any>> = new Map();

export function broadcastPositionUpdate(userId: string, update: any) {
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) return;
  
  const message = JSON.stringify({ type: 'position_update', ...update });
  connections.forEach(socket => {
    try {
      socket.send(message);
    } catch (e) {
      // Socket may be closed; clean up
      connections.delete(socket);
    }
  });
}

export const wsRoutes = new Hono();

// WebSocket connections need to be upgraded by Cloudflare Workers.
wsRoutes.get('/stream', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  // @ts-ignore - Cloudflare specific WebSocketPair
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();

  let binanceWs: any = null;
  let subscribedUserId: string | null = null;

  server.addEventListener('message', (event: any) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'subscribe') {
        const symbol = data.symbol; // e.g. BTC-USDT
        
        if (binanceWs) {
          try { binanceWs.close(); } catch(e) {}
        }
        
        if (symbol === 'ALL') {
           // For Market Watch, subscribe to all tickers
           // Using miniTicker for all symbols to save bandwidth
           binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
           binanceWs.addEventListener('message', (bEvent: any) => {
             try {
                const bData = JSON.parse(bEvent.data);
                if (Array.isArray(bData)) {
                  bData.forEach((t: any) => {
                     // We don't have perfect mapping, but adding -USDT helps frontend
                     if (t.s.endsWith('USDT')) {
                       server.send(JSON.stringify({
                         type: 'ticker',
                         symbol: t.s.replace('USDT', '-USDT'),
                         price: t.c,
                         timestamp: t.E
                       }));
                     }
                  });
                }
             } catch(e) {}
           });
        } else {
           const bSymbol = symbol.replace('-', '').toLowerCase();
           // Subscribe to both ticker and 10-level depth (orderbook)
           binanceWs = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${bSymbol}@ticker/${bSymbol}@depth10@100ms`);
           
           binanceWs.addEventListener('message', (bEvent: any) => {
             try {
               const bData = JSON.parse(bEvent.data);
               const stream = bData.stream;
               const d = bData.data;

               if (stream.includes('@ticker')) {
                 server.send(JSON.stringify({
                   type: 'ticker',
                   symbol: symbol,
                   price: d.c, 
                   timestamp: d.E
                 }));
               } else if (stream.includes('@depth')) {
                 // Forward Market Depth (L2)
                 const asks = (d.a || []).map((arr: any[]) => ({ price: parseFloat(arr[0]), amount: parseFloat(arr[1]), total: parseFloat(arr[0]) * parseFloat(arr[1]) }));
                 const bids = (d.b || []).map((arr: any[]) => ({ price: parseFloat(arr[0]), amount: parseFloat(arr[1]), total: parseFloat(arr[0]) * parseFloat(arr[1]) }));
                 server.send(JSON.stringify({
                   type: 'orderbook',
                   symbol: symbol,
                   data: { asks, bids }
                 }));
               }
             } catch(e) {}
           });
        }
      } else if (data.type === 'subscribePositions') {
        // User subscribes to position updates
        // Expects a JWT token in the message for auth
        if (data.userId) {
          subscribedUserId = data.userId;
          if (!userConnections.has(data.userId)) {
            userConnections.set(data.userId, new Set());
          }
          userConnections.get(data.userId)!.add(server);
        }
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });

  server.addEventListener('close', () => {
    if (binanceWs) {
       try { binanceWs.close(); } catch(e){}
    }
    // Clean up position subscription
    if (subscribedUserId) {
      const connections = userConnections.get(subscribedUserId);
      if (connections) {
        connections.delete(server);
        if (connections.size === 0) {
          userConnections.delete(subscribedUserId);
        }
      }
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});
