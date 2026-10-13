export type P2PSide = "buy" | "sell" | "BUY" | "SELL";

export type P2POrderStatus =
  | "CREATED"
  | "ESCROW_LOCKED"
  | "AWAITING_PAYMENT"
  | "PAYMENT_MARKED"
  | "PAYMENT_CONFIRMED"
  | "RELEASE_PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "DISPUTED";

export interface PaymentMethodConfig {
  id: string;
  type: string; // e.g., 'Bank Transfer', 'UPI', 'PayPal', 'Zelle'
  name?: string;
  details: Record<string, any>;
}

export type P2PAdvertisement = {
  id: string;
  userId?: string;
  merchantId?: string;
  side: "BUY" | "SELL" | "buy" | "sell";
  asset: string;
  fiat?: string;
  fiatCurrency?: string;
  price: number;
  priceType: "FIXED" | "FLOATING" | "fixed" | "floating";
  floatingMarginPercent?: number;
  totalAmount?: number;
  availableAmount: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: PaymentMethodConfig[] | string[] | any;
  paymentTimeLimit?: number;
  terms?: string;
  autoReply?: string;
  status: "ONLINE" | "OFFLINE" | "PAUSED" | "CLOSED" | "online" | "offline" | "paused";
  createdAt: string | Date;
  user?: {
    id: string;
    uid: number;
    name: string | null;
    email: string;
    merchantTier?: string | null;
    p2pTotalOrders?: number;
    p2pCompletedOrders?: number;
    p2pCompletionRate?: number;
    p2pPositiveFeedback?: number;
    p2pNegativeFeedback?: number;
    isKycVerified?: boolean;
  };
};

export type P2PMerchant = {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  verified: boolean;
  online: boolean;
  completionRate: number;
  totalOrders: number;
  averageReleaseTime: number; // in minutes
  positiveFeedback: number;
  negativeFeedback: number;
  joinedAt: string;
  supportedPaymentMethods: string[];
  badge?: "verified" | "top_merchant" | "trusted";
};

export type P2POrder = {
  id: string;
  orderNumber?: string;
  displayId?: string;
  adId?: string;
  advertisementId?: string;
  buyerId: string;
  sellerId: string;
  side?: "BUY" | "SELL" | "buy" | "sell";
  asset: string;
  fiat?: string;
  fiatCurrency: string;
  cryptoAmount: number;
  fiatAmount: number;
  price: number;
  role?: "BUYER" | "SELLER";
  permissions?: {
    canMarkPaid: boolean;
    canConfirmPayment?: boolean;
    canReleaseCrypto: boolean;
    canCancel: boolean;
    canDispute: boolean;
  };
  paymentMethod: string;
  paymentDetails?: string | null;
  proofImageUrl?: string | null;
  status: P2POrderStatus;
  cancelReason?: string | null;
  createdAt: string | Date;
  expiresAt: string | Date;
  paymentMarkedAt?: string | Date | null;
  completedAt?: string | Date | null;
  cancelledAt?: string | Date | null;
  disputeId?: string;
  dispute?: any;
  buyer?: {
    id: string;
    uid: number;
    name: string | null;
    email: string;
    merchantTier?: string | null;
    p2pCompletedOrders?: number;
    p2pCompletionRate?: number;
  };
  seller?: {
    id: string;
    uid: number;
    name: string | null;
    email: string;
    merchantTier?: string | null;
    p2pCompletedOrders?: number;
    p2pCompletionRate?: number;
  };
  ad?: P2PAdvertisement;
  messages?: any[];
};

export type P2PMessage = {
  id: string;
  orderId: string;
  senderId?: string;
  senderRole?: "BUYER" | "SELLER" | "ADMIN" | "SYSTEM";
  sender?: "user" | "merchant" | "system" | any;
  message: string;
  attachmentUrl?: string | null;
  createdAt: string | Date;
  read?: boolean;
};

export type P2PAdvertisementQuery = {
  side: "buy" | "sell" | "BUY" | "SELL";
  asset?: string;
  fiat?: string;
  paymentMethod?: string;
  amount?: number;
  minPrice?: number;
  maxPrice?: number;
  minLimit?: number;
  maxLimit?: number;
  onlineOnly?: boolean;
  verifiedOnly?: boolean;
  sortBy?: "Best Price" | "Lowest Price" | "Highest Price" | "Fastest Completion" | "Highest Completion Rate" | "Most Trades";
};
