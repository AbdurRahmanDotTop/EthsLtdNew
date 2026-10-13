export const FIAT_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
];

export const ASSETS = [
  { code: "USDT", symbol: "USDT", name: "Tether", icon: "₮" },
  { code: "BTC", symbol: "BTC", name: "Bitcoin", icon: "₿" },
  { code: "ETH", symbol: "ETH", name: "Ethereum", icon: "Ξ" },
  { code: "SOL", symbol: "SOL", name: "Solana", icon: "◎" },
];

export const PAYMENT_METHODS = [
  { id: "bank_transfer", name: "Bank Transfer (IMPS / NEFT)", currency: "all", type: "bank_transfer", details: {} },
  { id: "upi", name: "UPI (Unified Payments Interface)", currency: "INR", type: "upi", details: {} },
  { id: "imps", name: "IMPS", currency: "INR", type: "imps", details: {} },
  { id: "paypal", name: "PayPal", currency: "all", type: "paypal", details: {} },
  { id: "zelle", name: "Zelle", currency: "USD", type: "zelle", details: {} },
  { id: "wise", name: "Wise (TransferWise)", currency: "all", type: "wise", details: {} },
  { id: "cash_app", name: "Cash App", currency: "USD", type: "cash_app", details: {} },
  { id: "revolut", name: "Revolut", currency: "EUR", type: "revolut", details: {} },
];
