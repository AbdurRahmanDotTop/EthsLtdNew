"use server";

import prisma, { DBClient } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendP2pOrderNotification } from "@/lib/email";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Non-request context
  }
}

// ==========================================
// 1. P2P ADS
// ==========================================

export async function getP2pAds(params?: {
  side?: string;
  asset?: string;
  fiat?: string;
  paymentMethod?: string;
  amount?: number;
}) {
  try {
    const where: any = {
      status: "ACTIVE",
    };

    if (params?.side && params.side !== "all") {
      where.type = params.side.toUpperCase();
    }
    if (params?.asset && params.asset !== "all") {
      where.asset = params.asset.toUpperCase();
    }
    if (params?.fiat && params.fiat !== "all") {
      where.fiat = params.fiat.toUpperCase();
    }

    const ads = await prisma.p2pAd.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            merchantTier: true,
            p2pTotalOrders: true,
            p2pCompletedOrders: true,
            p2pCompletionRate: true,
            p2pPositiveFeedback: true,
            p2pNegativeFeedback: true,
            isKycVerified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let result = ads.map((ad: any) => ({
      ...ad,
      side: ad.type,
      fiatCurrency: ad.fiat,
      price: parseFloat(ad.price || "0"),
      totalAmount: parseFloat(ad.totalAmount || "0"),
      availableAmount: parseFloat(ad.availableAmount || "0"),
      minLimit: parseFloat(ad.minLimit || "0"),
      maxLimit: parseFloat(ad.maxLimit || "0"),
      paymentTimeLimit: ad.paymentWindow,
      paymentMethods: typeof ad.paymentMethods === "string" ? JSON.parse(ad.paymentMethods || "[]") : ad.paymentMethods,
    }));

    if (params?.amount && params.amount > 0) {
      result = result.filter(
        (ad: any) => params.amount! >= ad.minLimit && params.amount! <= ad.maxLimit
      );
    }

    // Sort: if buyer, lowest price first; if seller, highest price first
    if (params?.side?.toUpperCase() === "BUY") {
      result.sort((a: any, b: any) => b.price - a.price);
    } else {
      result.sort((a: any, b: any) => a.price - b.price);
    }

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch ads" };
  }
}

export async function getMyP2pAds() {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const ads = await prisma.p2pAd.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const sortedAds = [...ads].sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return {
      success: true,
      data: sortedAds.map((ad: any) => ({
        ...ad,
        side: ad.type,
        fiatCurrency: ad.fiat,
        price: parseFloat(ad.price || "0"),
        totalAmount: parseFloat(ad.totalAmount || "0"),
        availableAmount: parseFloat(ad.availableAmount || "0"),
        minLimit: parseFloat(ad.minLimit || "0"),
        maxLimit: parseFloat(ad.maxLimit || "0"),
        paymentTimeLimit: ad.paymentWindow,
        paymentMethods: typeof ad.paymentMethods === "string" ? JSON.parse(ad.paymentMethods || "[]") : ad.paymentMethods,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch your ads" };
  }
}

export async function createP2pAd(data: {
  side: "BUY" | "SELL";
  asset: string;
  fiatCurrency: string;
  priceType: "FIXED" | "FLOATING";
  price: number;
  floatingMarginPercent?: number;
  totalAmount: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: any[];
  paymentTimeLimit?: number;
  terms?: string;
  autoReply?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    if (!data.asset || !data.fiatCurrency || !data.price || data.price <= 0 || !data.totalAmount || data.totalAmount <= 0) {
      return { success: false, error: "Invalid ad parameters" };
    }

    if (data.minLimit <= 0 || data.maxLimit < data.minLimit) {
      return { success: false, error: "Invalid order limits" };
    }

    // If SELL ad, verify available wallet balance in Funding (P2P) or Currency wallet
    if (data.side === "SELL") {
      const p2pWallet = await prisma.wallet.findFirst({
        where: { userId: user.id, asset: data.asset.toUpperCase(), type: "P2P" },
      });
      const currencyWallet = await prisma.wallet.findFirst({
        where: { userId: user.id, asset: data.asset.toUpperCase(), type: "Currency" },
      });
      const totalAvail = (p2pWallet?.balance ?? 0) + (currencyWallet?.balance ?? 0);
      if (totalAvail < data.totalAmount) {
        return {
          success: false,
          error: `Insufficient ${data.asset} balance in Funding (P2P) or Currency wallet to post sell ad.`,
        };
      }
    }

    const newAd = await prisma.p2pAd.create({
      data: {
        userId: user.id,
        type: data.side,
        asset: data.asset.toUpperCase(),
        fiat: data.fiatCurrency.toUpperCase(),
        isFloating: data.priceType === "FLOATING",
        price: data.price.toString(),
        priceMargin: (data.floatingMarginPercent || 0).toString(),
        totalAmount: data.totalAmount.toString(),
        availableAmount: data.totalAmount.toString(),
        minLimit: data.minLimit.toString(),
        maxLimit: data.maxLimit.toString(),
        paymentWindow: data.paymentTimeLimit || 15,
        paymentMethods: JSON.stringify(data.paymentMethods || []),
        terms: data.terms || "",
        autoReply: data.autoReply || "",
        status: "ACTIVE",
      },
    });

    safeRevalidate("/p2p");
    safeRevalidate("/p2p/my-ads");
    return { success: true, data: newAd };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create ad" };
  }
}

export async function getP2pSupportedPaymentMethods(params?: {
  activeOnly?: boolean;
  currency?: string;
}) {
  try {
    const where: any = {};
    if (params?.activeOnly !== false) {
      where.isActive = true;
    }

    let methods = await (prisma.p2pSystemPaymentMethod as any).findMany({
      where,
      include: {
        channelType: {
          include: {
            fields: {
              where: { isActive: true },
              orderBy: { displayOrder: "asc" },
            },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    if (methods.length === 0) {
      const fallback = [
        { id: "bank_transfer", identifier: "bank_transfer", name: "Bank Transfer (IMPS / NEFT)", type: "BANK", currency: "ALL", isActive: true, displayOrder: 1, fields: [] },
        { id: "upi", identifier: "upi", name: "UPI (Unified Payments Interface)", type: "UPI", currency: "INR", isActive: true, displayOrder: 2, fields: [] },
        { id: "imps", identifier: "imps", name: "IMPS", type: "BANK", currency: "INR", isActive: true, displayOrder: 3, fields: [] },
        { id: "paypal", identifier: "paypal", name: "PayPal", type: "WALLET", currency: "ALL", isActive: true, displayOrder: 4, fields: [] },
        { id: "zelle", identifier: "zelle", name: "Zelle", type: "WALLET", currency: "USD", isActive: true, displayOrder: 5, fields: [] },
        { id: "wise", identifier: "wise", name: "Wise (TransferWise)", type: "WALLET", currency: "ALL", isActive: true, displayOrder: 6, fields: [] },
        { id: "cash_app", identifier: "cash_app", name: "Cash App", type: "WALLET", currency: "USD", isActive: true, displayOrder: 7, fields: [] },
        { id: "revolut", identifier: "revolut", name: "Revolut", type: "WALLET", currency: "EUR", isActive: true, displayOrder: 8, fields: [] },
      ];
      return { success: true, data: fallback };
    }

    if (params?.currency && params.currency !== "all" && params.currency !== "ALL") {
      const cur = params.currency.toUpperCase();
      methods = methods.filter((m: any) => m.currency === "ALL" || m.currency === cur);
    }

    return {
      success: true,
      data: methods.map((m: any) => {
        let parsedFields: any[] = [];
        if (m.fields) {
          try {
            parsedFields = typeof m.fields === "string" ? JSON.parse(m.fields) : m.fields;
          } catch {
            parsedFields = [];
          }
        }
        if ((!Array.isArray(parsedFields) || parsedFields.length === 0) && m.channelType?.fields) {
          parsedFields = m.channelType.fields.map((f: any) => ({
            ...f,
            isRequired: f.required ?? f.isRequired ?? true,
            required: f.required ?? f.isRequired ?? true,
            options: f.options ? (typeof f.options === "string" ? JSON.parse(f.options) : f.options) : [],
          }));
        }

        return {
          ...m,
          channelType: m.channelType,
          fields: parsedFields,
        };
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch supported payment methods" };
  }
}

export async function getPlatformCurrencies() {
  try {
    const [cryptoAssets, fiatCurrencies] = await Promise.all([
      prisma.cryptoAsset.findMany({
        where: { isActive: true, canP2p: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.fiatCurrency.findMany({
        where: { isActive: true, canP2p: true },
        orderBy: { displayOrder: "asc" },
      }),
    ]);

    const assets = cryptoAssets.map((a: any) => ({
      code: a.symbol,
      symbol: a.symbol,
      name: a.name,
      icon: a.iconUrl || "₮",
      decimals: a.decimals,
      networks: typeof a.networks === "string" ? JSON.parse(a.networks || "[]") : a.networks,
    }));

    const fiats = fiatCurrencies.map((f: any) => ({
      code: f.code,
      name: f.name,
      symbol: f.symbol,
      country: f.country,
      decimals: f.decimals,
    }));

    return {
      success: true,
      assets: assets.length > 0 ? assets : [
        { code: "USDT", symbol: "USDT", name: "Tether USD", icon: "₮", decimals: 6, networks: ["TRC20", "ERC20", "BEP20"] },
        { code: "BTC", symbol: "BTC", name: "Bitcoin", icon: "₿", decimals: 8, networks: ["BTC"] },
        { code: "ETH", symbol: "ETH", name: "Ethereum", icon: "Ξ", decimals: 18, networks: ["ERC20"] },
        { code: "SOL", symbol: "SOL", name: "Solana", icon: "◎", decimals: 9, networks: ["SOL"] },
      ],
      fiats: fiats.length > 0 ? fiats : [
        { code: "INR", symbol: "₹", name: "Indian Rupee", country: "India", decimals: 2 },
        { code: "USD", symbol: "$", name: "US Dollar", country: "United States", decimals: 2 },
        { code: "EUR", symbol: "€", name: "Euro", country: "European Union", decimals: 2 },
        { code: "AED", symbol: "د.إ", name: "UAE Dirham", country: "United Arab Emirates", decimals: 2 },
      ],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to load platform currencies",
      assets: [
        { code: "USDT", symbol: "USDT", name: "Tether USD", icon: "₮", decimals: 6, networks: ["TRC20", "ERC20", "BEP20"] },
        { code: "BTC", symbol: "BTC", name: "Bitcoin", icon: "₿", decimals: 8, networks: ["BTC"] },
      ],
      fiats: [
        { code: "INR", symbol: "₹", name: "Indian Rupee", country: "India", decimals: 2 },
        { code: "USD", symbol: "$", name: "US Dollar", country: "United States", decimals: 2 },
      ],
    };
  }
}

export async function getP2pChannelTypes() {
  try {
    const channels = await prisma.p2pChannelType.findMany({
      where: { isActive: true },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return {
      success: true,
      data: channels.map((c: any) => ({
        ...c,
        fields: c.fields.map((f: any) => ({
          ...f,
          options: f.options ? (typeof f.options === "string" ? JSON.parse(f.options) : f.options) : [],
        })),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to load channel types" };
  }
}

export async function getP2pAdById(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const ad = await prisma.p2pAd.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            merchantTier: true,
            isKycVerified: true,
          },
        },
        orders: {
          select: {
            id: true,
            status: true,
            cryptoAmount: true,
          },
        },
      },
    });

    if (!ad) return { success: false, error: "Advertisement not found" };

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (ad.userId !== user.id && !isAdmin) {
      return { success: false, error: "Forbidden: You do not own this advertisement" };
    }

    const activeOrders = ad.orders.filter((o: any) =>
      [
        "CREATED",
        "AWAITING_PAYMENT",
        "PAYMENT_PENDING",
        "BUYER_MARKED_PAID",
        "PAYMENT_MARKED",
        "SELLER_PAYMENT_REVIEW",
        "DISPUTED",
      ].includes(o.status)
    );

    return {
      success: true,
      data: {
        ...ad,
        side: ad.type as "BUY" | "SELL",
        fiatCurrency: ad.fiat,
        price: parseFloat(ad.price || "0"),
        priceMargin: parseFloat(ad.priceMargin || "0"),
        totalAmount: parseFloat(ad.totalAmount || "0"),
        availableAmount: parseFloat(ad.availableAmount || "0"),
        minLimit: parseFloat(ad.minLimit || "0"),
        maxLimit: parseFloat(ad.maxLimit || "0"),
        paymentTimeLimit: ad.paymentWindow,
        paymentMethods:
          typeof ad.paymentMethods === "string"
            ? JSON.parse(ad.paymentMethods || "[]")
            : ad.paymentMethods,
        activeOrdersCount: activeOrders.length,
        totalOrdersCount: ad.orders.length,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch advertisement details" };
  }
}

export async function updateP2pAd(
  id: string,
  data: Partial<{
    price: number;
    priceType: "FIXED" | "FLOATING";
    floatingMarginPercent: number;
    totalAmount: number;
    availableAmount: number;
    minLimit: number;
    maxLimit: number;
    paymentMethods: any[];
    paymentTimeLimit: number;
    terms: string;
    autoReply: string;
    status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED";
  }>
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const existing = await prisma.p2pAd.findUnique({
      where: { id },
      include: {
        orders: {
          where: {
            status: {
              in: [
                "CREATED",
                "AWAITING_PAYMENT",
                "PAYMENT_PENDING",
                "BUYER_MARKED_PAID",
                "PAYMENT_MARKED",
                "SELLER_PAYMENT_REVIEW",
                "DISPUTED",
              ],
            },
          },
        },
      },
    });

    if (!existing || existing.userId !== user.id) {
      return { success: false, error: "Advertisement not found or forbidden" };
    }

    const hasActiveOrders = existing.orders.length > 0;

    if (data.price !== undefined && data.price <= 0) {
      return { success: false, error: "Price must be greater than zero" };
    }

    const curMin = data.minLimit !== undefined ? data.minLimit : parseFloat(existing.minLimit || "0");
    const curMax = data.maxLimit !== undefined ? data.maxLimit : parseFloat(existing.maxLimit || "0");
    if (curMin <= 0 || curMax < curMin) {
      return {
        success: false,
        error: "Invalid trade limits: Maximum limit must be greater than or equal to minimum limit",
      };
    }

    // If SELL ad and increasing volume, check wallet balance
    if (existing.type === "SELL" && data.totalAmount !== undefined) {
      const oldTotal = parseFloat(existing.totalAmount || "0");
      if (data.totalAmount > oldTotal) {
        const diff = data.totalAmount - oldTotal;
        const wallet = await prisma.wallet.findFirst({
          where: { userId: user.id, asset: existing.asset, type: "Currency" },
        });
        if (!wallet || (wallet.balance ?? 0) < diff) {
          return {
            success: false,
            error: `Insufficient ${existing.asset} balance in Currency wallet to increase volume by ${diff} ${existing.asset}`,
          };
        }
      }
    }

    const updateData: any = {};
    if (data.price !== undefined) updateData.price = data.price.toString();
    if (data.priceType !== undefined) updateData.isFloating = data.priceType === "FLOATING";
    if (data.floatingMarginPercent !== undefined) updateData.priceMargin = data.floatingMarginPercent.toString();
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount.toString();
    if (data.availableAmount !== undefined) {
      if (data.availableAmount < 0) return { success: false, error: "Available volume cannot be negative" };
      updateData.availableAmount = data.availableAmount.toString();
      if (data.availableAmount <= 0.0001 && (!data.status || data.status === "ACTIVE")) {
        updateData.status = "COMPLETED";
      }
    }
    if (data.minLimit !== undefined) updateData.minLimit = data.minLimit.toString();
    if (data.maxLimit !== undefined) updateData.maxLimit = data.maxLimit.toString();
    if (data.paymentMethods !== undefined) {
      if (!Array.isArray(data.paymentMethods) || data.paymentMethods.length === 0) {
        return { success: false, error: "At least one payment method is required" };
      }
      updateData.paymentMethods = JSON.stringify(data.paymentMethods);
    }
    if (data.paymentTimeLimit !== undefined) updateData.paymentWindow = data.paymentTimeLimit;
    if (data.terms !== undefined) updateData.terms = data.terms;
    if (data.autoReply !== undefined) updateData.autoReply = data.autoReply;
    if (data.status !== undefined) {
      if (hasActiveOrders && (data.status === "CANCELED" || data.status === "COMPLETED")) {
        return {
          success: false,
          error: "Cannot close advertisement while there are ongoing active orders",
        };
      }
      updateData.status = data.status;
    }

    const updated = await prisma.p2pAd.update({
      where: { id },
      data: updateData,
    });

    safeRevalidate("/p2p");
    safeRevalidate("/p2p/my-ads");
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update ad" };
  }
}

export async function deleteP2pAd(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const ad = await prisma.p2pAd.findUnique({
      where: { id },
      include: {
        orders: {
          select: { id: true, status: true },
        },
      },
    });

    if (!ad) return { success: false, error: "Advertisement not found" };

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (ad.userId !== user.id && !isAdmin) {
      return { success: false, error: "Forbidden: You do not own this advertisement" };
    }

    const activeOrders = ad.orders.filter((o: any) =>
      [
        "CREATED",
        "AWAITING_PAYMENT",
        "PAYMENT_PENDING",
        "BUYER_MARKED_PAID",
        "PAYMENT_MARKED",
        "SELLER_PAYMENT_REVIEW",
        "DISPUTED",
      ].includes(o.status)
    );

    if (activeOrders.length > 0) {
      return {
        success: false,
        error: `Cannot delete advertisement: There are ${activeOrders.length} active ongoing order(s) on this offer. Please wait for completion or cancellation first.`,
      };
    }

    // If historical orders exist, soft-delete by setting status = "CANCELED" to preserve order history
    if (ad.orders.length > 0) {
      await prisma.p2pAd.update({
        where: { id },
        data: { status: "CANCELED" },
      });
    } else {
      await prisma.p2pAd.delete({
        where: { id },
      });
    }

    safeRevalidate("/p2p");
    safeRevalidate("/p2p/my-ads");
    return { success: true, message: "Advertisement deleted successfully" };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete advertisement" };
  }
}

export async function updateP2pAdStatus(id: string, status: "ONLINE" | "OFFLINE" | "PAUSED" | "CLOSED") {
  const prismaStatus =
    status === "ONLINE" ? "ACTIVE" : status === "PAUSED" ? "PAUSED" : "CANCELED";
  return updateP2pAd(id, { status: prismaStatus as any });
}

// ==========================================
// 2. P2P ORDERS & ESCROW LIFECYCLE
// ==========================================

export async function getP2pOrders(params?: { status?: string }) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const where: any = {
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
    };

    if (params?.status && params.status !== "ALL") {
      where.status = params.status.toUpperCase();
    }

    const orders = await prisma.p2pOrder.findMany({
      where,
      include: {
        buyer: { select: { id: true, uid: true, name: true, email: true } },
        seller: { select: { id: true, uid: true, name: true, email: true } },
        ad: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const parsedOrders = orders.map((o: any) => ({
      ...o,
      orderNumber: o.displayId || o.id.slice(0, 8),
      asset: o.ad?.asset || "USDT",
      fiatCurrency: o.ad?.fiat || "USD",
      cryptoAmount: parseFloat(o.cryptoAmount || "0"),
      fiatAmount: parseFloat(o.fiatAmount || "0"),
      price: parseFloat(o.price || "0"),
    }));

    parsedOrders.sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return { success: true, data: parsedOrders };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch orders" };
  }
}

export async function getP2pOrder(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const order = await prisma.p2pOrder.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            merchantTier: true,
            p2pCompletedOrders: true,
            p2pCompletionRate: true,
          },
        },
        seller: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            merchantTier: true,
            p2pCompletedOrders: true,
            p2pCompletionRate: true,
          },
        },
        ad: true,
        disputes: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!order) return { success: false, error: "Order not found" };

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (order.buyerId !== user.id && order.sellerId !== user.id && !isAdmin) {
      return { success: false, error: "Forbidden" };
    }

    const isBuyer = order.buyerId === user.id;
    const isSeller = order.sellerId === user.id;

    const permissions = {
      canMarkPaid: isBuyer && (order.status === "AWAITING_PAYMENT" || order.status === "CREATED" || order.status === "PAYMENT_PENDING"),
      canReleaseCrypto: isSeller && (order.status === "PAYMENT_MARKED" || order.status === "BUYER_MARKED_PAID" || order.status === "SELLER_PAYMENT_REVIEW"),
      canCancel: (isBuyer && (order.status === "AWAITING_PAYMENT" || order.status === "CREATED" || order.status === "PAYMENT_PENDING")),
      canDispute: (order.status === "BUYER_MARKED_PAID" || order.status === "PAYMENT_MARKED") && order.disputes.length === 0,
    };

    // Resolve payment details snapshot for the order
    let resolvedDetails: Record<string, any> = {};
    if (order.paymentDetails) {
      try {
        resolvedDetails =
          typeof order.paymentDetails === "string"
            ? JSON.parse(order.paymentDetails)
            : order.paymentDetails;
      } catch {
        resolvedDetails = {};
      }
    }

    // 1. Fallback to ad.paymentMethods if not stored or empty
    if (!resolvedDetails || Object.keys(resolvedDetails).length === 0) {
      if (order.ad?.paymentMethods) {
        try {
          const adMethods =
            typeof order.ad.paymentMethods === "string"
              ? JSON.parse(order.ad.paymentMethods)
              : order.ad.paymentMethods;
          if (Array.isArray(adMethods)) {
            const matched = adMethods.find((m: any) => {
              const name = typeof m === "string" ? m : (m.name || m.type || "");
              return (
                name.toLowerCase() === order.paymentMethod.toLowerCase() ||
                name.toLowerCase().includes(order.paymentMethod.toLowerCase()) ||
                order.paymentMethod.toLowerCase().includes(name.toLowerCase())
              );
            });
            if (matched && typeof matched === "object" && matched.details && Object.keys(matched.details).length > 0) {
              resolvedDetails = matched.details;
            }
          }
        } catch {}
      }
    }

    // 2. Fallback to seller's saved profile payment methods in DB
    if (!resolvedDetails || Object.keys(resolvedDetails).length === 0) {
      try {
        const sellerSaved = await prisma.p2pPaymentMethod.findMany({
          where: { userId: order.sellerId },
        });
        const matchedSaved =
          sellerSaved.find((sm: any) => {
            const smType = (sm.type || "").toLowerCase();
            const smName = (sm.name || "").toLowerCase();
            const ordMethod = order.paymentMethod.toLowerCase();
            return (
              smType === ordMethod ||
              smType.includes(ordMethod) ||
              ordMethod.includes(smType) ||
              smName.includes(ordMethod) ||
              (ordMethod.includes("bank") && smType.includes("bank")) ||
              (ordMethod.includes("upi") && smType.includes("upi")) ||
              (ordMethod.includes("paypal") && smType.includes("paypal"))
            );
          }) ||
          sellerSaved.find((sm: any) => sm.isPrimary) ||
          sellerSaved[0];

        if (matchedSaved) {
          resolvedDetails =
            typeof matchedSaved.details === "string"
              ? JSON.parse(matchedSaved.details)
              : matchedSaved.details;
        }
      } catch {}
    }

    // If order had no snapshot saved yet, backfill it so future reads are instantaneous
    if (resolvedDetails && Object.keys(resolvedDetails).length > 0 && !order.paymentDetails) {
      prisma.p2pOrder
        .update({
          where: { id: order.id },
          data: { paymentDetails: JSON.stringify(resolvedDetails) },
        })
        .catch(() => {});
    }

    return {
      success: true,
      data: {
        ...order,
        orderNumber: order.displayId || order.id.slice(0, 8),
        asset: order.ad?.asset || "USDT",
        fiatCurrency: order.ad?.fiat || "USD",
        cryptoAmount: parseFloat(order.cryptoAmount || "0"),
        fiatAmount: parseFloat(order.fiatAmount || "0"),
        price: parseFloat(order.price || "0"),
        role: isBuyer ? "BUYER" : "SELLER",
        currentUserId: user.id,
        permissions,
        paymentDetails: resolvedDetails,
        dispute: order.disputes?.[0] || null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch order" };
  }
}

export async function createP2pOrder(data: {
  adId: string;
  cryptoAmount: number;
  fiatAmount: number;
  paymentMethod: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const ad = await prisma.p2pAd.findUnique({
      where: { id: data.adId },
      include: { user: true },
    });

    if (!ad || ad.status !== "ACTIVE") {
      return { success: false, error: "Advertisement is no longer available" };
    }

    if (ad.userId === user.id) {
      return { success: false, error: "You cannot trade against your own advertisement" };
    }

    const minL = parseFloat(ad.minLimit || "0");
    const maxL = parseFloat(ad.maxLimit || "0");
    const availA = parseFloat(ad.availableAmount || "0");

    if (data.fiatAmount < minL || data.fiatAmount > maxL) {
      return {
        success: false,
        error: `Order amount must be between ${minL} and ${maxL} ${ad.fiat}`,
      };
    }

    if (data.cryptoAmount > availA) {
      return {
        success: false,
        error: `Requested amount exceeds available advertisement volume (${availA} ${ad.asset})`,
      };
    }

    // If ad.type === "BUY" (Merchant is buying crypto, user is selling crypto):
    // Buyer = ad.userId, Seller = user.id
    // If ad.type === "SELL" (Merchant is selling crypto, user is buying crypto):
    // Buyer = user.id, Seller = ad.userId
    const isUserSelling = ad.type === "BUY";
    const buyerId = isUserSelling ? ad.userId : user.id;
    const sellerId = isUserSelling ? user.id : ad.userId;

    // Check seller's Funding (P2P) wallet first; fallback to Currency wallet
    let sellerWallet = await prisma.wallet.findFirst({
      where: { userId: sellerId, asset: ad.asset, type: "P2P" },
    });
    if (!sellerWallet || (sellerWallet.balance ?? 0) < data.cryptoAmount) {
      sellerWallet = await prisma.wallet.findFirst({
        where: { userId: sellerId, asset: ad.asset, type: "Currency" },
      });
    }

    if (!sellerWallet || (sellerWallet.balance ?? 0) < data.cryptoAmount) {
      return {
        success: false,
        error: isUserSelling
          ? `Insufficient ${ad.asset} balance in Funding (P2P) or Currency wallet.`
          : `Advertiser has insufficient available balance for this order.`,
      };
    }

    const orderNumber = `P2P-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const expiresAt = new Date(Date.now() + (ad.paymentWindow || 15) * 60 * 1000);

    // Resolve payment details snapshot for the order
    let resolvedPaymentDetails: Record<string, any> = {};
    if (ad.paymentMethods) {
      try {
        const adMethods =
          typeof ad.paymentMethods === "string"
            ? JSON.parse(ad.paymentMethods)
            : ad.paymentMethods;
        if (Array.isArray(adMethods)) {
          const matched = adMethods.find((m: any) => {
            const name = typeof m === "string" ? m : (m.name || m.type || "");
            return (
              name.toLowerCase() === data.paymentMethod.toLowerCase() ||
              name.toLowerCase().includes(data.paymentMethod.toLowerCase()) ||
              data.paymentMethod.toLowerCase().includes(name.toLowerCase())
            );
          });
          if (matched && typeof matched === "object" && matched.details && Object.keys(matched.details).length > 0) {
            resolvedPaymentDetails = matched.details;
          }
        }
      } catch {}
    }

    if (!resolvedPaymentDetails || Object.keys(resolvedPaymentDetails).length === 0) {
      try {
        const sellerSaved = await prisma.p2pPaymentMethod.findMany({
          where: { userId: sellerId },
        });
        const matchedSaved =
          sellerSaved.find((sm: any) => {
            const smType = (sm.type || "").toLowerCase();
            const smName = (sm.name || "").toLowerCase();
            const ordMethod = data.paymentMethod.toLowerCase();
            return (
              smType === ordMethod ||
              smType.includes(ordMethod) ||
              ordMethod.includes(smType) ||
              smName.includes(ordMethod) ||
              (ordMethod.includes("bank") && smType.includes("bank")) ||
              (ordMethod.includes("upi") && smType.includes("upi")) ||
              (ordMethod.includes("paypal") && smType.includes("paypal"))
            );
          }) ||
          sellerSaved.find((sm: any) => sm.isPrimary) ||
          sellerSaved[0];

        if (matchedSaved) {
          resolvedPaymentDetails =
            typeof matchedSaved.details === "string"
              ? JSON.parse(matchedSaved.details)
              : matchedSaved.details;
        }
      } catch {}
    }

    const newOrder = await prisma.$transaction(async (tx: DBClient) => {
      // 1. Lock Seller Escrow
      await tx.wallet.update({
        where: { id: sellerWallet.id },
        data: {
          balance: { decrement: data.cryptoAmount },
          escrowBalance: { increment: data.cryptoAmount },
        },
      });

      // 2. Decrement Ad Available Amount
      const remainingAvail = Math.max(0, availA - data.cryptoAmount);
      await tx.p2pAd.update({
        where: { id: ad.id },
        data: {
          availableAmount: remainingAvail.toString(),
          status: remainingAvail <= 0.0001 ? "COMPLETED" : "ACTIVE",
        },
      });

      // 3. Create Order
      const order = await tx.p2pOrder.create({
        data: {
          displayId: orderNumber,
          adId: ad.id,
          buyerId,
          sellerId,
          cryptoAmount: data.cryptoAmount.toString(),
          fiatAmount: data.fiatAmount.toString(),
          price: ad.price,
          status: "AWAITING_PAYMENT",
          paymentMethod: data.paymentMethod,
          paymentDetails:
            Object.keys(resolvedPaymentDetails).length > 0
              ? JSON.stringify(resolvedPaymentDetails)
              : null,
          expiresAt,
        },
      });

      // 4. Initial System Messages
      if (ad.autoReply) {
        await tx.p2pMessage.create({
          data: {
            orderId: order.id,
            senderId: ad.userId,
            content: ad.autoReply,
            type: "TEXT",
          },
        });
      }

      await tx.p2pMessage.create({
        data: {
          orderId: order.id,
          senderId: user.id,
          content: `Escrow locked for ${data.cryptoAmount} ${ad.asset}. Buyer has ${ad.paymentWindow || 15} minutes to make payment of ${data.fiatAmount} ${ad.fiat}.`,
          type: "SYSTEM",
        },
      });

      return order;
    });

    safeRevalidate("/p2p");
    safeRevalidate("/p2p/orders");

    // Notify buyer and seller (awaited for Cloudflare Workers isolate persistence)
    try {
      const fullOrder = await prisma.p2pOrder.findUnique({
        where: { id: newOrder.id },
        include: { buyer: true, seller: true, ad: true },
      });
      const notifications: Promise<any>[] = [];
      if (fullOrder?.buyer?.email) {
        notifications.push(
          sendP2pOrderNotification({
            email: fullOrder.buyer.email,
            role: "BUYER",
            orderNumber: fullOrder.displayId || fullOrder.id.slice(0, 8),
            asset: fullOrder.ad?.asset || "USDT",
            cryptoAmount: parseFloat(fullOrder.cryptoAmount || "0"),
            fiatAmount: parseFloat(fullOrder.fiatAmount || "0"),
            fiatCurrency: fullOrder.ad?.fiat || "USD",
            status: "CREATED",
          })
        );
      }
      if (fullOrder?.seller?.email) {
        notifications.push(
          sendP2pOrderNotification({
            email: fullOrder.seller.email,
            role: "SELLER",
            orderNumber: fullOrder.displayId || fullOrder.id.slice(0, 8),
            asset: fullOrder.ad?.asset || "USDT",
            cryptoAmount: parseFloat(fullOrder.cryptoAmount || "0"),
            fiatAmount: parseFloat(fullOrder.fiatAmount || "0"),
            fiatCurrency: fullOrder.ad?.fiat || "USD",
            status: "CREATED",
          })
        );
      }
      if (notifications.length > 0) {
        await Promise.allSettled(notifications);
      }
    } catch (e) {
      console.warn("P2P creation notification error:", e);
    }

    return { success: true, data: newOrder };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create order" };
  }
}

export async function markP2pOrderPaid(id: string, proofImageUrl?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const order = await prisma.p2pOrder.findUnique({ where: { id } });
    if (!order) return { success: false, error: "Order not found" };

    if (order.buyerId !== user.id) {
      return { success: false, error: "Only the buyer can mark the order as paid" };
    }

    const updated = await prisma.$transaction(async (tx: DBClient) => {
      const ord = await tx.p2pOrder.update({
        where: { id },
        data: {
          status: "PAYMENT_MARKED",
        },
      });

      await tx.p2pMessage.create({
        data: {
          orderId: id,
          senderId: user.id,
          content: `Buyer marked payment as sent. Seller, please verify receipt in your receiving account before releasing crypto.`,
          type: "SYSTEM",
        },
      });

      return ord;
    });

    safeRevalidate(`/p2p/order/${id}`);
    safeRevalidate("/p2p/orders");

    // Notify seller of payment submission (awaited for Cloudflare Workers isolate persistence)
    try {
      const fullOrder = await prisma.p2pOrder.findUnique({
        where: { id },
        include: { buyer: true, seller: true, ad: true },
      });
      if (fullOrder?.seller?.email) {
        await sendP2pOrderNotification({
          email: fullOrder.seller.email,
          role: "SELLER",
          orderNumber: fullOrder.displayId || fullOrder.id.slice(0, 8),
          asset: fullOrder.ad?.asset || "USDT",
          cryptoAmount: parseFloat(fullOrder.cryptoAmount || "0"),
          fiatAmount: parseFloat(fullOrder.fiatAmount || "0"),
          fiatCurrency: fullOrder.ad?.fiat || "USD",
          status: "PAYMENT_MARKED",
        });
      }
    } catch (e) {
      console.warn("P2P payment notification error:", e);
    }

    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to mark order as paid" };
  }
}

async function updateP2pUserMetrics(tx: DBClient, uId: string) {
  try {
    const total = await tx.p2pOrder.count({
      where: {
        OR: [{ buyerId: uId }, { sellerId: uId }],
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
    });
    const completed = await tx.p2pOrder.count({
      where: {
        OR: [{ buyerId: uId }, { sellerId: uId }],
        status: "COMPLETED",
      },
    });
    const rate = total > 0 ? (completed / total) * 100 : 100;
    await tx.user.update({
      where: { id: uId },
      data: {
        p2pTotalOrders: total,
        p2pCompletedOrders: completed,
        p2pCompletionRate: (Math.round(rate * 10) / 10).toString(),
      },
    });
  } catch (err) {
    console.warn("Failed to update P2P user metrics for", uId, err);
  }
}

export async function releaseP2pOrder(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const order = await prisma.p2pOrder.findUnique({
      where: { id },
      include: { buyer: true, seller: true, ad: true },
    });
    if (!order) return { success: false, error: "Order not found" };

    if (order.sellerId !== user.id) {
      return { success: false, error: "Only the seller can release the escrow" };
    }

    const cryptoAmt = parseFloat(order.cryptoAmount || "0");
    const asset = order.ad?.asset || "USDT";

    const updated = await prisma.$transaction(async (tx: DBClient) => {
      // 1. Seller Escrow Deduction (check P2P wallet first, then Currency wallet)
      let sellerWallet = await tx.wallet.findFirst({
        where: { userId: order.sellerId, asset, type: "P2P", escrowBalance: { gte: cryptoAmt } },
      });
      if (!sellerWallet) {
        sellerWallet = await tx.wallet.findFirst({
          where: { userId: order.sellerId, asset, type: "Currency" },
        });
      }
      if (sellerWallet) {
        const decAmt = Math.min(sellerWallet.escrowBalance, cryptoAmt);
        await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: {
            escrowBalance: { decrement: decAmt },
          },
        });
      }

      // 2. Buyer Balance Credit (credit buyer's Funding / P2P account)
      let buyerWallet = await tx.wallet.findFirst({
        where: { userId: order.buyerId, asset, type: "P2P" },
      });
      if (!buyerWallet) {
        buyerWallet = await tx.wallet.create({
          data: {
            userId: order.buyerId,
            asset,
            type: "P2P",
            balance: cryptoAmt,
          },
        });
      } else {
        await tx.wallet.update({
          where: { id: buyerWallet.id },
          data: {
            balance: { increment: cryptoAmt },
          },
        });
      }

      // 3. Double-entry transaction records
      await tx.transaction.create({
        data: {
          userId: order.buyerId,
          type: "P2P",
          asset,
          amount: cryptoAmt,
          status: "Passed",
          description: `Received ${cryptoAmt} ${asset} via P2P Order ${order.displayId || order.id}`,
        },
      });

      await tx.transaction.create({
        data: {
          userId: order.sellerId,
          type: "P2P",
          asset,
          amount: -cryptoAmt,
          status: "Passed",
          description: `Sold ${cryptoAmt} ${asset} via P2P Order ${order.displayId || order.id}`,
        },
      });

      // 4. Update order status
      const completedOrder = await tx.p2pOrder.update({
        where: { id },
        data: { status: "COMPLETED" },
      });

      // 5. Update reputation metrics
      await updateP2pUserMetrics(tx, order.buyerId);
      await updateP2pUserMetrics(tx, order.sellerId);

      // 6. System Message
      await tx.p2pMessage.create({
        data: {
          orderId: id,
          senderId: user.id,
          content: `Order completed! ${cryptoAmt} ${asset} has been safely released to buyer.`,
          type: "SYSTEM",
        },
      });

      return completedOrder;
    });

    safeRevalidate(`/p2p/order/${id}`);
    safeRevalidate("/p2p/orders");
    safeRevalidate("/assets");

    // Notify buyer that escrow has been released (awaited for Cloudflare Workers isolate persistence)
    try {
      if (order.buyer?.email) {
        await sendP2pOrderNotification({
          email: order.buyer.email,
          role: "BUYER",
          orderNumber: order.displayId || order.id.slice(0, 8),
          asset,
          cryptoAmount: cryptoAmt,
          fiatAmount: parseFloat(order.fiatAmount || "0"),
          fiatCurrency: order.ad?.fiat || "USD",
          status: "COMPLETED",
        });
      }
    } catch (e) {
      console.warn("P2P release notification error:", e);
    }

    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to release order" };
  }
}

export async function cancelP2pOrder(id: string, reason?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const order = await prisma.p2pOrder.findUnique({
      where: { id },
      include: { ad: true },
    });
    if (!order) return { success: false, error: "Order not found" };

    const isBuyer = order.buyerId === user.id;
    const isSeller = order.sellerId === user.id;

    if (!isBuyer && !isSeller) {
      return { success: false, error: "Forbidden" };
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return { success: false, error: `Order is already ${order.status}` };
    }

    const cryptoAmt = parseFloat(order.cryptoAmount || "0");
    const asset = order.ad?.asset || "USDT";

    const cancelled = await prisma.$transaction(async (tx: DBClient) => {
      // Return escrow to seller's Funding (P2P) or Currency wallet
      let sellerWallet = await tx.wallet.findFirst({
        where: { userId: order.sellerId, asset, type: "P2P", escrowBalance: { gte: cryptoAmt } },
      });
      if (!sellerWallet) {
        sellerWallet = await tx.wallet.findFirst({
          where: { userId: order.sellerId, asset, type: "Currency" },
        });
      }
      if (sellerWallet) {
        const decAmt = Math.min(sellerWallet.escrowBalance, cryptoAmt);
        await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: {
            escrowBalance: { decrement: decAmt },
            balance: { increment: cryptoAmt },
          },
        });
      }

      // Restore ad volume
      if (order.adId && order.ad) {
        const curAvail = parseFloat(order.ad.availableAmount || "0");
        await tx.p2pAd.update({
          where: { id: order.adId },
          data: {
            availableAmount: (curAvail + cryptoAmt).toString(),
            status: "ACTIVE",
          },
        });
      }

      const ord = await tx.p2pOrder.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await updateP2pUserMetrics(tx, order.buyerId);
      await updateP2pUserMetrics(tx, order.sellerId);

      await tx.p2pMessage.create({
        data: {
          orderId: id,
          senderId: user.id,
          content: `Order was cancelled. Escrow of ${cryptoAmt} ${asset} returned to seller.`,
          type: "SYSTEM",
        },
      });

      return ord;
    });

    safeRevalidate(`/p2p/order/${id}`);
    safeRevalidate("/p2p/orders");
    safeRevalidate("/p2p");
    return { success: true, data: cancelled };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to cancel order" };
  }
}

export async function disputeP2pOrder(
  id: string,
  data: { reason: string; description: string; evidenceUrls?: string[] }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const order = await prisma.p2pOrder.findUnique({ where: { id } });
    if (!order) return { success: false, error: "Order not found" };

    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return { success: false, error: "Forbidden" };
    }

    const disputeNumber = `DSP-${Date.now().toString().slice(-6)}`;

    const dispute = await prisma.$transaction(async (tx: DBClient) => {
      const dsp = await tx.p2pDispute.create({
        data: {
          displayId: disputeNumber,
          orderId: id,
          openerId: user.id,
          reason: `${data.reason}: ${data.description}`,
          evidenceUrls: JSON.stringify(data.evidenceUrls || []),
          status: "OPEN",
        },
      });

      await tx.p2pOrder.update({
        where: { id },
        data: { status: "DISPUTED" },
      });

      await tx.p2pMessage.create({
        data: {
          orderId: id,
          senderId: user.id,
          content: `Dispute ${disputeNumber} opened by ${user.name || user.email}. An admin moderator will review evidence and resolve escrow.`,
          type: "SYSTEM",
        },
      });

      return dsp;
    });

    safeRevalidate(`/p2p/order/${id}`);
    safeRevalidate("/p2p/orders");
    safeRevalidate("/admin/p2p/disputes");
    return { success: true, data: dispute };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to raise dispute" };
  }
}

// ==========================================
// 3. P2P MESSAGING / CHAT
// ==========================================

export async function getP2pMessages(orderId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const order = await prisma.p2pOrder.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, error: "Order not found" };

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (order.buyerId !== user.id && order.sellerId !== user.id && !isAdmin) {
      return { success: false, error: "Forbidden" };
    }

    const messages = await prisma.p2pMessage.findMany({
      where: { orderId },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      success: true,
      data: messages.map((m: any) => ({
        ...m,
        message: m.content,
        senderRole: m.type === "SYSTEM" ? "SYSTEM" : m.senderId === order.buyerId ? "BUYER" : "SELLER",
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to get messages" };
  }
}

export async function sendP2pMessage(
  orderId: string,
  content: string,
  attachmentUrl?: string
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const order = await prisma.p2pOrder.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, error: "Order not found" };

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isBuyer = order.buyerId === user.id;
    const isSeller = order.sellerId === user.id;

    if (!isBuyer && !isSeller && !isAdmin) {
      return { success: false, error: "Forbidden" };
    }

    const message = await prisma.p2pMessage.create({
      data: {
        orderId,
        senderId: user.id,
        content: content.trim(),
        type: "TEXT",
        attachmentUrl: attachmentUrl || null,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    safeRevalidate(`/p2p/order/${orderId}`);
    return { success: true, data: message };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to send message" };
  }
}

// ==========================================
// 4. PAYMENT METHODS & USER PROFILE
// ==========================================

export async function getP2pPaymentMethods() {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const methods = await prisma.p2pPaymentMethod.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: methods.map((m: any) => ({
        ...m,
        details: typeof m.details === "string" ? JSON.parse(m.details || "{}") : m.details,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch payment methods" };
  }
}

export async function addP2pPaymentMethod(data: {
  type: string;
  name: string;
  details: Record<string, any>;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    if (!data.type || !data.name || !data.details) {
      return { success: false, error: "Payment method type, name, and details are required" };
    }

    // Verify method is recognized in active system methods
    const systemMethod = await prisma.p2pSystemPaymentMethod.findFirst({
      where: {
        OR: [
          { identifier: data.type.toLowerCase().replace(/[^a-z0-9]/g, "_") },
          { name: data.type },
        ],
        isActive: true,
      },
    });

    const method = await prisma.p2pPaymentMethod.create({
      data: {
        userId: user.id,
        type: systemMethod?.name || data.type,
        name: data.name,
        details: JSON.stringify(data.details || {}),
        isActive: true,
        isPrimary: false,
      },
    });

    safeRevalidate("/p2p/payment-methods");
    return {
      success: true,
      data: {
        ...method,
        details: data.details,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to add payment method" };
  }
}

export async function updateP2pPaymentMethod(
  id: string,
  data: {
    type?: string;
    name?: string;
    details?: Record<string, any>;
    isActive?: boolean;
    isPrimary?: boolean;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const existing = await prisma.p2pPaymentMethod.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return { success: false, error: "Payment method not found or forbidden" };
    }

    const updateData: any = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.details !== undefined) updateData.details = JSON.stringify(data.details);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;

    const updated = await prisma.p2pPaymentMethod.update({
      where: { id },
      data: updateData,
    });

    safeRevalidate("/p2p/payment-methods");
    return {
      success: true,
      data: {
        ...updated,
        details: typeof updated.details === "string" ? JSON.parse(updated.details || "{}") : updated.details,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update payment method" };
  }
}

export async function deleteP2pPaymentMethod(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const existing = await prisma.p2pPaymentMethod.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return { success: false, error: "Payment method not found or forbidden" };
    }

    // Safety check: check if user has active/paused ads using this payment method
    const activeAds = await prisma.p2pAd.findMany({
      where: {
        userId: user.id,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
    });

    const matchingAds = activeAds.filter((ad: any) => {
      try {
        const methods = typeof ad.paymentMethods === "string" ? JSON.parse(ad.paymentMethods || "[]") : ad.paymentMethods;
        return Array.isArray(methods) && methods.some((m: any) => {
          const mType = typeof m === "string" ? m : (m?.type || m?.name || "");
          return (
            mType.toLowerCase() === existing.type.toLowerCase() ||
            (existing.name && mType.toLowerCase() === existing.name.toLowerCase())
          );
        });
      } catch {
        return false;
      }
    });

    if (matchingAds.length > 0) {
      return {
        success: false,
        error: `Cannot delete payment method: It is currently linked to ${matchingAds.length} active advertisement(s). Please edit or remove those ads first.`,
      };
    }

    await prisma.p2pPaymentMethod.delete({ where: { id } });
    safeRevalidate("/p2p/payment-methods");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete payment method" };
  }
}

export async function getP2pProfile() {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const [paymentMethods, adsCount, ordersCount] = await Promise.all([
      prisma.p2pPaymentMethod.count({ where: { userId: user.id } }),
      prisma.p2pAd.count({ where: { userId: user.id } }),
      prisma.p2pOrder.count({ where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] } }),
    ]);

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          uid: user.uid,
          name: user.name,
          email: user.email,
          merchantTier: user.merchantTier,
          p2pTotalOrders: user.p2pTotalOrders,
          p2pCompletedOrders: user.p2pCompletedOrders,
          p2pCompletionRate: user.p2pCompletionRate,
          p2pPositiveFeedback: user.p2pPositiveFeedback,
          p2pNegativeFeedback: user.p2pNegativeFeedback,
          isKycVerified: user.isKycVerified,
        },
        stats: {
          paymentMethodsCount: paymentMethods,
          activeAdsCount: adsCount,
          totalTradesCount: ordersCount,
        },
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch profile" };
  }
}

// ==========================================
// 5. INTERNAL WALLET TRANSFER (Spot <-> Funding/P2P)
// ==========================================

export async function transferFundingWallet(data: {
  asset: string;
  amount: number;
  direction: "TO_FUNDING" | "FROM_FUNDING";
}) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    if (!data.asset || !data.amount || data.amount <= 0) {
      return { success: false, error: "Invalid transfer amount or asset" };
    }

    const asset = data.asset.toUpperCase();

    const result = await prisma.$transaction(async (tx: DBClient) => {
      let spotWallet = await tx.wallet.findFirst({
        where: { userId: user.id, asset, type: "Currency" },
      });
      let fundingWallet = await tx.wallet.findFirst({
        where: { userId: user.id, asset, type: "P2P" },
      });

      if (!fundingWallet) {
        fundingWallet = await tx.wallet.create({
          data: { userId: user.id, asset, type: "P2P", balance: 0 },
        });
      }

      if (data.direction === "TO_FUNDING") {
        if (!spotWallet || (spotWallet.balance ?? 0) < data.amount) {
          throw new Error(`Insufficient ${asset} balance in Spot wallet`);
        }
        await tx.wallet.update({
          where: { id: spotWallet.id },
          data: { balance: { decrement: data.amount } },
        });
        await tx.wallet.update({
          where: { id: fundingWallet.id },
          data: { balance: { increment: data.amount } },
        });

        // Record transfer transactions
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "Transfer",
            asset,
            amount: -data.amount,
            fee: 0,
            status: "Passed",
            description: `Transferred ${data.amount} ${asset} from Spot to Funding (P2P)`,
          },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "Transfer",
            asset,
            amount: data.amount,
            fee: 0,
            status: "Passed",
            description: `Received ${data.amount} ${asset} in Funding (P2P) from Spot`,
          },
        });
      } else {
        if (!fundingWallet || (fundingWallet.balance ?? 0) < data.amount) {
          throw new Error(`Insufficient ${asset} balance in Funding wallet`);
        }
        await tx.wallet.update({
          where: { id: fundingWallet.id },
          data: { balance: { decrement: data.amount } },
        });
        if (!spotWallet) {
          spotWallet = await tx.wallet.create({
            data: { userId: user.id, asset, type: "Currency", balance: data.amount },
          });
        } else {
          await tx.wallet.update({
            where: { id: spotWallet.id },
            data: { balance: { increment: data.amount } },
          });
        }

        // Record transfer transactions
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "Transfer",
            asset,
            amount: -data.amount,
            fee: 0,
            status: "Passed",
            description: `Transferred ${data.amount} ${asset} from Funding (P2P) to Spot`,
          },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "Transfer",
            asset,
            amount: data.amount,
            fee: 0,
            status: "Passed",
            description: `Received ${data.amount} ${asset} in Spot from Funding (P2P)`,
          },
        });
      }

      return { spotWallet, fundingWallet };
    });

    safeRevalidate("/assets");
    safeRevalidate("/p2p");
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to complete wallet transfer" };
  }
}
