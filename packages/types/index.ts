export type ApiPermission = "READ" | "TRADE" | "WITHDRAW";
export type ApiEnvironment = "TEST" | "LIVE";
export type ApiStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface ApiKey {
  id: string; // e.g., eth_live_xxxxx
  name: string;
  userId: string;
  environment: ApiEnvironment;
  permissions: ApiPermission[];
  ipRestrictions: string[]; // empty array means no restrictions
  status: ApiStatus;
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
}

export interface CreateApiKeyRequest {
  name: string;
  environment: ApiEnvironment;
  permissions: ApiPermission[];
  ipRestrictions: string[];
  expiresInDays?: number;
}

export interface CreateApiKeyResponse {
  key: ApiKey;
  secret: string; // ONLY RETURNED ONCE!
}

export interface ApiUsageStats {
  requestsToday: number;
  requestsThisMonth: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  activeWebsockets: number;
  lastActivityAt?: number;
}

// User Types
export interface User {
  id: string;
  email: string;
  status: "ACTIVE" | "FROZEN" | "BANNED" | "PENDING_VERIFICATION";
  role: "USER" | "ADMIN" | "SUPPORT" | "SUPER_ADMIN" | "EXPERT" | "COMPLIANCE_ADMIN" | "SUPPORT_ADMIN";
  createdAt: number;
  mfaEnabled: boolean;
  emailVerified?: boolean;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
}
