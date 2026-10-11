import { eq } from 'drizzle-orm';
import { currencyRates, platformSettings } from 'database';
import { getRealPrice } from '../utils/price';
import { getFeeConfig, calculateFee } from './fees';
import Decimal from 'decimal.js';

const KNOWN_CRYPTOS = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'XRP', 'TRX', 'ADA', 'DOGE', 'LTC', 'BCH', 'MATIC', 'DOT'];

export async function calculateDepositPreview(
  db: any,
  amount: number,
  currencyCode: string,
  paymentMethodId: string | null
) {
  let grossUsdt = new Decimal(amount);
  let conversionRateValue = 1;
  
  if (currencyCode !== 'USDT') {
    const baseCurrencyCode = currencyCode.split('(')[0].trim().toUpperCase();
    const isCrypto = KNOWN_CRYPTOS.includes(baseCurrencyCode);
    
    if (isCrypto) {
      if (baseCurrencyCode === 'USDT' || baseCurrencyCode === 'USDC') {
        conversionRateValue = 1;
        grossUsdt = new Decimal(amount);
      } else {
        // It's a Crypto Asset. Fetch real-time price from Binance (Price in USDT)
        const realPrice = await getRealPrice(`${baseCurrencyCode}-USDT`);
        if (!realPrice || realPrice <= 0) {
          throw new Error(`Real-time price unavailable for ${baseCurrencyCode}`);
        }
        conversionRateValue = realPrice;
        // Formula: 1 BTC = 60000 USDT -> grossUsdt = amount * price
        grossUsdt = new Decimal(amount).times(conversionRateValue);
      }
    } else {
      // It's a Fiat Asset. Fetch from admin-managed currencyRates table
      const rateRecord = await db.select().from(currencyRates).where(eq(currencyRates.code, currencyCode)).get();
      if (!rateRecord || rateRecord.status !== 'ACTIVE') {
        throw new Error(`Active Global Currency Rate not found for ${currencyCode}`);
      }
      
      const ratePerUsdt = new Decimal(rateRecord.ratePerUsdt);
      if (ratePerUsdt.lte(0)) {
        throw new Error(`Invalid conversion rate for ${currencyCode}`);
      }
      // ratePerUsdt is stored as "How many Fiat units per 1 USDT" (e.g. 1 USDT = 84 INR)
      // We normalize the conversion rate to "USDT per 1 Unit" for the UI display
      conversionRateValue = new Decimal(1).div(ratePerUsdt).toNumber();
      
      // Formula: 1000 INR / 84 = 11.9 USDT
      grossUsdt = new Decimal(amount).div(ratePerUsdt);
    }
  }

  let depositFee = new Decimal(0);
  try {
    const feeConfig = await getFeeConfig(db, 'DEPOSIT_FEE', { type: 'FIXED', amount: "0", percentage: "0" });
    depositFee = new Decimal(calculateFee(grossUsdt.toNumber(), feeConfig));
  } catch(e) {
    console.error("Failed to calculate global deposit fee", e);
  }

  const totalFees = depositFee;
  const netUsdt = grossUsdt.minus(totalFees);

  return {
    originalAmount: amount,
    originalCurrency: currencyCode,
    conversionRate: conversionRateValue,
    grossUsdt: grossUsdt.toDP(4).toNumber(),
    depositFee: depositFee.toDP(4).toNumber(),
    otherFees: 0,
    totalFees: totalFees.toDP(4).toNumber(),
    netUsdt: netUsdt.toDP(4).toNumber(),
  };
}

export async function calculateWithdrawalPreview(
  db: any,
  usdtAmount: number,
  currencyCode: string,
  paymentMethodId: string | null
) {
  let withdrawalFee = new Decimal(0);
  try {
    const feeConfig = await getFeeConfig(db, 'WITHDRAWAL_FEE', { type: 'FIXED', amount: "0", percentage: "0" });
    withdrawalFee = new Decimal(calculateFee(usdtAmount, feeConfig));
  } catch(e) {
    console.error("Failed to calculate global withdrawal fee", e);
  }

  const totalFees = withdrawalFee;
  const netUsdtReceived = new Decimal(usdtAmount).minus(totalFees);

  let conversionRateValue = 1;
  let finalFiatAmount = netUsdtReceived;

  if (currencyCode !== 'USDT') {
    const baseCurrencyCode = currencyCode.split('(')[0].trim().toUpperCase();
    const isCrypto = KNOWN_CRYPTOS.includes(baseCurrencyCode);
    
    if (isCrypto) {
      if (baseCurrencyCode === 'USDT' || baseCurrencyCode === 'USDC') {
        conversionRateValue = 1;
        finalFiatAmount = netUsdtReceived;
      } else {
        // It's a Crypto Asset. 
        const realPrice = await getRealPrice(`${baseCurrencyCode}-USDT`);
        if (!realPrice || realPrice <= 0) {
          throw new Error(`Real-time price unavailable for ${baseCurrencyCode}`);
        }
        conversionRateValue = realPrice;
        // Formula: 60000 USDT withdrawal in BTC -> 60000 / 60000 = 1 BTC
        finalFiatAmount = netUsdtReceived.div(conversionRateValue);
      }
    } else {
      // It's a Fiat Asset.
      const rateRecord = await db.select().from(currencyRates).where(eq(currencyRates.code, currencyCode)).get();
      if (!rateRecord || rateRecord.status !== 'ACTIVE') {
        throw new Error(`Active Global Currency Rate not found for ${currencyCode}`);
      }
      
      const ratePerUsdt = new Decimal(rateRecord.ratePerUsdt);
      if (ratePerUsdt.lte(0)) {
        throw new Error(`Invalid conversion rate for ${currencyCode}`);
      }
      
      // Normalized for UI display: 1 Fiat = X USDT
      conversionRateValue = new Decimal(1).div(ratePerUsdt).toNumber();
      
      // Formula: 10 USDT withdrawal in INR (rate 84) -> 10 * 84 = 840 INR
      finalFiatAmount = netUsdtReceived.times(ratePerUsdt);
    }
  }

  return {
    requestedUsdt: new Decimal(usdtAmount).toDP(4).toNumber(),
    withdrawalFee: withdrawalFee.toDP(4).toNumber(),
    otherFees: 0,
    totalFees: totalFees.toDP(4).toNumber(),
    netUsdtReceived: netUsdtReceived.toDP(4).toNumber(),
    currencyCode: currencyCode,
    conversionRate: conversionRateValue,
    finalFiatAmount: finalFiatAmount.toDP(4).toNumber()
  };
}
