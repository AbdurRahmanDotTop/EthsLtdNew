import { create } from "zustand";
import { P2PAdvertisementQuery } from "@/lib/p2p/types";

interface P2PState {
  // Marketplace Filters
  query: P2PAdvertisementQuery;
  
  // Actions
  setQuery: (query: Partial<P2PAdvertisementQuery>) => void;
  resetQuery: () => void;
}

const defaultQuery: P2PAdvertisementQuery = {
  side: "buy",
  asset: "all",
  fiat: "all",
  paymentMethod: "all",
  amount: undefined,
  sortBy: "Best Price",
};

export const useP2PStore = create<P2PState>()((set) => ({
  query: defaultQuery,
  
  setQuery: (newQuery) =>
    set((state) => ({
      query: { ...state.query, ...newQuery },
    })),

  resetQuery: () => set({ query: defaultQuery }),
}));
