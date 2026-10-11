import { eq } from 'drizzle-orm';
import { platformSettings } from 'database';
import Decimal from 'decimal.js';

export interface FeeConfig {
  type: 'FIXED' | 'PERCENTAGE' | 'BOTH';
  amount?: string; // Fixed amount
  percentage?: string; // Percentage (0-100)
}

export const getFeeConfig = async (db: any, key: string, fallback: FeeConfig): Promise<FeeConfig> => {
  try {
    const setting = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).get();
    if (setting && setting.value) {
      try {
        const parsed = JSON.parse(setting.value);
        return {
          type: parsed.type || fallback.type,
          amount: parsed.amount ? String(parsed.amount) : undefined,
          percentage: parsed.percentage ? String(parsed.percentage) : undefined,
        };
      } catch (e) {
        // Fallback for simple string numeric values in legacy settings
        const num = parseFloat(setting.value);
        if (!isNaN(num)) {
          return { type: 'PERCENTAGE', percentage: String(num) };
        }
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch fee config for ${key}`, err);
  }
  return fallback;
};

export const calculateFee = (amount: string | number | Decimal, config: FeeConfig): string => {
  const amt = new Decimal(amount);
  let fee = new Decimal(0);
  
  if (config.type === 'FIXED' || config.type === 'BOTH') {
    if (config.amount) {
      fee = fee.plus(new Decimal(config.amount));
    }
  }
  if (config.type === 'PERCENTAGE' || config.type === 'BOTH') {
    if (config.percentage) {
      const pct = new Decimal(config.percentage).div(100);
      fee = fee.plus(amt.times(pct));
    }
  }
  return fee.toString();
};

export const getLimit = async (db: any, key: string, fallback: number): Promise<number> => {
  try {
    const setting = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).get();
    if (setting && setting.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (parsed && typeof parsed.amount === 'number') return parsed.amount;
      } catch (e) {
        const num = parseFloat(setting.value);
        if (!isNaN(num)) return num;
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch limit config for ${key}`, err);
  }
  return fallback;
};
