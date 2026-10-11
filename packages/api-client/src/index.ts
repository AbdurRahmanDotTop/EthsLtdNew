import { User } from '@ethsltd/types';

export class EthsltdClient {
  private baseUrl: string;
  private token: string | null = null;
  private isLoggingOut = false;

  constructor(baseUrl?: string) {
    if (typeof window !== 'undefined') {
      // In the browser, ALWAYS use relative path to hit the Next.js rewrite proxy.
      // This ensures cookies are strictly same-domain and never blocked by 3rd-party policies.
      this.baseUrl = '';
    } else {
      // On the server (Next.js SSR/Edge), use the absolute external API URL
      this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'https://api.ethsltd.com';
    }
    // We rely purely on the HttpOnly cookie for session management in the browser
    // via credentials: 'include'. localStorage is no longer used for tokens.
  }

  // Local session sync is no longer required as we use the API's HttpOnly cookie directly
  
  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options?: RequestInit & { skipGlobal401?: boolean }): Promise<{ success: boolean; data?: T; error?: any; message?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        cache: 'no-store',
        credentials: 'include',
        ...options,
        headers,
      });
      
      const contentType = res.headers.get('content-type');
      let data: any;
      
      try {
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          try {
            data = JSON.parse(text);
          } catch(e) {
            data = { success: false, error: `Server returned non-JSON (${res.status}): ${text.substring(0, 200)}` };
          }
        }
      } catch (err: any) {
        return { success: false, error: `Failed to parse response: ${err.message}` };
      }

      if (!res.ok && !data?.error) {
        return { success: false, data, error: `HTTP Error ${res.status}` };
      }
      
      // Handle 401 globally
      if (res.status === 401 && !options?.skipGlobal401) {
        if (!this.isLoggingOut) {
          this.isLoggingOut = true;
          this.setToken(null);
          
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:required', { detail: { message: data?.error || 'Session expired or invalid' } }));
          }
          
          // Release lock after a short delay
          setTimeout(() => {
            this.isLoggingOut = false;
          }, 2000);
        }
      }

      return data;
    } catch (e: any) {
      return { success: false, error: e.message || 'Network Error' };
    }
  }

  async getMe() {
    return this.request<User>('/api/v1/auth/me', { skipGlobal401: true });
  }

  async login(email: string, password: string, mfaToken?: string) {
    const res = await this.request<{ token: string; user: User }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, mfaToken }),
      skipGlobal401: true,
    });
    
    if (res.success && (res as any).token) {
      this.setToken((res as any).token);
    }
    return res;
  }

  async logout() {
    const res = await this.request('/api/v1/auth/logout', { method: 'POST' });
    this.setToken(null);
    return res;
  }

  async register(email: string, password: string) {
    const res = await this.request<{ token: string; user: User }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (res.success && (res as any).token) {
      this.setToken((res as any).token);
    }
    return res;
  }

  async verifyEmailWithToken(token: string) {
    return this.request<any>('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  async requestEmailVerificationOTP() {
    return this.request<any>('/api/v1/auth/verify-email/request-otp', {
      method: 'POST',
    });
  }

  async confirmEmailVerificationOTP(otp: string) {
    return this.request<any>('/api/v1/auth/verify-email/confirm-otp', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  }

  async requestPasswordReset(email: string) {
    return this.request<any>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(password: string, token: string) {
    return this.request<any>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password, token }),
    });
  }



  async changePassword(data: any) {
    return this.request<any>('/api/v1/settings/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getKYC() {
    return this.request<any>('/api/v1/settings/kyc');
  }

  async submitKYC(data: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    country: string;
    documentType: string;
    documentNumber: string;
    documentFrontBase64?: string;
    documentBackBase64?: string;
    selfieBase64?: string;
  }) {
    return this.request<any>('/api/v1/settings/kyc', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }


  async getWallets(userId: string) {
    return this.request<any[]>(`/api/v1/wallets?userId=${userId}`);
  }

  async getWalletBalances() {
    return this.request<any[]>(`/api/v1/wallets/balances`);
  }

  async getWalletPortfolio() {
    return this.request<any>(`/api/v1/wallets/portfolio`);
  }

  async getWalletTransactions(): Promise<any> {
    return this.request<any[]>(`/api/v1/wallets/transactions`);
  }

  async getAssetConversions(): Promise<any> {
    return this.request<any[]>('/api/v1/wallets/asset-conversions');
  }

  async getDepositSettings() {
    return this.request<any>('/api/v1/wallets/deposit-settings');
  }

  async getDepositPreview(amount: number, currency: string, methodId?: string | null) {
    let url = `/api/v1/wallets/deposit/preview?amount=${amount}&currency=${currency}`;
    if (methodId) url += `&methodId=${methodId}`;
    return this.request<any>(url);
  }

  async getWithdrawalPreview(amount: number, currency: string, methodId?: string | null) {
    let url = `/api/v1/wallets/withdrawal/preview?amount=${amount}&currency=${currency}`;
    if (methodId) url += `&methodId=${methodId}`;
    return this.request<any>(url);
  }

  async deposit(data: { 
    assetSymbol: string; 
    amount: number; 
    network?: string; 
    destination?: string; 
    depositMethod?: string;
    transactionHash?: string;
    paymentReference?: string;
    proofFileUrl?: string;
  }): Promise<any> {
    return this.request<any>('/api/v1/wallets/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<any>;
  }

  async withdraw(data: { assetSymbol: string; amount: number; network?: string; destination?: string }) {
    return this.request<any>('/api/v1/wallets/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }


  // Trading Data API Methods
  async getMarkets(params?: any) {
    return this.request<any[]>('/api/v1/trading/markets');
  }

  async getMarketCandles(symbol: string, interval: string = '15m') {
    return this.request<any[]>(`/api/v1/trading/markets/${symbol}/candles?interval=${interval}`);
  }

  async getMarketOrderBook(symbol: string) {
    return this.request<any>(`/api/v1/trading/markets/${symbol}/orderbook`);
  }

  async getMarketTrades(symbol: string) {
    return this.request<any>(`/api/v1/trading/markets/${symbol}/trades`);
  }

  // Fiat Exchange Rates
  async getExchangeRate(base: string = 'USDT', quote: string = 'INR') {
    return this.request<any>(`/api/v1/trading/exchange-rate?base=${base}&quote=${quote}`);
  }

  // Trading Execution API Methods
  async getOrders() {
    return this.request<any[]>(`/api/v1/trading/orders`);
  }

  async getTrades() {
    return this.request<any[]>(`/api/v1/trading/trades`);
  }



  async createOrder(data: any) {
    return this.request<any>('/api/v1/trading/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelOrder(orderId: string) {
    return this.request<any>(`/api/v1/trading/orders/${orderId}`, {
      method: 'DELETE',
    });
  }
  
  
  // Positions & Orders API Methods
  async getPositions() {
    return this.request<any[]>('/api/v1/trading/positions');
  }

  async closePosition(positionId: string, data?: { amount: number }) {
    return this.request<any>(`/api/v1/trading/positions/${positionId}/close`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    });
  }

  // P2P API Methods
  async getP2pAds(params?: Record<string, any>) {
    const searchParams = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.append(k, v.toString());
        }
      }
    }
    const query = searchParams.toString();
    return this.request<any[]>(`/api/v1/p2p/ads${query ? '?' + query : ''}`);
  }

  async createP2pAd(data: any) {
    return this.request<any>('/api/v1/p2p/ads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateP2pAd(adId: string, data: any) {
    return this.request<any>(`/api/v1/p2p/ads/${adId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async closeP2pAd(adId: string) {
    return this.request<any>(`/api/v1/p2p/ads/${adId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'CANCELED' }),
    });
  }

  async getP2pOrders(params?: Record<string, any>) {
    const searchParams = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.append(k, v.toString());
        }
      }
    }
    const query = searchParams.toString();
    return this.request<any[]>(`/api/v1/p2p/orders${query ? '?' + query : ''}`);
  }

  async createP2pOrder(data: any) {
    return this.request<any>('/api/v1/p2p/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateP2pOrderStatus(orderId: string, action: 'pay' | 'release' | 'cancel' | 'dispute') {
    let endpointAction: string = action;
    if (action === 'pay') endpointAction = 'mark-paid';
    return this.request<any>(`/api/v1/p2p/orders/${orderId}/${endpointAction}`, {
      method: 'POST',
    });
  }

  async getP2pOrder(orderId: string): Promise<{ success: boolean; data?: any; merchant?: any; error?: any }> {
    return this.request<any>(`/api/v1/p2p/orders/${orderId}`);
  }

  async getP2pMessages(orderId: string) {
    return this.request<any[]>(`/api/v1/p2p/orders/${orderId}/messages`);
  }

  async sendP2pMessage(orderId: string, content: string) {
    return this.request<any>(`/api/v1/p2p/orders/${orderId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // 2FA Methods
  async generateMfa() {
    return this.request<any>('/api/v1/2fa/generate', { method: 'POST' });
  }

  async enableMfa(code: string, secret?: string) {
    // Note: The frontend page only passes `mfaToken`, so we must check signature
    return this.request<any>('/api/v1/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ secret, code }),
    });
  }

  async disableMfa(code: string) {
    return this.request<any>('/api/v1/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // Admin API Methods
  async getAdminStats() {
    return this.request<any>('/api/v1/admin/stats');
  }

  async getAdminP2pStats(params?: { startDate?: string; endDate?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<any>(`/api/v1/admin/stats/p2p${qs}`);
  }

  // Admin Withdrawal Methods
  async adminGetWithdrawals(status?: string) {
    const qs = status && status !== 'ALL' ? `?status=${status}` : '';
    return this.request<any[]>(`/api/v1/admin/withdrawals${qs}`);
  }

  async adminApproveWithdrawal(id: string) {
    return this.request<any>(`/api/v1/admin/withdrawals/${id}/approve`, { method: 'POST' });
  }

  async adminRejectWithdrawal(id: string, notes?: string) {
    return this.request<any>(`/api/v1/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async adminDeleteWithdrawal(id: string) {
    return this.request<any>(`/api/v1/admin/withdrawals/${id}`, { method: 'DELETE' });
  }

  async adminUpdateWithdrawalNotes(id: string, notes: string) {
    return this.request<any>(`/api/v1/admin/withdrawals/${id}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
  }

  // Admin KYC Methods
  async getAdminPendingKYC() {
    return this.request<any[]>('/api/v1/admin/kyc');
  }

  async updateAdminKYCStatus(id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    if (status === 'APPROVED') {
      return this.request<any>(`/api/v1/admin/kyc/${id}/approve`, { method: 'POST' });
    } else {
      return this.request<any>(`/api/v1/admin/kyc/${id}/reject`, { 
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    }
  }

  // Admin Expert Methods
  async adminGetExperts() {
    return this.request<any[]>('/api/v1/admin/experts');
  }

  async adminUpdateExpertStatus(expertId: string, status: string) {
    return this.request<any>(`/api/v1/admin/experts/${expertId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async adminCreateExpert(data: { email: string; bio: string; experienceYears: number; categories: string[]; languages: string[] }) {
    return this.request<any>('/api/v1/admin/experts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAdminUsers(params: { page?: number; limit?: number; search?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    
    return this.request<any>(`/api/v1/admin/users?${query.toString()}`);
  }

  async getAdminUserDetails(userId: string) {
    return this.request<any>(`/api/v1/admin/users/${userId}`);
  }

  async updateAdminUserStatus(userId: string, status: string) {
    return this.request<any>(`/api/v1/admin/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async updateAdminUserRole(userId: string, role: string) {
    return this.request<any>(`/api/v1/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async adjustAdminUserWallet(userId: string, assetSymbol: string, amount: string, type: 'REAL', action: 'CREDIT' | 'DEBIT', targetField: 'balance' | 'lockedBalance' | 'escrowBalance' = 'balance', notes?: string) {
    return this.request<any>(`/api/v1/admin/users/${userId}/wallets/adjust`, {
      method: 'POST',
      body: JSON.stringify({ assetSymbol, amount, type, action, targetField, notes }),
    });
  }

  async adminResetUserPassword(userId: string, newPassword: string) {
    return this.request<any>(`/api/v1/admin/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async adminDeleteUser(userId: string) {
    return this.request<any>(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }



  async getAdminTransactions() {
    return this.request<any[]>('/api/v1/admin/transactions');
  }

  async getAdminWalletsOverview() {
    return this.request<any>('/api/v1/admin/wallets/overview');
  }

  async getAdminUserWalletsList(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any>(`/api/v1/admin/wallets/users${query}`);
  }

  // New Admin API Methods
  async getAdminApiKeys() {
    return this.request<any[]>('/api/v1/admin/api-keys');
  }

  async revokeAdminApiKey(id: string) {
    return this.request<any>(`/api/v1/admin/api-keys/${id}/revoke`, { method: 'POST' });
  }

  async getAdminAuditLogs() {
    return this.request<any[]>('/api/v1/admin/audit');
  }

  async getAdminContracts() {
    return this.request<any[]>('/api/v1/admin/contracts');
  }

  // Admin Risk
  async getAdminRiskSummary() {
    return this.request<any>('/api/v1/admin/risk/summary');
  }

  async getAdminRiskAlerts() {
    return this.request<any[]>('/api/v1/admin/risk');
  }

  async getAdminSystemStatus() {
    return this.request<any>('/api/v1/admin/system');
  }

  // Admin Deposits & Payments Methods
  async adminGetPendingDeposits() {
    return this.request<any>('/api/v1/admin/payments/pending-deposits');
  }

  async adminApproveManualDeposit(id: string) {
    return this.request<any>(`/api/v1/admin/payments/manual-deposits/${id}/approve`, {
      method: 'POST'
    });
  }

  async adminRejectManualDeposit(id: string, notes?: string) {
    return this.request<any>(`/api/v1/admin/payments/manual-deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async adminDeleteManualDeposit(id: string) {
    return this.request<any>(`/api/v1/admin/payments/manual-deposits/${id}`, {
      method: 'DELETE'
    });
  }

  async adminApproveBankDeposit(id: string) {
    return this.request<any>(`/api/v1/admin/payments/bank-deposits/${id}/approve`, {
      method: 'POST'
    });
  }

  async adminRejectBankDeposit(id: string, notes?: string) {
    return this.request<any>(`/api/v1/admin/payments/bank-deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async adminDeleteBankDeposit(id: string) {
    return this.request<any>(`/api/v1/admin/payments/bank-deposits/${id}`, {
      method: 'DELETE'
    });
  }

  // Admin Withdrawals Methods





  // Notifications API Methods
  async getNotifications() {
    return this.request<any[]>('/api/v1/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`/api/v1/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request<any>('/api/v1/notifications/read-all', {
      method: 'POST',
    });
  }

  // Support API Methods
  async getTickets() {
    return this.request<any[]>('/api/v1/support/tickets');
  }

  async createTicket(data: { subject: string; category: string; message: string; priority?: string }) {
    return this.request<any>('/api/v1/support/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTicketMessages(ticketId: string) {
    return this.request<any[]>(`/api/v1/support/tickets/${ticketId}/messages`);
  }

  async sendTicketMessage(ticketId: string, content: string, attachmentBase64?: string) {
    return this.request<any>(`/api/v1/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, attachmentBase64 }),
    });
  }

  // Admin Platform Settings
  async adminGetPlatformSettings() {
    return this.request<any[]>('/api/v1/admin/platform-settings');
  }

  async adminUpdatePlatformSetting(key: string, data: { value: string; description?: string }) {
    return this.request<any>(`/api/v1/admin/platform-settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Admin System Settings
  async adminGetSystemSettings() {
    return this.request<any>('/api/v1/admin/system-settings');
  }

  async adminUpdateSystemSettings(data: Record<string, string>) {
    return this.request<any>('/api/v1/admin/system-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================
  // SETTINGS (Profile, MFA, Sessions)
  // ==========================

  // Profile
  async getProfile() {
    return this.request<any>('/api/v1/settings/profile');
  }

  async updateProfile(data: { displayName?: string; firstName?: string; lastName?: string; avatarUrl?: string }) {
    return this.request<any>('/api/v1/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // MFA



  // Sessions
  async getSessions() {
    return this.request<any[]>('/api/v1/settings/sessions');
  }

  async revokeSession(sessionId: string) {
    return this.request<any>(`/api/v1/settings/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async revokeAllOtherSessions() {
    return this.request<any>('/api/v1/settings/sessions/all-except-current', {
      method: 'DELETE',
    });
  }

  // Admin Deposit Settings
  async adminGetDepositSettings() {
    return this.request<any>('/api/v1/admin/deposit-settings');
  }

  async adminCreateDepositSettings(data: any) {
    return this.request<any>('/api/v1/admin/deposit-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateDepositSettings(id: string, data: any) {
    return this.request<any>(`/api/v1/admin/deposit-settings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteDepositSettings(id: string) {
    return this.request<any>(`/api/v1/admin/deposit-settings/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin Bank Accounts
  async adminGetBankAccounts() {
    return this.request<any>('/api/v1/admin/bank-accounts');
  }

  async adminCreateBankAccount(data: any) {
    return this.request<any>('/api/v1/admin/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateBankAccount(id: string, data: any) {
    return this.request<any>(`/api/v1/admin/bank-accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteBankAccount(id: string) {
    return this.request<any>(`/api/v1/admin/bank-accounts/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin Support Tickets
  async adminGetSupportTickets() {
    return this.request<any[]>('/api/v1/admin/support/tickets');
  }

  async adminGetSupportTicketDetails(ticketId: string) {
    return this.request<any>(`/api/v1/admin/support/tickets/${ticketId}`);
  }

  async adminSendSupportMessage(ticketId: string, content: string, isInternalNote?: boolean, attachmentBase64?: string) {
    return this.request<any>(`/api/v1/admin/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, isInternalNote, attachmentBase64 }),
    });
  }

  async adminUpdateSupportTicketStatus(ticketId: string, status: string) {
    return this.request<any>(`/api/v1/admin/support/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // ==========================
  // EXPERTS
  // ==========================

  async getExperts() {
    return this.request<any[]>('/api/v1/experts');
  }

  async getExpert(id: string) {
    return this.request<any>(`/api/v1/experts/${id}`);
  }

  async getExpertServices(expertId: string) {
    return this.request<any[]>(`/api/v1/experts/${expertId}/services`);
  }

  async applyForExpert(data: { bio: string; experienceYears: number; languages: string[]; categories: string[] }) {
    return this.request<any>('/api/v1/experts/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bookExpertService(data: { serviceId: string; scheduledAt?: string }) {
    return this.request<any>('/api/v1/experts/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyExpertBookings() {
    return this.request<any[]>('/api/v1/experts/bookings/me');
  }

  async submitExpertReview(bookingId: string, rating: number, comment: string) {
    return this.request<any>(`/api/v1/experts/bookings/${bookingId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  }

  // EXPERT DASHBOARD
  async expertGetMe() {
    return this.request<any>('/api/v1/experts/dashboard/me');
  }

  async expertUpdateMe(data: any) {
    return this.request<any>('/api/v1/experts/dashboard/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async expertGetServices() {
    return this.request<any[]>('/api/v1/experts/dashboard/services');
  }

  async expertCreateService(data: any) {
    return this.request<any>('/api/v1/experts/dashboard/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async expertUpdateService(serviceId: string, data: any) {
    return this.request<any>(`/api/v1/experts/dashboard/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async expertDeleteService(serviceId: string) {
    return this.request<any>(`/api/v1/experts/dashboard/services/${serviceId}`, {
      method: 'DELETE',
    });
  }

  async expertGetBookings() {
    return this.request<any[]>('/api/v1/experts/dashboard/bookings');
  }

  async expertActionBooking(bookingId: string, action: 'ACCEPT' | 'REJECT' | 'COMPLETE') {
    return this.request<any>(`/api/v1/experts/dashboard/bookings/${bookingId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  // EXPERT MESSAGING
  async getExpertMessages(bookingId: string) {
    return this.request<any>(`/api/v1/experts/bookings/${bookingId}/messages`);
  }

  async sendExpertMessage(bookingId: string, content: string) {
    return this.request<any>(`/api/v1/experts/bookings/${bookingId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async expertToggleChat(bookingId: string, chatEnabled: boolean) {
    return this.request<any>(`/api/v1/experts/dashboard/bookings/${bookingId}/chat-toggle`, {
      method: 'PUT',
      body: JSON.stringify({ chatEnabled }),
    });
  }

  async readNotification(id: string) {
    return this.request<any>(`/api/v1/notifications/${id}/read`, {
      method: 'PATCH'
    });
  }

  async readAllNotifications() {
    return this.request<any>('/api/v1/notifications/read-all', {
      method: 'POST'
    });
  }



  // Admin Currency Rates
  async adminGetCurrencyRates() {
    return this.request<any[]>('/api/v1/admin/currency-rates');
  }

  async adminCreateCurrencyRate(data: any) {
    return this.request<any>('/api/v1/admin/currency-rates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateCurrencyRate(code: string, data: any) {
    return this.request<any>(`/api/v1/admin/currency-rates/${code}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateCurrencyRateStatus(code: string, status: string) {
    return this.request<any>(`/api/v1/admin/currency-rates/${code}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async adminDeleteCurrencyRate(code: string) {
    return this.request<any>(`/api/v1/admin/currency-rates/${code}`, {
      method: 'DELETE',
    });
  }

  async adminGetCurrencyRateHistory(code: string) {
    return this.request<any[]>(`/api/v1/admin/currency-rates/${code}/history`);
  }

  // Admin Users
  async adminUpdateUserStatus(userId: string, status: string) {
    return this.request<any>(`/api/v1/admin/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  }

  // Admin P2P
  async adminGetP2POrders() {
    return this.request<any[]>('/api/v1/admin/p2p/orders');
  }

  async adminGetP2PDisputes() {
    return this.request<any[]>('/api/v1/admin/p2p/disputes');
  }

  async adminResolveP2PDispute(disputeId: string, resolution: string, notes?: string) {
    return this.request<any>(`/api/v1/admin/p2p/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, notes }),
    });
  }
  // Admin Trading (Phase 1 Dynamic Isolation)

  async getAdminVolumeChart() {
    return this.request<any>('/api/v1/admin/stats/volume-chart');
  }

  async getAdminRecentActivity() {
    return this.request<any>('/api/v1/admin/stats/recent-activity');
  }

  async adminGetMarkets() {
    return this.request<any[]>(`/api/v1/admin/trading/markets`);
  }

  async adminUpdateMarketStatus(symbol: string, status: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/trading/markets/${symbol}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  async adminAddMarket(data: {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    minPrice: string;
    maxPrice: string;
    tickSize: string;
    minAmount: string;
    stepSize: string;
  }) {
    return this.request<{ success: boolean; data?: any }>(`/api/v1/admin/trading/markets`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }



  async adminGetOrders(params: { page?: number, limit?: number, status?: string, market?: string } = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{data: any[], total: number}>(`/api/v1/admin/trading/orders?${query}`);
  }

  async adminGetTrades(params: { page?: number, limit?: number, market?: string } = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{data: any[], total: number}>(`/api/v1/admin/trading/trades?${query}`);
  }

  async adminCancelOrder(orderId: string) {
    return this.request<any>(`/api/v1/admin/trading/orders/${orderId}/cancel`, {
      method: 'POST'
    });
  }

  async adminGetPositions(params: { page?: number, limit?: number, market?: string } = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{data: any[], total: number}>(`/api/v1/admin/trading/positions?${query}`);
  }

  async adminClosePosition(positionId: string) {
    return this.request<any>(`/api/v1/admin/trading/positions/${positionId}/close`, {
      method: 'POST'
    });
  }

  async adminClearSystemCache() {
    return this.request<any>('/api/v1/admin/system/clear-cache', { method: 'POST' });
  }

  async adminClearCache(type: 'cdn' | 'api' | 'db' | 'file' | 'template' | 'static' | 'image' | 'server') {
    return this.request<any>(`/api/v1/admin/system/clear-cache/${type}`, { method: 'POST' });
  }

  // ===== ADMIN NOTIFICATIONS =====
  async getAdminNotifications() {
    return this.request<any[]>('/api/v1/admin/notifications');
  }

  async sendAnnouncement(data: { title: string, message: string, type?: string, target?: string, userId?: string }) {
    return this.request<any>('/api/v1/admin/notifications/announce', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ===== PUBLIC RATES =====
  async getPublicCurrencyRates(): Promise<{ success: boolean; data?: any; list?: any[]; baseCurrency?: string; error?: any }> {
    return this.request<any>('/api/v1/currency-rates') as any;
  }

  // ===== SYSTEM DATA & BACKUPS =====
  async adminExportUsers() {
    return this.request<any[]>('/api/v1/admin/export/users');
  }

  async adminExportTransactions() {
    return this.request<any[]>('/api/v1/admin/export/transactions');
  }

  async adminCreateBackup() {
    return this.request<any>('/api/v1/admin/backup/create', { method: 'POST' });
  }

  async adminGetBackups() {
    return this.request<any[]>('/api/v1/admin/backup/list');
  }

  async adminRestoreBackup(data: { backupData: string }) {
    return this.request<any>('/api/v1/admin/backup/restore', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new EthsltdClient();

