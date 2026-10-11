import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Bindings, Variables } from '../db';
import { currencyRates } from 'database';

export const publicCurrencyRateRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET all ACTIVE currency rates (Publicly accessible for platform conversions)
publicCurrencyRateRoutes.get('/', async (c) => {
  const db = c.get('db');
  
  try {
    const { platformSettings } = require('database');
    const baseSetting = await db.select().from(platformSettings).where(eq(platformSettings.key, 'BASE_CURRENCY')).get();
    const baseCurrency = baseSetting?.value || 'USDT';

    // Only return ACTIVE rates for frontend/platform usage
    const rates = await db.select().from(currencyRates).where(eq(currencyRates.status, 'ACTIVE')).all();
    
    // We can map this to a dictionary for easier frontend access if desired, 
    // but returning the array of objects is standard.
    const ratesDict = rates.reduce((acc, curr) => {
      acc[curr.code] = {
        rate: curr.ratePerUsdt,
        symbol: curr.symbol,
        precision: curr.decimalPrecision,
        name: curr.name,
        isBank: curr.isBank,
        isAsset: curr.isAsset
      };
      return acc;
    }, {} as Record<string, any>);

    return c.json({ success: true, data: ratesDict, list: rates, baseCurrency });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch currency rates' }, 500);
  }
});
