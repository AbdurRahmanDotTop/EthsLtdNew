const priceCache = new Map<string, { price: number, timestamp: number }>();
const CACHE_TTL = 3000; // 3 seconds cache

export const getRealPrice = async (symbol: string): Promise<number | null> => {
  const symbolNoDash = symbol.replace('-', '');
  
  // Check cache first
  const cached = priceCache.get(symbolNoDash);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.price;
  }

  let finalPrice: number | null = null;
  
  // 1. Try MEXC (Cloudflare worker friendly)
  try {
    const res = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbolNoDash}`);
    if (res.ok) {
      const data = await res.json() as any;
      if (data.price) finalPrice = parseFloat(data.price);
    }
  } catch (e) {
    console.warn(`MEXC price fetch failed for ${symbol}`);
  }

  // 2. Try Binance as fallback (May be blocked by CF)
  if (!finalPrice) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbolNoDash}`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data.price) finalPrice = parseFloat(data.price);
      }
    } catch (e) {
      console.warn(`Binance price fetch failed for ${symbol}`);
    }
  }
  
  // 3. Try KuCoin as fallback
  if (!finalPrice) {
    try {
      const res = await fetch(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data.data && data.data.price) finalPrice = parseFloat(data.data.price);
      }
    } catch (e) {
      console.warn(`KuCoin price fetch failed for ${symbol}`);
    }
  }

  if (finalPrice !== null) {
    priceCache.set(symbolNoDash, { price: finalPrice, timestamp: Date.now() });
  }

  return finalPrice;
};
