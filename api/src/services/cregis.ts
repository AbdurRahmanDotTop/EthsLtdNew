import { Bindings } from '../db';
import crypto from 'node:crypto';

export class CregisClient {
  private waasApiKey: string;
  private waasProjectId: string;
  private peApiKey: string;
  private peProjectId: string;
  private baseUrl: string;
  private proxyUrl?: string;
  private proxySecret?: string;

  constructor(env: Bindings) {
    this.waasApiKey = env.CREGIS_WAAS_API_KEY || '';
    this.waasProjectId = env.CREGIS_WAAS_PROJECT_ID || '';
    this.peApiKey = env.CREGIS_PE_API_KEY || '';
    this.peProjectId = env.CREGIS_PE_PROJECT_ID || '';
    this.baseUrl = env.CREGIS_BASE_URL || 'https://t-tkqzeuxf.cregis.io';
    this.proxyUrl = env.CREGIS_PROXY_URL;
    this.proxySecret = env.CREGIS_PROXY_SECRET;
  }

  // In a real prod environment, this calls Cregis `/v1/address/create`
  async getDepositAddress(assetSymbol: string, userId: string): Promise<string> {
    const payload = {
      currency: assetSymbol,
      alias: `user_${userId}`,
    };

    try {
      const data = await this.callProxy('WAAS', '/v1/address/create', payload);

      if (data.code === '00000' || data.code === 200 || data.success) {
        return data.data?.address || data.address;
      }

      throw new Error(`Cregis Address Creation Error [Code: ${data.code}]: ${data.msg || data.message || 'Rejected'}. Full Response: ${JSON.stringify(data)}`);
    } catch (error: any) {
      console.error("Cregis Address Fetch Error:", error);
      throw error;
    }
  }
  // Internal helper to call the PHP Proxy
  private async callProxy(service: 'PE' | 'WAAS', endpoint: string, payload: any): Promise<any> {
    if (!this.proxyUrl) {
      throw new Error("CREGIS_PROXY_URL is required to bypass Cloudflare IP restrictions.");
    }

    const proxyBody = {
      _proxy: {
        service,
        endpoint
      },
      payload
    };

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Secret': this.proxySecret || ''
      },
      body: JSON.stringify(proxyBody)
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`PHP Proxy Error (Status ${response.status}): ${responseText || 'Empty response'}`);
    }

    if (response.status !== 200 || data.error) {
       throw new Error(`PHP Proxy returned error: ${data.error || 'Unknown error'} | Details: ${data.details || ''}`);
    }

    return data;
  }

  // Create Payment Order for Cregis Payment Engine
  async createPaymentOrder(amount: number, currency: string, userId: string): Promise<string> {
    const payload = {
      amount,
      currency,
      third_party_id: userId
    };

    try {
      const data = await this.callProxy('PE', '/api/v1/payment/create', payload);

      if (data.code === '00000' || data.code === 200 || data.success) {
        if (data.data && data.data.url) return data.data.url;
        if (data.url) return data.url;
        if (data.data && data.data.cid) return `https://pay.cregis.io/?cid=${data.data.cid}&language=en-US`;
      }

      throw new Error(`Cregis Error via Proxy [Code: ${data.code}]: ${data.msg || data.message || 'API rejected the request'}. Full Response: ${JSON.stringify(data)}`);
    } catch (error: any) {
      console.error("Cregis Proxy Fetch Error:", error);
      throw error;
    }
  }

  // Create Payout (Withdrawal) via Cregis WaaS
  async createPayout(amount: number, currency: string, address: string, userId: string): Promise<string> {
    const payload = {
      currency,
      amount,
      address,
      // Provide a unique client order ID for the payout
      order_id: `PO-${userId.substring(0,5)}-${Date.now()}` 
    };

    try {
      // NOTE: Verify the exact payout endpoint from Cregis WaaS docs
      // Usually it's something like /v1/payout/create or /api/v1/payout/create
      const data = await this.callProxy('WAAS', '/v1/payout/create', payload);

      if (data.code === '00000' || data.code === 200 || data.success) {
        // Return the Cregis payout internal ID
        return data.data?.payout_id || data.data?.order_id || payload.order_id;
      }

      throw new Error(`Cregis Payout Error [Code: ${data.code}]: ${data.msg || data.message || 'Rejected'}. Full Response: ${JSON.stringify(data)}`);
    } catch (error: any) {
      console.error("Cregis Payout Fetch Error:", error);
      throw error;
    }
  }

  // Verifies Cregis webhook signatures
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.waasApiKey && !this.peApiKey) {
      console.error("Missing Cregis API Keys, webhook signature verification failed.");
      return false;
    }
    
    // Try both keys since the webhook could be from WAAS or PE
    const keysToTry = [this.waasApiKey, this.peApiKey].filter(k => k);
    
    for (const key of keysToTry) {
      try {
        const expectedSignature = crypto.createHmac('sha256', key).update(payload).digest('hex');
        if (expectedSignature.toLowerCase() === signature.toLowerCase()) {
          return true;
        }
      } catch (err) {
        console.error("Error generating signature", err);
      }
    }
    
    return false;
  }
}
