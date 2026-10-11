import Decimal from 'decimal.js';

export interface MT5Config {
  metaApiToken: string;
  metaApiAccountId: string; // The master or default connection account if applicable
}

export interface MT5TradeRequest {
  actionType: 'ORDER_TYPE_BUY' | 'ORDER_TYPE_SELL';
  symbol: string;
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface MT5TradeResult {
  orderId: string;
  positionId: string;
  price: number;
  volume: number;
}

/**
 * MetaApi.cloud REST Client Wrapper
 * This handles communication with the MT5 Server via MetaApi.
 */
export class MT5Service {
  private baseUrl = 'https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai';

  constructor(private config: MT5Config) {}

  private get headers() {
    return {
      'auth-token': this.config.metaApiToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Provisions a new MT5 account on the broker server (Requires Manager API access via MetaApi)
   * For this implementation, we assume users are created or we use a Master account.
   */
  async createUserAccount(name: string, email: string, group: string): Promise<{ login: string, password: string }> {
    // In a real implementation with Manager API token:
    /*
    const response = await fetch(`${this.baseUrl}/users/current/accounts`, { ... })
    */
    
    // For now, this is a placeholder returning a generated login until the real manager token is provided
    return {
      login: Math.floor(1000000 + Math.random() * 9000000).toString(),
      password: crypto.randomUUID().split('-')[0],
    };
  }

  /**
   * Sync balance (Deposit/Withdraw) to MT5.
   * If a user deposits in our DB wallet, we call this to reflect balance in MT5.
   */
  async syncBalance(login: string, amount: string, type: 'DEPOSIT' | 'WITHDRAWAL', comment: string): Promise<boolean> {
    // Requires Manager API access via MetaApi to manually adjust balances
    console.log(`[MT5] Syncing Balance for ${login}: ${type} ${amount} (${comment})`);
    
    // Real implementation would call the Manager API deposit/withdraw endpoint:
    // POST /users/current/accounts/${accountId}/manager/deposit
    
    return true;
  }

  /**
   * Executes a trade on MT5
   */
  async placeTrade(accountId: string, request: MT5TradeRequest): Promise<MT5TradeResult> {
    console.log(`[MT5] Placing Trade: ${JSON.stringify(request)} on account ${accountId}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/users/current/accounts/${accountId}/trade`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          actionType: request.actionType,
          symbol: request.symbol,
          volume: request.volume,
          type: 'ORDER_TYPE_MARKET',
          openPrice: request.price,
          stopLoss: request.stopLoss,
          takeProfit: request.takeProfit
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`MT5 Trade Error: ${errText}`);
      }

      const data = (await response.json()) as any;
      return {
        orderId: data.orderId,
        positionId: data.positionId,
        price: data.price,
        volume: data.volume
      };
    } catch (e: any) {
      console.error('[MT5] Trade execution failed', e);
      throw e;
    }
  }

  /**
   * Closes an existing position on MT5
   */
  async closePosition(accountId: string, positionId: string, volume?: number): Promise<{ profit: number }> {
    console.log(`[MT5] Closing Position ${positionId} on account ${accountId} (Volume: ${volume || 'ALL'})`);
    
    try {
      const response = await fetch(`${this.baseUrl}/users/current/accounts/${accountId}/trade`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          actionType: 'POSITION_CLOSE_ID',
          positionId: positionId,
          volume: volume // if undefined, MetaApi usually closes entire position
        })
      });

      if (!response.ok) {
         const errText = await response.text();
         throw new Error(`MT5 Close Position Error: ${errText}`);
      }

      const data = (await response.json()) as any;
      return { profit: data.profit || 0 };
    } catch (e: any) {
       console.error('[MT5] Position close failed', e);
       throw e;
    }
  }

  /**
   * Fetch historical closed deals for Polling and PnL syncing
   */
  async getClosedDeals(accountId: string, startTime: Date, endTime: Date): Promise<any[]> {
    const startStr = startTime.toISOString();
    const endStr = endTime.toISOString();
    
    try {
      const response = await fetch(`${this.baseUrl}/users/current/accounts/${accountId}/history-deals/time/${startStr}/${endStr}`, {
         method: 'GET',
         headers: this.headers
      });

      if (!response.ok) {
         const errText = await response.text();
         throw new Error(`MT5 History Error: ${errText}`);
      }

      const data = (await response.json()) as any;
      return data;
    } catch (e: any) {
      console.error('[MT5] Fetching history failed', e);
      return [];
    }
  }
}
