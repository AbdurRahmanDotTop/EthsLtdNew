export interface TrackingConfigData {
  id: string;
  metaPixelEnabled: boolean;
  metaPixelId: string | null;
  metaCustomScript?: string | null;
  gtmEnabled: boolean;
  gtmId: string | null;
  gtmCustomScript?: string | null;
  customHeadCode?: string | null;
  customBodyCode?: string | null;
  trackAdminPages: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TrackingConfigInput {
  metaPixelEnabled: boolean;
  metaPixelId?: string | null;
  metaCustomScript?: string | null;
  gtmEnabled: boolean;
  gtmId?: string | null;
  gtmCustomScript?: string | null;
  customHeadCode?: string | null;
  customBodyCode?: string | null;
  trackAdminPages: boolean;
}

export const DEFAULT_TRACKING_CONFIG: TrackingConfigData = {
  id: "default",
  metaPixelEnabled: true,
  metaPixelId: "1412523413789691",
  metaCustomScript: null,
  gtmEnabled: true,
  gtmId: "GTM-TD6VJP5R",
  gtmCustomScript: null,
  customHeadCode: null,
  customBodyCode: null,
  trackAdminPages: false,
};
