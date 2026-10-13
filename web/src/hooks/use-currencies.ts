import { useState, useEffect } from 'react';
import { ASSETS as FALLBACK_ASSETS, FIAT_CURRENCIES as FALLBACK_FIATS } from '@/lib/p2p/constants';
import { getPlatformCurrencies } from '@/actions/p2p';

export interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  ratePerUsdt?: string;
  decimalPrecision?: number;
  isAsset?: boolean;
  isBank?: boolean;
}

const defaultRates: CurrencyRate[] = [
  ...FALLBACK_ASSETS.map((a) => ({
    code: a.code,
    name: a.name,
    symbol: a.code,
    isAsset: true,
    isBank: false,
  })),
  ...FALLBACK_FIATS.map((f) => ({
    code: f.code,
    name: f.name,
    symbol: f.symbol,
    isAsset: false,
    isBank: true,
  })),
];

export function useCurrencies() {
  const [rates, setRates] = useState<CurrencyRate[]>(defaultRates);
  const [assets, setAssets] = useState<any[]>(FALLBACK_ASSETS);
  const [fiats, setFiats] = useState<any[]>(FALLBACK_FIATS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPlatformCurrencies()
      .then((res) => {
        if (!mounted) return;
        if (res.success) {
          if (res.assets && res.assets.length > 0) {
            setAssets(res.assets);
          }
          if (res.fiats && res.fiats.length > 0) {
            setFiats(res.fiats);
          }
          const dynamicRates: CurrencyRate[] = [
            ...(res.assets || []).map((a: any) => ({
              code: a.code,
              name: a.name,
              symbol: a.symbol,
              isAsset: true,
              isBank: false,
            })),
            ...(res.fiats || []).map((f: any) => ({
              code: f.code,
              name: f.name,
              symbol: f.symbol,
              isAsset: false,
              isBank: true,
            })),
          ];
          if (dynamicRates.length > 0) {
            setRates(dynamicRates);
          }
        }
      })
      .catch((err) => console.error("Error fetching platform currencies:", err))
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { rates, assets, fiats, isLoading };
}
