"use server";

import prisma, { DBClient, DBWallet, DBOrder } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendOrderExecutionNotification } from "@/lib/email";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside Next.js request context (e.g. CLI or background scripts)
  }
}

export type PlaceOrderResult =
  | { success: true; data: DBOrder; orderId: string; duplicatePrevented?: boolean; error?: undefined }
  | { success: false; error: string; data?: undefined; orderId?: undefined; duplicatePrevented?: undefined };

export type ClosePositionResult =
  | { success: true; order: DBOrder; pnl: number; returnAmount: number; error?: undefined }
  | { success: false; error: string; order?: undefined; pnl?: undefined; returnAmount?: undefined };

export type SettleOptionResult =
  | { success: true; status: string; pnl: number; payout: number; order: DBOrder; error?: undefined }
  | { success: false; error: string; status?: undefined; pnl?: undefined; payout?: undefined; order?: undefined };

// Secure resolver: Authenticates caller and isolates data strictly by user
async function resolveTradeUser(requestedUserId?: string) {
  const currentUser = await getCurrentUser();

  // CLI test mode bypass (strictly for test runner outside Next.js HTTP request scope with explicit requestedUserId)
  if (!currentUser && process.env.CLI_TEST_MODE === "true" && requestedUserId) {
    return prisma.user.findUnique({
      where: { id: requestedUserId },
      include: { wallets: true },
    });
  }

  if (!currentUser) {
    return null;
  }

  // If a specific userId is requested, only allow if it matches the current user or current user is Admin
  if (requestedUserId && requestedUserId !== currentUser.id) {
    const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";
    if (!isAdmin) {
      return null;
    }
    return prisma.user.findUnique({
      where: { id: requestedUserId },
      include: { wallets: true },
    });
  }

  return currentUser;
}

// Per-user throttling and in-flight deduplication to prevent duplicate concurrent reconciliations
const userLastReconcile: Record<string, number | undefined> = {};
const inFlightReconcile: Record<string, Promise<void> | undefined> = {};
const RECONCILE_THROTTLE_MS = 8000; // 8 seconds per user

export async function reconcileExpiredOptions(userId?: string) {
  const cacheKey = userId || "global";
  const now = Date.now();

  // Return existing in-flight reconciliation if currently running
  if (inFlightReconcile[cacheKey]) {
    return inFlightReconcile[cacheKey];
  }

  // Skip if reconciled recently for this user
  if (now - (userLastReconcile[cacheKey] || 0) < RECONCILE_THROTTLE_MS) {
    return;
  }

  const promise = (async () => {
    try {
      userLastReconcile[cacheKey] = Date.now();
      const whereClause: { category: string; status: string; userId?: string } = {
        category: "Option",
        status: "Awaiting",
      };
      if (userId) {
        whereClause.userId = userId;
      }

      const awaitingOrders = await prisma.order.findMany({
        where: whereClause,
      });

      if (!awaitingOrders || awaitingOrders.length === 0) {
        return;
      }

      const currentTime = Date.now();
      for (const ord of awaitingOrders) {
        const durationSec = ord.duration || 60;
        const expiryTime = new Date(ord.createdAt).getTime() + durationSec * 1000;
        if (currentTime >= expiryTime) {
          let currentPrice = ord.price;
          try {
            const cleanSymbol = ord.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const binanceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${cleanSymbol}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (binanceRes.ok) {
              const data = await binanceRes.json();
              if (data && data.price) {
                currentPrice = parseFloat(data.price);
              }
            }
          } catch {
            // Fallback to order execution price if external ticker is unreachable
          }
          await settleOptionOrder(ord.id, currentPrice);
        }
      }
    } catch (err) {
      console.error("reconcileExpiredOptions error:", err);
    } finally {
      delete inFlightReconcile[cacheKey];
    }
  })();

  inFlightReconcile[cacheKey] = promise;
  return promise;
}

export async function getUserTradingInfo(userId?: string) {
  try {
    const user = await resolveTradeUser(userId);

    if (!user) {
      return { success: false, error: "Not authenticated", balance: 0, uid: 0 };
    }

    // Auto-reconcile any expired option orders before calculating balances
    await reconcileExpiredOptions(user.id);

    // Refresh user wallets after reconciliation
    const refreshedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { wallets: true },
    });

    const activeUser = refreshedUser || user;
    const usdtWallet: any =
      (activeUser.wallets as any[]).find((w: any) => w.asset === "USDT" && w.type === "Currency") ||
      (activeUser.wallets as any[]).find((w: any) => w.asset === "USDT");

    const [activeOrders, pendingWithdrawals] = await Promise.all([
      prisma.order.findMany({
        where: {
          userId: activeUser.id,
          status: { in: ["Executed", "Awaiting", "Pending"] },
        },
      }),
      prisma.withdrawalRequest.findMany({
        where: {
          userId: activeUser.id,
          status: "PENDING",
        },
      }),
    ]);

    let onOrder = 0;
    for (const ord of activeOrders) {
      onOrder += ord.margin ?? ord.amount;
    }

    let onHold = 0;
    for (const w of pendingWithdrawals) {
      if (w.asset === "USDT") onHold += w.amount;
    }

    const available = usdtWallet ? usdtWallet.balance : 0;
    const totalBalance = available + onOrder + onHold;

    return {
      success: true,
      balance: available,
      available,
      onOrder,
      onHold,
      totalBalance,
      uid: activeUser.uid,
      email: activeUser.email,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to retrieve user trading info.";
    console.error("getUserTradingInfo Error:", err);
    return {
      success: false,
      error: errorMsg,
      balance: 0,
      available: 0,
      onOrder: 0,
      onHold: 0,
      totalBalance: 0,
      uid: 0,
    };
  }
}

export async function placeOrder({
  category = "Perpetual",
  symbol,
  type, // "Buy Long" | "Buy Short" | "Rise" | "Fall"
  amount, // Quantity in base asset or USDT investment
  price, // Execution price
  leverage = 100, // e.g. 5, 10, 20, 50, 100
  margin, // Calculated margin
  stopProfit,
  stopLoss,
  duration = 60,
  payout = 1.8,
  userId,
  clientOrderId,
}: {
  category?: "Perpetual" | "Option";
  symbol: string;
  type: string;
  amount: number;
  price: number;
  leverage?: number;
  margin?: number;
  stopProfit?: number | null;
  stopLoss?: number | null;
  duration?: number | null;
  payout?: number | null;
  userId?: string;
  clientOrderId?: string;
}): Promise<PlaceOrderResult> {
  try {
    const user = await resolveTradeUser(userId);

    if (!user) {
      return { success: false, error: "Please log in to place trades." };
    }

    // Required Margin:
    // If Perpetual: (amount * price) / leverage
    // If Option: amount is directly the investment in USDT
    const calculatedMargin =
      category === "Option"
        ? amount
        : (margin ?? (amount * price) / leverage);

    if (calculatedMargin <= 0) {
      return { success: false, error: "Invalid margin or lot amount." };
    }

    // Server-side market configuration & status validation
    const market = await prisma.market.findFirst({
      where: {
        OR: [
          { symbol: symbol.toUpperCase() },
          { binanceSymbol: symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") },
        ],
      },
    });

    if (!market) {
      return {
        success: false,
        error: `Market pair ${symbol} is not supported or not found.`,
      };
    }

    if (market.status !== "ACTIVE") {
      return {
        success: false,
        error: `Market ${market.symbol} is currently ${market.status.toLowerCase()}. New orders are blocked.`,
      };
    }
    if (market.tradingModes !== "ALL" && market.tradingModes !== category.toUpperCase()) {
      return {
        success: false,
        error: `Market ${market.symbol} is not available for ${category} trading.`,
      };
    }
    if (market.minOrderQty && amount < market.minOrderQty) {
      return {
        success: false,
        error: `Minimum order amount for ${market.symbol} is ${market.minOrderQty}.`,
      };
    }
    if (market.maxOrderQty && amount > market.maxOrderQty) {
      return {
        success: false,
        error: `Maximum order amount for ${market.symbol} is ${market.maxOrderQty}.`,
      };
    }
    if (category === "Perpetual" && market.maxLeverage && leverage > market.maxLeverage) {
      return {
        success: false,
        error: `Maximum leverage permitted for ${market.symbol} is ${market.maxLeverage}x.`,
      };
    }

    // Execute Atomically with idempotency and balance locking inside transaction
    const result = await prisma.$transaction(async (tx: DBClient) => {
      // 1. Idempotency Check (prevent duplicate orders from double click, retries, or refresh)
      if (clientOrderId && clientOrderId.trim()) {
        const existingOrder = await tx.order.findFirst({
          where: {
            userId: user.id,
            clientOrderId: clientOrderId.trim(),
          },
        });
        if (existingOrder) {
          return { order: existingOrder, isDuplicate: true };
        }
      }

      // 2. Fresh Wallet Fetch & Concurrency check inside transaction
      const userWithWallets = await tx.user.findUnique({
        where: { id: user.id },
        include: { wallets: true },
      });
      if (!userWithWallets) {
        throw new Error("User account not found.");
      }

      const freshUsdtWallet =
        userWithWallets.wallets.find((w: DBWallet) => w.asset === "USDT" && w.type === "Currency") ||
        userWithWallets.wallets.find((w: DBWallet) => w.asset === "USDT");

      if (!freshUsdtWallet) {
        throw new Error("USDT Wallet not found.");
      }

      if (freshUsdtWallet.balance < calculatedMargin) {
        throw new Error(
          `Insufficient balance. Required: ${calculatedMargin.toFixed(4)} USDT, Available: ${freshUsdtWallet.balance.toFixed(4)} USDT`
        );
      }

      // 3. Atomically deduct margin from wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: freshUsdtWallet.id },
        data: { balance: { decrement: calculatedMargin } },
      });

      // 4. Create Order Record linked strictly to authenticated user
      const order = await tx.order.create({
        data: {
          userId: user.id,
          clientOrderId: clientOrderId?.trim() || null,
          symbol,
          category,
          type,
          amount,
          price,
          leverage: category === "Perpetual" ? leverage : null,
          margin: calculatedMargin,
          duration: category === "Option" ? duration : null,
          payout: category === "Option" ? payout : null,
          stopProfit: stopProfit ?? null,
          stopLoss: stopLoss ?? null,
          status: category === "Option" ? "Awaiting" : "Executed",
        },
      });

      // 5. Record Transaction with proper negative debit signage
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: category === "Option" ? "Option Margin" : "Perpetual Margin",
          asset: "USDT",
          amount: -calculatedMargin, // Explicit negative debit
          status: "Passed",
          description: `${category} order #${order.id} opened: ${type} ${amount} ${symbol} @ ${price}`,
        },
      });

      return { order, updatedWallet, isDuplicate: false };
    });

    safeRevalidate("/trade");
    safeRevalidate("/options");
    safeRevalidate("/assets");

    if (user.email) {
      try {
        await sendOrderExecutionNotification({
          email: user.email,
          orderId: result.order.id,
          symbol: result.order.symbol,
          category: result.order.category || "Perpetual",
          type: result.order.type,
          amount: result.order.amount,
          price: result.order.price,
          status: result.order.status,
        });
      } catch (e) {
        console.warn("Order execution email dispatch failed:", e);
      }
    }
    return {
      success: true,
      data: result.order,
      orderId: result.order.id,
      duplicatePrevented: result.isDuplicate,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to execute order.";
    console.error("Order Execution Error:", error);
    return { success: false, error: errorMsg };
  }
}

export async function getOpenOrders(
  category: "Perpetual" | "Option" = "Perpetual",
  userId?: string
) {
  try {
    const user = await resolveTradeUser(userId);
    if (!user) return [];

    if (category === "Option") {
      await reconcileExpiredOptions(user.id);
    }

    const statusFilter = category === "Option" ? "Awaiting" : "Executed";

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        category,
        status: statusFilter,
      },
      orderBy: { createdAt: "desc" },
    });

    return orders;
  } catch (err) {
    console.error("getOpenOrders error:", err);
    return [];
  }
}

export async function getClosedOrders(
  category: "Perpetual" | "Option" = "Perpetual",
  userId?: string
) {
  try {
    const user = await resolveTradeUser(userId);
    if (!user) return [];

    if (category === "Option") {
      await reconcileExpiredOptions(user.id);
    }

    const statusFilter = category === "Option" ? { in: ["Win", "Loss", "Closed"] } : "Closed";

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        category,
        status: statusFilter,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return orders;
  } catch (err) {
    console.error("getClosedOrders error:", err);
    return [];
  }
}

export async function closePosition(
  orderId: string,
  closingPrice: number
): Promise<ClosePositionResult> {
  try {
    const currentUser = await getCurrentUser();
    const isCli = !currentUser && process.env.CLI_TEST_MODE === "true";

    const result = await prisma.$transaction(async (tx: DBClient) => {
      const freshOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!freshOrder || freshOrder.status !== "Executed") {
        throw new Error("Order not found or already closed.");
      }

      if (!isCli) {
        if (!currentUser) {
          throw new Error("Please log in first.");
        }
        if (freshOrder.userId !== currentUser.id && currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
          throw new Error("Unauthorized access to this order.");
        }
      }

      const margin = freshOrder.margin || (freshOrder.amount * freshOrder.price) / (freshOrder.leverage || 100);

      // Calculate PNL
      let pnl = 0;
      if (freshOrder.type === "Buy Long") {
        pnl = (closingPrice - freshOrder.price) * freshOrder.amount;
      } else if (freshOrder.type === "Buy Short") {
        pnl = (freshOrder.price - closingPrice) * freshOrder.amount;
      }

      // Isolated margin: max loss is margin
      const returnAmount = Math.max(0, margin + pnl);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "Closed",
          closePrice: closingPrice,
          realizedPnl: pnl,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: freshOrder.userId },
        include: { wallets: true },
      });
      const usdtWallet =
        user?.wallets.find((w: DBWallet) => w.asset === "USDT" && w.type === "Currency") ||
        user?.wallets.find((w: DBWallet) => w.asset === "USDT");

      if (usdtWallet && returnAmount > 0) {
        await tx.wallet.update({
          where: { id: usdtWallet.id },
          data: { balance: { increment: returnAmount } },
        });

        await tx.transaction.create({
          data: {
            userId: freshOrder.userId,
            type: "Position Closed",
            asset: "USDT",
            amount: returnAmount, // Positive credit
            status: "Passed",
            description: `Closed ${freshOrder.type} #${freshOrder.id} @ ${closingPrice}. Realized PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT`,
          },
        });
      }

      return { order: updatedOrder, pnl, returnAmount };
    });

    safeRevalidate("/trade");
    safeRevalidate("/assets");
    return { success: true, ...result };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to close position.";
    console.error("closePosition error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function updateStopProfitLoss(
  orderId: string,
  stopProfit: number | null,
  stopLoss: number | null
) {
  try {
    const currentUser = await getCurrentUser();
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "Executed") {
      return { success: false, error: "Order not found or already closed." };
    }

    const isCli = !currentUser && process.env.CLI_TEST_MODE === "true";
    if (!isCli) {
      if (!currentUser) {
        return { success: false, error: "Please log in first." };
      }
      if (order.userId !== currentUser.id && currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
        return { success: false, error: "Unauthorized access to this order." };
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        stopProfit,
        stopLoss,
      },
    });

    safeRevalidate("/trade");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update stop loss/profit.";
    console.error("updateStopProfitLoss error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function settleOptionOrder(
  orderId: string,
  closingPrice: number
): Promise<SettleOptionResult> {
  try {
    const currentUser = await getCurrentUser();
    const isCli = !currentUser && process.env.CLI_TEST_MODE === "true";

    const result = await prisma.$transaction(async (tx: DBClient) => {
      const freshOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!freshOrder || freshOrder.status !== "Awaiting") {
        throw new Error("Option order not found or already settled.");
      }

      if (!isCli && currentUser) {
        if (freshOrder.userId !== currentUser.id && currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
          throw new Error("Unauthorized access to this order.");
        }
      }

      const isRise = freshOrder.type === "Rise" || freshOrder.type === "Buy Long";
      const isWin = isRise ? closingPrice > freshOrder.price : closingPrice < freshOrder.price;
      const isTie = closingPrice === freshOrder.price;

      const payoutMultiplier = freshOrder.payout || 1.8;
      let payoutAmount = 0;
      let pnl = 0;

      if (isTie) {
        payoutAmount = freshOrder.amount; // Refund
        pnl = 0;
      } else if (isWin) {
        payoutAmount = freshOrder.amount * payoutMultiplier;
        pnl = payoutAmount - freshOrder.amount;
      } else {
        payoutAmount = 0;
        pnl = -freshOrder.amount;
      }

      const finalStatus = isTie ? "Closed" : isWin ? "Win" : "Loss";

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: finalStatus,
          closePrice: closingPrice,
          realizedPnl: pnl,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: freshOrder.userId },
        include: { wallets: true },
      });
      const usdtWallet =
        user?.wallets.find((w: DBWallet) => w.asset === "USDT" && w.type === "Currency") ||
        user?.wallets.find((w: DBWallet) => w.asset === "USDT");

      if (usdtWallet && payoutAmount > 0) {
        await tx.wallet.update({
          where: { id: usdtWallet.id },
          data: { balance: { increment: payoutAmount } },
        });

        await tx.transaction.create({
          data: {
            userId: freshOrder.userId,
            type: `Option ${finalStatus === "Closed" ? "Refund" : finalStatus}`,
            asset: "USDT",
            amount: payoutAmount, // Positive credit
            status: "Passed",
            description: `Option #${freshOrder.id} settled as ${finalStatus}: ${payoutAmount.toFixed(4)} USDT returned (PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT)`,
          },
        });
      } else if (finalStatus === "Loss") {
        await tx.transaction.create({
          data: {
            userId: freshOrder.userId,
            type: "Option Loss",
            asset: "USDT",
            amount: 0,
            status: "Passed",
            description: `Option #${freshOrder.id} settled as Loss (-${freshOrder.amount.toFixed(4)} USDT)`,
          },
        });
      }

      return { order: updatedOrder, status: finalStatus, pnl, payout: payoutAmount };
    });

    safeRevalidate("/options");
    safeRevalidate("/assets");
    return { success: true, ...result };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to settle option order.";
    console.error("settleOptionOrder error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function cancelOrder(orderId: string) {
  try {
    if (!orderId || typeof orderId !== "string") {
      return { success: false, error: "Order ID is required." };
    }
    const currentUser = await getCurrentUser();
    const isCli = !currentUser && process.env.CLI_TEST_MODE === "true";

    await prisma.$transaction(async (tx: DBClient) => {
      const freshOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!freshOrder) {
        throw new Error("Order not found.");
      }

      if (!isCli) {
        if (!currentUser) throw new Error("Please log in first.");
        if (
          freshOrder.userId !== currentUser.id &&
          currentUser.role !== "ADMIN" &&
          currentUser.role !== "SUPER_ADMIN"
        ) {
          throw new Error("Unauthorized access to this order.");
        }
      }

      if (freshOrder.status !== "Pending" && freshOrder.status !== "Executed" && freshOrder.status !== "Awaiting") {
        throw new Error("Order cannot be cancelled in its current state.");
      }

      const refundAmount = freshOrder.margin ?? freshOrder.amount;

      await tx.order.update({
        where: { id: orderId },
        data: { status: "Cancelled" },
      });

      if (refundAmount > 0) {
        const user = await tx.user.findUnique({
          where: { id: freshOrder.userId },
          include: { wallets: true },
        });
        const usdtWallet =
          user?.wallets.find((w: DBWallet) => w.asset === "USDT" && w.type === "Currency") ||
          user?.wallets.find((w: DBWallet) => w.asset === "USDT");
        if (usdtWallet) {
          await tx.wallet.update({
            where: { id: usdtWallet.id },
            data: { balance: { increment: refundAmount } },
          });

          await tx.transaction.create({
            data: {
              userId: freshOrder.userId,
              type: "Order Cancelled",
              asset: "USDT",
              amount: refundAmount, // Positive credit
              status: "Passed",
              description: `Refunded ${refundAmount.toFixed(4)} USDT for cancelled order #${freshOrder.id}`,
            },
          });
        }
      }
    });

    safeRevalidate("/trade");
    safeRevalidate("/options");
    safeRevalidate("/assets");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to cancel order.";
    console.error("cancelOrder error:", err);
    return { success: false, error: errorMsg };
  }
}

