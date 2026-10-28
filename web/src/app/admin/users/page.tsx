"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  MinusCircle,
  User,
  Edit,
  KeyRound,
  UserCheck,
  X,
  Star,
  Loader2,
  PlusCircle,
  DollarSign,
  Trash2,
  AlertOctagon,
  AlertTriangle,
  Shield,
  CreditCard,
  Wallet,
  TrendingUp,
  History,
  UserPlus,
  RefreshCw,
  ExternalLink,
  Lock,
  Mail,
  Phone,
  Layers,
} from "lucide-react";
import {
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  adjustUserBalance,
  getUserDetailsAdmin,
  updateUserProfileAdmin,
  adminCreateUser,
  adminAddBankCard,
  adminDeleteBankCard,
  adminAddCryptoWallet,
  adminDeleteCryptoWallet,
  adminAssignRmToUser,
  adminRemoveRmFromUser,
  adminResetUserPin,
  getAllRmsAdmin,
  adminDeleteUser,
  type UserStatus,
  type UserRole,
  type UpdateUserProfileAdminInput,
  type AdminCreateUserInput,
} from "@/actions/admin";
import { toast } from "sonner";

interface WalletRecord {
  id: string;
  asset: string;
  type: string;
  balance: number;
  lockedBalance?: number;
  escrowBalance?: number;
}

interface BankCardItem {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban?: string | null;
  swiftCode?: string | null;
  ifscCode?: string | null;
  branchName?: string | null;
  fullName?: string | null;
  country?: string | null;
  isPrimary?: boolean;
  status: string;
  createdAt: Date | string;
}

interface CryptoWalletItem {
  id: string;
  asset: string;
  network: string;
  address: string;
  label: string;
  memo?: string | null;
  isPrimary?: boolean;
  status: string;
  createdAt: Date | string;
}

interface KycRecord {
  id: string;
  documentType: string;
  fullName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  idNumber: string;
  address: string;
  idFrontUrl?: string | null;
  idBackUrl?: string | null;
  status: string;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | string | null;
}

interface OrderItem {
  id: string;
  symbol: string;
  category: string;
  type: string;
  amount: number;
  price: number;
  status: string;
  createdAt: Date | string;
}

interface TransactionItem {
  id: string;
  type: string;
  asset: string;
  amount: number;
  status: string;
  description?: string | null;
  createdAt: Date | string;
}

interface DepositItem {
  id: string;
  amount: number;
  asset: string;
  method: string;
  referenceNumber: string;
  status: string;
  createdAt: Date | string;
}

interface WithdrawalItem {
  id: string;
  amount: number;
  receiveAmount: number;
  asset: string;
  method: string;
  status: string;
  createdAt: Date | string;
}

interface P2pOrderItem {
  id: string;
  orderNumber?: string;
  asset: string;
  cryptoAmount: number;
  fiatAmount: number;
  fiatCurrency: string;
  status: string;
  createdAt: Date | string;
}

interface UserListItem {
  id: string;
  uid: number;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  isKycVerified: boolean;
  isEmailVerified?: boolean;
  isMerchant?: boolean;
  merchantTier?: string;
  avatarUrl?: string | null;
  phone?: string | null;
  wallets: WalletRecord[];
  createdAt: Date | string;
  _count?: {
    orders: number;
    transactions: number;
  };
}

interface RmOption {
  id: string;
  name: string | null;
  email: string;
  status: string;
  rmCode?: string;
  activeClientsCount?: number;
}

interface RmClientConnectionItem {
  id: string;
  rmId: string;
  status: string;
  requestedAt: Date | string;
  rm?: {
    id: string;
    uid: number;
    name: string | null;
    email: string;
    rmProfile?: {
      rmCode: string;
      designation?: string | null;
    } | null;
  } | null;
}

interface RmReviewItem {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: Date | string;
  rm?: {
    id: string;
    uid: number;
    name: string | null;
    email: string;
  } | null;
}

interface UserProfileDetails extends UserListItem {
  bankCards?: BankCardItem[];
  cryptoWallets?: CryptoWalletItem[];
  kyc?: KycRecord | null;
  orders?: OrderItem[];
  transactions?: TransactionItem[];
  deposits?: DepositItem[];
  withdrawals?: WithdrawalItem[];
  p2pAds?: any[];
  p2pOrdersAsBuyer?: P2pOrderItem[];
  p2pOrdersAsSeller?: P2pOrderItem[];
  rmClientConnections?: RmClientConnectionItem[];
  rmReviewsGiven?: RmReviewItem[];
}

type ProfileTab = "profile" | "security" | "kyc" | "wallets" | "activity" | "rm" | "danger";
type ActivitySubTab = "orders" | "transactions" | "deposits" | "withdrawals" | "p2p";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Available RMs for assignment
  const [availableRms, setAvailableRms] = useState<RmOption[]>([]);

  // 1. Balance Adjustment Modal State
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [adjustAsset, setAdjustAsset] = useState("USDT");
  const [adjustType, setAdjustType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // 2. User Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "USER" as UserRole,
    status: "ACTIVE" as UserStatus,
    isKycVerified: false,
    isEmailVerified: true,
    isMerchant: false,
    merchantTier: "STANDARD",
    initialBalanceUsdt: 0,
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // 3. User Profile Modal State
  const [profileModalUser, setProfileModalUser] = useState<UserListItem | null>(null);
  const [fullUserDetails, setFullUserDetails] = useState<UserProfileDetails | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [activitySubTab, setActivitySubTab] = useState<ActivitySubTab>("orders");

  // Profile Form Tab
  const [profileForm, setProfileForm] = useState<{
    name: string;
    email: string;
    phone: string;
    avatarUrl: string;
    status: UserStatus;
    role: UserRole;
    isKycVerified: boolean;
    isEmailVerified: boolean;
    isMerchant: boolean;
    merchantTier: string;
  }>({
    name: "",
    email: "",
    phone: "",
    avatarUrl: "",
    status: "ACTIVE",
    role: "USER",
    isKycVerified: false,
    isEmailVerified: false,
    isMerchant: false,
    merchantTier: "STANDARD",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security Form Tab
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [customPin, setCustomPin] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);

  // KYC Details Tab
  const [kycForm, setKycForm] = useState({
    documentType: "GOVERNMENT_ID",
    idNumber: "",
    fullName: "",
    dateOfBirth: "",
    gender: "MALE",
    nationality: "",
    country: "",
    city: "",
    state: "",
    postalCode: "",
    address: "",
    status: "APPROVED",
    rejectionReason: "",
  });
  const [isSavingKyc, setIsSavingKyc] = useState(false);

  // Bank Cards Management
  const [showAddBankForm, setShowAddBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    iban: "",
    swiftCode: "",
    ifscCode: "",
    branchName: "",
    country: "India",
  });
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [isDeletingBankId, setIsDeletingBankId] = useState<string | null>(null);

  // Crypto Wallets Management
  const [showAddCryptoForm, setShowAddCryptoForm] = useState(false);
  const [cryptoForm, setCryptoForm] = useState({
    asset: "USDT",
    network: "TRC20",
    address: "",
    label: "Main USDT Wallet",
    memo: "",
  });
  const [isAddingCrypto, setIsAddingCrypto] = useState(false);
  const [isDeletingCryptoId, setIsDeletingCryptoId] = useState<string | null>(null);

  // Relationship Manager Assignment
  const [selectedRmId, setSelectedRmId] = useState("");
  const [isAssigningRm, setIsAssigningRm] = useState(false);
  const [isRemovingRm, setIsRemovingRm] = useState(false);

  // Delete User Modal State
  const [deleteModalUser, setDeleteModalUser] = useState<UserListItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const [usersData, rmsData] = await Promise.all([
        getAllUsers(),
        getAllRmsAdmin(),
      ]);
      setUsers(usersData as unknown as UserListItem[]);
      setAvailableRms(rmsData.filter((r) => r.status === "ACTIVE") as unknown as RmOption[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [usersData, rmsData] = await Promise.all([
          getAllUsers(),
          getAllRmsAdmin(),
        ]);
        if (!ignore) {
          setUsers(usersData as unknown as UserListItem[]);
          setAvailableRms(rmsData.filter((r) => r.status === "ACTIVE") as unknown as RmOption[]);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg || "Failed to load users");
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    void init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    try {
      const res = await updateUserStatus(userId, newStatus);
      if (res.success) {
        toast.success(`User status updated to ${newStatus}`);
        loadUsers();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const res = await updateUserRole(userId, newRole);
      if (res.success) {
        toast.success(`User role updated to ${newRole}`);
        loadUsers();
      } else {
        toast.error(res.error || "Failed to update role.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Adjustment reason is required for audit logs.");
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const res = await adjustUserBalance({
        userId: selectedUser.id,
        asset: adjustAsset,
        amount,
        type: adjustType,
        reason: adjustReason.trim(),
      });

      if (res.success) {
        toast.success(`Successfully adjusted balance! New ${adjustAsset} balance: ${res.newBalance}`);
        setSelectedUser(null);
        setAdjustAmount("");
        setAdjustReason("");
        loadUsers();
        if (profileModalUser && profileModalUser.id === selectedUser.id) {
          const refreshed = await getUserDetailsAdmin(profileModalUser.id);
          if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
        }
      } else {
        toast.error(res.error || "Adjustment failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      toast.error(msg);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!createForm.email.trim() || !createForm.email.includes("@")) {
      toast.error("Please provide a valid email address.");
      return;
    }
    if (createForm.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await adminCreateUser({
        name: createForm.name.trim() || undefined,
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim() || undefined,
        password: createForm.password,
        role: createForm.role,
        status: createForm.status,
        isKycVerified: createForm.isKycVerified,
        isEmailVerified: createForm.isEmailVerified,
        isMerchant: createForm.isMerchant,
        merchantTier: createForm.merchantTier,
        initialBalanceUsdt: Number(createForm.initialBalanceUsdt) || 0,
      });

      if (res.success) {
        toast.success(res.message || "User created successfully!");
        setIsCreateModalOpen(false);
        setCreateForm({
          name: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
          role: "USER",
          status: "ACTIVE",
          isKycVerified: false,
          isEmailVerified: true,
          isMerchant: false,
          merchantTier: "STANDARD",
          initialBalanceUsdt: 0,
        });
        loadUsers();
      } else {
        toast.error(res.error || "Failed to create user.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user.";
      toast.error(msg);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleOpenProfileModal = async (user: UserListItem) => {
    setProfileModalUser(user);
    setIsLoadingProfile(true);
    setActiveTab("profile");
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setCustomPin("");
    setShowAddBankForm(false);
    setShowAddCryptoForm(false);

    setProfileForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      avatarUrl: user.avatarUrl || "",
      status: user.status || "ACTIVE",
      role: user.role || "USER",
      isKycVerified: Boolean(user.isKycVerified),
      isEmailVerified: Boolean(user.isEmailVerified),
      isMerchant: Boolean(user.isMerchant),
      merchantTier: user.merchantTier || "STANDARD",
    });

    try {
      const res = await getUserDetailsAdmin(user.id);
      if (res.success && res.user) {
        const userDetails = res.user as UserProfileDetails;
        setFullUserDetails(userDetails);

        // Populate KYC Form
        if (userDetails.kyc) {
          setKycForm({
            documentType: userDetails.kyc.documentType || "GOVERNMENT_ID",
            idNumber: userDetails.kyc.idNumber || "",
            fullName: userDetails.kyc.fullName || user.name || "",
            dateOfBirth: userDetails.kyc.dateOfBirth || "",
            gender: userDetails.kyc.gender || "MALE",
            nationality: userDetails.kyc.nationality || "",
            country: userDetails.kyc.country || "",
            city: userDetails.kyc.city || "",
            state: userDetails.kyc.state || "",
            postalCode: userDetails.kyc.postalCode || "",
            address: userDetails.kyc.address || "",
            status: userDetails.kyc.status || "APPROVED",
            rejectionReason: userDetails.kyc.rejectionReason || "",
          });
        } else {
          setKycForm({
            documentType: "GOVERNMENT_ID",
            idNumber: "",
            fullName: user.name || "",
            dateOfBirth: "",
            gender: "MALE",
            nationality: "",
            country: "",
            city: "",
            state: "",
            postalCode: "",
            address: "",
            status: user.isKycVerified ? "APPROVED" : "PENDING",
            rejectionReason: "",
          });
        }

        const activeConn = userDetails.rmClientConnections?.find(
          (c: RmClientConnectionItem) => c.status === "ACTIVE" || c.status === "ACCEPTED" || c.status === "REQUESTED"
        );
        setSelectedRmId(activeConn ? activeConn.rmId : "");
      } else {
        setFullUserDetails(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to load user profile details.");
      setFullUserDetails(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSaveProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileModalUser) return;

    setIsSavingProfile(true);
    try {
      const res = await updateUserProfileAdmin(profileModalUser.id, {
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
        avatarUrl: profileForm.avatarUrl,
        status: profileForm.status,
        role: profileForm.role,
        isKycVerified: profileForm.isKycVerified,
        isEmailVerified: profileForm.isEmailVerified,
        isMerchant: profileForm.isMerchant,
        merchantTier: profileForm.merchantTier,
      });

      if (res.success) {
        toast.success(res.message || "User profile updated successfully!");
        loadUsers();
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to update profile.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileModalUser) return;
    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await updateUserProfileAdmin(profileModalUser.id, {
        newPassword: passwordForm.newPassword,
      });
      if (res.success) {
        toast.success("User password has been updated and securely hashed.");
        setPasswordForm({ newPassword: "", confirmPassword: "" });
      } else {
        toast.error(res.error || "Failed to update password.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      toast.error(msg);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSaveCustomPin = async () => {
    if (!profileModalUser) return;
    if (!customPin || customPin.trim().length !== 6 || !/^\d{6}$/.test(customPin.trim())) {
      toast.error("PIN must be exactly 6 digits.");
      return;
    }

    setIsSettingPin(true);
    try {
      const res = await updateUserProfileAdmin(profileModalUser.id, {
        transactionPin: customPin.trim(),
      });
      if (res.success) {
        toast.success("Transaction PIN updated successfully.");
        setCustomPin("");
      } else {
        toast.error(res.error || "Failed to update PIN.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update PIN.";
      toast.error(msg);
    } finally {
      setIsSettingPin(false);
    }
  };

  const handleResetPinDefault = async () => {
    if (!profileModalUser) return;
    if (!confirm(`Reset transaction PIN for ${profileModalUser.name || profileModalUser.email} to default (123456)?`)) return;

    setIsResettingPin(true);
    try {
      const res = await adminResetUserPin(profileModalUser.id);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.error || "Failed to reset PIN.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset PIN.";
      toast.error(msg);
    } finally {
      setIsResettingPin(false);
    }
  };

  const handleSaveKycSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileModalUser) return;

    setIsSavingKyc(true);
    try {
      const isApproved = kycForm.status === "APPROVED";
      const res = await updateUserProfileAdmin(profileModalUser.id, {
        isKycVerified: isApproved,
        kycDetails: {
          documentType: kycForm.documentType,
          idNumber: kycForm.idNumber.trim(),
          fullName: kycForm.fullName.trim(),
          dateOfBirth: kycForm.dateOfBirth.trim() || undefined,
          gender: kycForm.gender,
          nationality: kycForm.nationality.trim() || undefined,
          country: kycForm.country.trim() || undefined,
          city: kycForm.city.trim() || undefined,
          state: kycForm.state.trim() || undefined,
          postalCode: kycForm.postalCode.trim() || undefined,
          address: kycForm.address.trim(),
          status: kycForm.status,
          rejectionReason: kycForm.status === "REJECTED" ? kycForm.rejectionReason.trim() : undefined,
        },
      });

      if (res.success) {
        toast.success("KYC application details updated successfully.");
        loadUsers();
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to update KYC application.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update KYC.";
      toast.error(msg);
    } finally {
      setIsSavingKyc(false);
    }
  };

  const handleAddBankSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileModalUser) return;
    if (!bankForm.bankName.trim()) {
      toast.error("Bank name is required.");
      return;
    }

    setIsAddingBank(true);
    try {
      const res = await adminAddBankCard({
        userId: profileModalUser.id,
        bankName: bankForm.bankName.trim(),
        accountHolder: bankForm.accountHolder.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        iban: bankForm.iban.trim() || undefined,
        swiftCode: bankForm.swiftCode.trim() || undefined,
        ifscCode: bankForm.ifscCode.trim() || undefined,
        branchName: bankForm.branchName.trim() || undefined,
        country: bankForm.country.trim(),
      });

      if (res.success) {
        toast.success("Bank card added successfully.");
        setShowAddBankForm(false);
        setBankForm({
          bankName: "",
          accountHolder: "",
          accountNumber: "",
          iban: "",
          swiftCode: "",
          ifscCode: "",
          branchName: "",
          country: "India",
        });
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to add bank card.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add bank card.";
      toast.error(msg);
    } finally {
      setIsAddingBank(false);
    }
  };

  const handleDeleteBankCard = async (cardId: string) => {
    if (!profileModalUser) return;
    if (!confirm("Remove this bank card from user account?")) return;

    setIsDeletingBankId(cardId);
    try {
      const res = await adminDeleteBankCard(cardId);
      if (res.success) {
        toast.success("Bank card removed.");
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to delete card.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete card.";
      toast.error(msg);
    } finally {
      setIsDeletingBankId(null);
    }
  };

  const handleAddCryptoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileModalUser) return;
    if (!cryptoForm.address.trim()) {
      toast.error("Wallet address is required.");
      return;
    }

    setIsAddingCrypto(true);
    try {
      const res = await adminAddCryptoWallet({
        userId: profileModalUser.id,
        asset: cryptoForm.asset,
        network: cryptoForm.network,
        address: cryptoForm.address.trim(),
        label: cryptoForm.label.trim() || `${cryptoForm.asset} Wallet`,
        memo: cryptoForm.memo.trim() || undefined,
      });

      if (res.success) {
        toast.success("Crypto wallet added successfully.");
        setShowAddCryptoForm(false);
        setCryptoForm({
          asset: "USDT",
          network: "TRC20",
          address: "",
          label: "Main USDT Wallet",
          memo: "",
        });
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to add crypto wallet.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add crypto wallet.";
      toast.error(msg);
    } finally {
      setIsAddingCrypto(false);
    }
  };

  const handleDeleteCryptoWallet = async (walletId: string) => {
    if (!profileModalUser) return;
    if (!confirm("Remove this crypto wallet address from user account?")) return;

    setIsDeletingCryptoId(walletId);
    try {
      const res = await adminDeleteCryptoWallet(walletId);
      if (res.success) {
        toast.success("Crypto wallet address removed.");
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to delete crypto wallet.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete crypto wallet.";
      toast.error(msg);
    } finally {
      setIsDeletingCryptoId(null);
    }
  };

  const handleAssignRm = async () => {
    if (!profileModalUser || !selectedRmId) {
      toast.error("Please select a Relationship Manager from the dropdown.");
      return;
    }

    setIsAssigningRm(true);
    try {
      const res = await adminAssignRmToUser(profileModalUser.id, selectedRmId);
      if (res.success) {
        toast.success(res.message);
        loadUsers();
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to assign RM.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to assign RM.";
      toast.error(msg);
    } finally {
      setIsAssigningRm(false);
    }
  };

  const handleRemoveRm = async () => {
    if (!profileModalUser) return;
    if (!confirm("Are you sure you want to remove the assigned Relationship Manager from this client?")) return;

    setIsRemovingRm(true);
    try {
      const res = await adminRemoveRmFromUser(profileModalUser.id);
      if (res.success) {
        toast.success(res.message);
        setSelectedRmId("");
        loadUsers();
        const refreshed = await getUserDetailsAdmin(profileModalUser.id);
        if (refreshed.success && refreshed.user) setFullUserDetails(refreshed.user as UserProfileDetails);
      } else {
        toast.error(res.error || "Failed to remove RM assignment.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove RM assignment.";
      toast.error(msg);
    } finally {
      setIsRemovingRm(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteModalUser) return;
    if (deleteConfirmText.trim() !== "DELETE") {
      toast.error("Please type DELETE to confirm permanent deletion.");
      return;
    }

    setIsDeletingUser(true);
    try {
      const res = await adminDeleteUser(deleteModalUser.id);
      if (res.success) {
        toast.success(res.message || "User permanently deleted.");
        setDeleteModalUser(null);
        setProfileModalUser(null);
        setDeleteConfirmText("");
        loadUsers();
      } else {
        toast.error(res.error || "Failed to delete user.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast.error(msg);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.uid.toString().includes(q) || (u.name && u.name.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
            <span>User Management</span>
            <span className="text-xs font-mono font-bold bg-[#00A070]/10 text-[#00A070] px-2.5 py-0.5 rounded-full">
              {users.length} Total Accounts
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Complete A–Z administrator control: Profiles, Security, KYC, Wallets, RM & Cascade Deletion.
          </p>
        </div>

        {/* Search & Create Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search email, name, UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#161822] border border-white/10 focus:border-[#00A070] pl-10 pr-4 py-2 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none"
            />
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl min-w-0">
        {isLoading ? (
          <div className="py-20 flex justify-center text-[#00A070]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-500">
            No users found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[750px] text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-[#10121A]">
                  <th className="px-5 py-3.5">User / UID</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">KYC</th>
                  <th className="px-4 py-3.5">USDT Balance</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {filteredUsers.map((user) => {
                  const usdtWallet = user.wallets?.find((w) => w.asset === "USDT" && w.type === "Currency");
                  const balance = usdtWallet ? usdtWallet.balance : 0.0;

                  return (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#00A070]/15 text-[#00A070] flex items-center justify-center font-bold text-xs uppercase overflow-hidden border border-[#00A070]/20">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : user.name ? (
                              user.name.charAt(0)
                            ) : (
                              user.email.charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{user.name || "Unnamed"}</span>
                              <span className="text-[10px] font-mono font-bold text-[#00A070] bg-[#00A070]/10 px-1.5 py-0.5 rounded">
                                #{user.uid}
                              </span>
                              {user.isMerchant && (
                                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded">
                                  {user.merchantTier || "MERCHANT"}
                                </span>
                              )}
                            </div>
                            <div className="text-gray-400 font-mono text-[11px]">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                          className="bg-[#1E202B] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white outline-none cursor-pointer"
                        >
                          <option value="USER">USER</option>
                          <option value="RM">RM (Relationship Manager)</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      </td>

                      <td className="px-4 py-4 font-mono">
                        <select
                          value={user.status}
                          onChange={(e) => handleStatusChange(user.id, e.target.value as UserStatus)}
                          className={`border rounded-lg px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer ${
                            user.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : user.status === "PENDING_VERIFICATION"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : user.status === "FLAGGED_SPAM"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold"
                              : user.status === "FROZEN"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          <option value="ACTIVE" className="bg-[#161822] text-white">ACTIVE</option>
                          <option value="PENDING_VERIFICATION" className="bg-[#161822] text-white">PENDING_VERIFICATION</option>
                          <option value="FLAGGED_SPAM" className="bg-[#161822] text-white">FLAGGED_SPAM</option>
                          <option value="FROZEN" className="bg-[#161822] text-white">FROZEN</option>
                          <option value="BANNED" className="bg-[#161822] text-white">BANNED</option>
                        </select>
                      </td>

                      <td className="px-4 py-4">
                        {user.isKycVerified ? (
                          <span className="flex items-center gap-1 text-[#00A070] font-semibold text-xs">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500 text-xs">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Unverified</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 font-mono font-bold text-white text-sm">
                        {balance.toFixed(4)} USDT
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenProfileModal(user)}
                            className="px-3 py-1.5 rounded-lg bg-[#00A070]/15 hover:bg-[#00A070]/25 text-[#00A070] border border-[#00A070]/30 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Manage Profile</span>
                          </button>
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="px-3 py-1.5 rounded-lg bg-[#222530] hover:bg-[#2A2D38] border border-white/10 text-white font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Adjust Balance
                          </button>
                          <button
                            onClick={() => {
                              setDeleteModalUser(user);
                              setDeleteConfirmText("");
                            }}
                            title="Permanently Delete User"
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Balance Adjustment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#00A070]" />
                  <span>Manual Asset Adjustment</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Target: {selectedUser.email} (UID: #{selectedUser.uid})
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustBalance} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#121212] rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setAdjustType("CREDIT")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    adjustType === "CREDIT"
                      ? "bg-[#00A070] text-white shadow-lg shadow-[#00A070]/20"
                      : "bg-[#1E202B] text-gray-400"
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Credit (Add Funds)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("DEBIT")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    adjustType === "DEBIT"
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                      : "bg-[#1E202B] text-gray-400"
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>Debit (Deduct)</span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Target Asset</label>
                <select
                  value={adjustAsset}
                  onChange={(e) => setAdjustAsset(e.target.value)}
                  className="bg-[#121212] border border-white/10 rounded-xl p-3 text-xs font-mono font-bold text-white outline-none cursor-pointer"
                >
                  <option value="USDT">USDT (Tether)</option>
                  <option value="BTC">BTC (Bitcoin)</option>
                  <option value="ETH">ETH (Ethereum)</option>
                  <option value="ACH">ACH (Alchemy Pay)</option>
                  <option value="USDC">USDC (USD Coin)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Adjustment Amount</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-sm font-mono font-bold text-white outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Reason / Reference (Mandatory for Audit Trail)</label>
                <input
                  type="text"
                  placeholder="e.g. Approved bank transfer, manual bonus, correction"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="bg-[#121212] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-xs text-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  disabled={isSubmittingAdjust}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1E202B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-[#00A070] hover:bg-[#00b880] flex items-center justify-center gap-1"
                >
                  {isSubmittingAdjust ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00A070]/20 text-[#00A070] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create New User Account</h3>
                  <p className="text-xs text-gray-400">Directly register a new member with configured role & initial balance</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="user@example.com"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={createForm.password}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Re-enter password"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1234567890"
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Account Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  >
                    <option value="USER">USER</option>
                    <option value="RM">RM (Relationship Manager)</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Initial Status</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value as UserStatus }))}
                    className="w-full bg-[#10121A] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                    <option value="FLAGGED_SPAM">FLAGGED_SPAM</option>
                    <option value="FROZEN">FROZEN</option>
                    <option value="BANNED">BANNED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#10121A] rounded-xl border border-white/5">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Initial USDT Balance</label>
                  <input
                    type="number"
                    step="any"
                    value={createForm.initialBalanceUsdt}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, initialBalanceUsdt: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#00A070]"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">Credited to Currency wallet automatically.</span>
                </div>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                    <input
                      type="checkbox"
                      checked={createForm.isEmailVerified}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, isEmailVerified: e.target.checked }))}
                      className="rounded accent-[#00A070]"
                    />
                    <span>Mark Email as Verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                    <input
                      type="checkbox"
                      checked={createForm.isKycVerified}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, isKycVerified: e.target.checked }))}
                      className="rounded accent-[#00A070]"
                    />
                    <span>Mark KYC as Verified</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2 rounded-xl bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-[#00A070]/20"
                >
                  {isCreatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE MANAGE PROFILE MODAL (A-Z CRUD) */}
      {profileModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl bg-[#161822] border border-white/10 rounded-2xl shadow-2xl flex flex-col font-sans max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#12141D] shrink-0 min-w-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#00A070]/20 text-[#00A070] flex items-center justify-center font-bold text-sm sm:text-base border border-[#00A070]/30 overflow-hidden shrink-0">
                  {profileModalUser.avatarUrl ? (
                    <img src={profileModalUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : profileModalUser.name ? (
                    profileModalUser.name.charAt(0).toUpperCase()
                  ) : (
                    profileModalUser.email.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="truncate max-w-[130px] sm:max-w-none">{profileModalUser.name || "Manage Profile"}</span>
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-[#00A070] bg-[#00A070]/10 px-1.5 sm:px-2 py-0.5 rounded border border-[#00A070]/20 shrink-0">
                      UID: #{profileModalUser.uid}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded shrink-0 ${
                      profileModalUser.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {profileModalUser.status}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-400 font-mono mt-0.5 break-all truncate">{profileModalUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setProfileModalUser(null);
                  setFullUserDetails(null);
                }}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0 ml-2"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div className="flex items-center overflow-x-auto border-b border-white/5 bg-[#10121A] px-4 shrink-0 text-xs gap-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`py-3 px-3.5 font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "profile"
                    ? "border-[#00A070] text-[#00A070] bg-[#00A070]/5"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile & Roles</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={`py-3 px-3.5 font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "security"
                    ? "border-[#00A070] text-[#00A070] bg-[#00A070]/5"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Security & Credentials</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("kyc")}
                className={`py-3 px-3.5 font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "kyc"
                    ? "border-[#00A070] text-[#00A070] bg-[#00A070]/5"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>KYC & Verification</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("wallets")}
                className={`py-3 px-3.5 font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "wallets"
                    ? "border-[#00A070] text-[#00A070] bg-[#00A070]/5"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Wallets & Accounts</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("activity")}
                className={`py-3 px-3.5 font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "activity"
                    ? "border-[#00A070] text-[#00A070] bg-[#00A070]/5"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Activity & Records</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("rm")}
                className={`py-3 px-3.5 font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "rm"
                    ? "border-[#00A070] text-[#00A070] bg-[#00A070]/5"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Relationship Manager</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("danger")}
                className={`py-3 px-3.5 font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "danger"
                    ? "border-rose-500 text-rose-400 bg-rose-500/5"
                    : "border-transparent text-rose-400/70 hover:text-rose-300"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Danger Zone</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-[#161822]">
              {isLoadingProfile ? (
                <div className="py-24 text-center text-[#00A070] flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs text-gray-400">Loading comprehensive account and financial data...</span>
                </div>
              ) : (
                <>
                  {/* TAB 1: BASIC INFO & PROFILE SETTINGS */}
                  {activeTab === "profile" && (
                    <form onSubmit={handleSaveProfileSubmit} className="space-y-4">
                      <div className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#00A070]" />
                            <span>Identity & Basic Details</span>
                          </h4>
                          <span className="text-[10px] font-mono text-gray-500">System UID: #{profileModalUser.uid}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Full Name</label>
                            <input
                              type="text"
                              value={profileForm.name}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder="Account owner name"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Email Address</label>
                            <input
                              type="email"
                              value={profileForm.email}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                              placeholder="client@ethsltd.com"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Phone Number</label>
                            <input
                              type="text"
                              value={profileForm.phone}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                              placeholder="+1 555-0199"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Avatar Image URL</label>
                            <input
                              type="text"
                              value={profileForm.avatarUrl}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                              placeholder="https://example.com/avatar.png"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-4">
                        <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-white/5 pb-2">
                          <Layers className="w-3.5 h-3.5 text-[#00A070]" />
                          <span>Roles, Permissions & Verification Status</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Account Role</label>
                            <select
                              value={profileForm.role}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            >
                              <option value="USER">USER</option>
                              <option value="RM">RM (Relationship Manager)</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Account Status</label>
                            <select
                              value={profileForm.status}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, status: e.target.value as UserStatus }))}
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                              <option value="FLAGGED_SPAM">FLAGGED_SPAM</option>
                              <option value="FROZEN">FROZEN</option>
                              <option value="BANNED">BANNED</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Merchant Tier</label>
                            <select
                              value={profileForm.merchantTier}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, merchantTier: e.target.value }))}
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            >
                              <option value="STANDARD">STANDARD</option>
                              <option value="VERIFIED">VERIFIED</option>
                              <option value="VIP">VIP</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <label className="flex items-center gap-2 p-2.5 bg-[#161822] rounded-xl border border-white/5 cursor-pointer text-gray-300">
                            <input
                              type="checkbox"
                              checked={profileForm.isEmailVerified}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, isEmailVerified: e.target.checked }))}
                              className="rounded accent-[#00A070]"
                            />
                            <span>Email Verified</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 bg-[#161822] rounded-xl border border-white/5 cursor-pointer text-gray-300">
                            <input
                              type="checkbox"
                              checked={profileForm.isKycVerified}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, isKycVerified: e.target.checked }))}
                              className="rounded accent-[#00A070]"
                            />
                            <span>KYC Verified</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 bg-[#161822] rounded-xl border border-white/5 cursor-pointer text-gray-300">
                            <input
                              type="checkbox"
                              checked={profileForm.isMerchant}
                              onChange={(e) => setProfileForm((prev) => ({ ...prev, isMerchant: e.target.checked }))}
                              className="rounded accent-[#00A070]"
                            />
                            <span>P2P Merchant Access</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          <span>Save Profile & Role Changes</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 2: SECURITY & PASSWORDS */}
                  {activeTab === "security" && (
                    <div className="space-y-5">
                      {/* Password Reset */}
                      <form onSubmit={handleResetPasswordSubmit} className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Administrative Password Reset</span>
                          </h4>
                          <span className="text-[10px] text-gray-400">Bcrypt Salt Hashing (10 rounds)</span>
                        </div>

                        <p className="text-gray-400 text-xs">
                          Securely set a new password for this user without requiring email reset tokens. The password will immediately be encrypted before saving.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">New Password</label>
                            <input
                              type="password"
                              minLength={6}
                              value={passwordForm.newPassword}
                              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                              placeholder="Minimum 6 characters"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Confirm New Password</label>
                            <input
                              type="password"
                              minLength={6}
                              value={passwordForm.confirmPassword}
                              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                              placeholder="Re-enter password"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isResettingPassword || !passwordForm.newPassword}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            {isResettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                            <span>Update User Password</span>
                          </button>
                        </div>
                      </form>

                      {/* Transaction PIN */}
                      <div className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-[#00A070]" />
                            <span>Transaction PIN Management</span>
                          </h4>
                          <span className="text-[10px] text-gray-400">Used for withdrawals & transfers</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                          <div className="space-y-2">
                            <label className="block text-gray-300 font-semibold">Set Custom 6-Digit PIN</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={customPin}
                                onChange={(e) => setCustomPin(e.target.value.replace(/\D/g, ""))}
                                placeholder="e.g. 987654"
                                className="flex-1 bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white font-mono tracking-widest focus:outline-none focus:border-[#00A070]"
                              />
                              <button
                                type="button"
                                onClick={handleSaveCustomPin}
                                disabled={isSettingPin || customPin.length !== 6}
                                className="px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-40 text-white font-bold text-xs whitespace-nowrap cursor-pointer"
                              >
                                {isSettingPin ? "Saving..." : "Save PIN"}
                              </button>
                            </div>
                          </div>

                          <div className="p-3 bg-[#161822] rounded-xl border border-white/5 flex flex-col justify-between h-full">
                            <div>
                              <div className="font-bold text-white">Default Reset</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                Instantly resets user&apos;s transaction PIN to default: <span className="font-mono text-[#00A070] font-bold">123456</span>
                              </div>
                            </div>
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={handleResetPinDefault}
                                disabled={isResettingPin}
                                className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold cursor-pointer whitespace-nowrap"
                              >
                                {isResettingPin ? "Resetting..." : "Reset to 123456"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: KYC & VERIFICATION */}
                  {activeTab === "kyc" && (
                    <form onSubmit={handleSaveKycSubmit} className="space-y-4">
                      <div className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-[#00A070]" />
                            <span>KYC Application & Government Identity</span>
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            kycForm.status === "APPROVED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : kycForm.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {kycForm.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Document Type</label>
                            <select
                              value={kycForm.documentType}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, documentType: e.target.value }))}
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            >
                              <option value="GOVERNMENT_ID">National ID / Aadhaar</option>
                              <option value="PASSPORT">Passport</option>
                              <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                              <option value="RESIDENCE_PERMIT">Residence Permit</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">ID Number *</label>
                            <input
                              type="text"
                              value={kycForm.idNumber}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, idNumber: e.target.value }))}
                              placeholder="e.g. AB12345678"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#00A070]"
                            />
                          </div>

                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Verification Status</label>
                            <select
                              value={kycForm.status}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, status: e.target.value }))}
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-[#00A070]"
                            >
                              <option value="APPROVED">APPROVED (Verified)</option>
                              <option value="PENDING">PENDING (In Review)</option>
                              <option value="REJECTED">REJECTED</option>
                              <option value="ADDITIONAL_INFO_REQUIRED">ADDITIONAL_INFO_REQUIRED</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Full Legal Name</label>
                            <input
                              type="text"
                              value={kycForm.fullName}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, fullName: e.target.value }))}
                              placeholder="As shown on ID"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>

                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Date of Birth</label>
                            <input
                              type="text"
                              value={kycForm.dateOfBirth}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                              placeholder="YYYY-MM-DD"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>

                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Gender</label>
                            <select
                              value={kycForm.gender}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, gender: e.target.value }))}
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            >
                              <option value="MALE">MALE</option>
                              <option value="FEMALE">FEMALE</option>
                              <option value="OTHER">OTHER</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Nationality</label>
                            <input
                              type="text"
                              value={kycForm.nationality}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, nationality: e.target.value }))}
                              placeholder="e.g. Indian, American"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>

                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">Country</label>
                            <input
                              type="text"
                              value={kycForm.country}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, country: e.target.value }))}
                              placeholder="e.g. India"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>

                          <div>
                            <label className="block text-gray-300 font-semibold mb-1">City / State</label>
                            <input
                              type="text"
                              value={kycForm.city}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, city: e.target.value }))}
                              placeholder="e.g. Mumbai, Maharashtra"
                              className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-300 font-semibold mb-1">Full Residential Address</label>
                          <textarea
                            rows={2}
                            value={kycForm.address}
                            onChange={(e) => setKycForm((prev) => ({ ...prev, address: e.target.value }))}
                            placeholder="Street address, building, postal code"
                            className="w-full bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00A070]"
                          />
                        </div>

                        {kycForm.status === "REJECTED" && (
                          <div>
                            <label className="block text-rose-400 font-semibold mb-1">Rejection Reason</label>
                            <input
                              type="text"
                              value={kycForm.rejectionReason}
                              onChange={(e) => setKycForm((prev) => ({ ...prev, rejectionReason: e.target.value }))}
                              placeholder="Reason for rejecting user's KYC documents"
                              className="w-full bg-[#161822] border border-rose-500/30 rounded-xl px-3 py-2 text-rose-300 focus:outline-none focus:border-rose-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* Document Attachments / Previews */}
                      <div className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-3">
                        <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-white/5 pb-2">
                          <ExternalLink className="w-3.5 h-3.5 text-[#00A070]" />
                          <span>Submitted Verification Documents</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-[#161822] rounded-xl border border-white/5 space-y-2">
                            <div className="font-bold text-gray-300">Front Document</div>
                            {fullUserDetails?.kyc?.idFrontUrl ? (
                              <div className="space-y-2">
                                <div className="h-32 bg-black/40 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
                                  <img
                                    src={fullUserDetails.kyc.idFrontUrl}
                                    alt="Front Document"
                                    className="max-h-full max-w-full object-contain"
                                    onError={(e) => {
                                      // Fallback on broken image
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                </div>
                                <a
                                  href={fullUserDetails.kyc.idFrontUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-[#00A070] hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Open Original Front Document</span>
                                </a>
                              </div>
                            ) : (
                              <div className="h-24 rounded-lg bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center text-gray-500 text-[11px]">
                                No front image on record
                              </div>
                            )}
                          </div>

                          <div className="p-3 bg-[#161822] rounded-xl border border-white/5 space-y-2">
                            <div className="font-bold text-gray-300">Back Document</div>
                            {fullUserDetails?.kyc?.idBackUrl ? (
                              <div className="space-y-2">
                                <div className="h-32 bg-black/40 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
                                  <img
                                    src={fullUserDetails.kyc.idBackUrl}
                                    alt="Back Document"
                                    className="max-h-full max-w-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                </div>
                                <a
                                  href={fullUserDetails.kyc.idBackUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-[#00A070] hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Open Original Back Document</span>
                                </a>
                              </div>
                            ) : (
                              <div className="h-24 rounded-lg bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center text-gray-500 text-[11px]">
                                No back image on record
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={isSavingKyc}
                          className="px-5 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          {isSavingKyc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                          <span>Update KYC Application & Status</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 4: WALLETS & PAYMENT ACCOUNTS */}
                  {activeTab === "wallets" && (
                    <div className="space-y-5">
                      {/* Wallets by Type */}
                      <div className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-[#00A070]" />
                            <span>System Wallet Balances</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => setSelectedUser(profileModalUser)}
                            className="text-[#00A070] hover:underline text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Adjust Balance</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {["USDT", "BTC", "ETH", "ACH", "USDC"].map((asset) => {
                            const curWallet = fullUserDetails?.wallets?.find((w) => w.asset === asset && w.type === "Currency");
                            const conWallet = fullUserDetails?.wallets?.find((w) => w.asset === asset && w.type === "Contract");
                            const p2pWallet = fullUserDetails?.wallets?.find((w) => w.asset === asset && w.type === "P2P");

                            return (
                              <div key={asset} className="p-3 bg-[#161822] border border-white/5 rounded-xl space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                                  <span className="font-bold text-white">{asset}</span>
                                  <span>Currency</span>
                                </div>
                                <div className="text-sm font-bold text-white font-mono">
                                  {(curWallet ? curWallet.balance : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                </div>
                                {conWallet && conWallet.balance > 0 && (
                                  <div className="text-[10px] text-gray-500 font-mono">
                                    Contract: {conWallet.balance.toFixed(2)}
                                  </div>
                                )}
                                {p2pWallet && p2pWallet.balance > 0 && (
                                  <div className="text-[10px] text-gray-500 font-mono">
                                    P2P: {p2pWallet.balance.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Linked Bank Cards */}
                      <div className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                            <span>Linked Bank Accounts ({fullUserDetails?.bankCards?.length || 0})</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => setShowAddBankForm(!showAddBankForm)}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>{showAddBankForm ? "Cancel" : "Add Bank Account"}</span>
                          </button>
                        </div>

                        {showAddBankForm && (
                          <form onSubmit={handleAddBankSubmit} className="p-3 bg-[#161822] rounded-xl border border-blue-500/30 space-y-3">
                            <div className="font-bold text-white text-xs">Add User Bank Card</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <input
                                type="text"
                                required
                                placeholder="Bank Name (e.g. State Bank of India)"
                                value={bankForm.bankName}
                                onChange={(e) => setBankForm((p) => ({ ...p, bankName: e.target.value }))}
                                className="bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                              <input
                                type="text"
                                required
                                placeholder="Account Holder Name"
                                value={bankForm.accountHolder}
                                onChange={(e) => setBankForm((p) => ({ ...p, accountHolder: e.target.value }))}
                                className="bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                              <input
                                type="text"
                                required
                                placeholder="Account Number"
                                value={bankForm.accountNumber}
                                onChange={(e) => setBankForm((p) => ({ ...p, accountNumber: e.target.value }))}
                                className="bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                              />
                              <input
                                type="text"
                                placeholder="IFSC / Branch Code"
                                value={bankForm.ifscCode}
                                onChange={(e) => setBankForm((p) => ({ ...p, ifscCode: e.target.value }))}
                                className="bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                              />
                              <input
                                type="text"
                                placeholder="Branch Name / Address"
                                value={bankForm.branchName}
                                onChange={(e) => setBankForm((p) => ({ ...p, branchName: e.target.value }))}
                                className="bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                              <input
                                type="text"
                                placeholder="Country (e.g. India)"
                                value={bankForm.country}
                                onChange={(e) => setBankForm((p) => ({ ...p, country: e.target.value }))}
                                className="bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowAddBankForm(false)}
                                className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isAddingBank}
                                className="px-4 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                              >
                                {isAddingBank ? "Adding..." : "Save Bank Card"}
                              </button>
                            </div>
                          </form>
                        )}

                        {fullUserDetails?.bankCards && fullUserDetails.bankCards.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {fullUserDetails.bankCards.map((card) => (
                              <div key={card.id} className="p-3 bg-[#161822] rounded-xl border border-white/5 space-y-1.5 relative">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-white text-xs">{card.bankName}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBankCard(card.id)}
                                    disabled={isDeletingBankId === card.id}
                                    className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                                  >
                                    {isDeletingBankId === card.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                                <div className="text-[11px] text-gray-300 font-mono">
                                  Acc: {card.accountNumber || "N/A"}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  Holder: {card.accountHolder || card.fullName || "N/A"} • IFSC: {card.ifscCode || "N/A"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-[#161822] rounded-xl border border-white/5 text-gray-400 text-xs">
                            No bank accounts currently linked.
                          </div>
                        )}
                      </div>

                      {/* Linked Crypto Wallets */}
                      <div className="bg-[#10121A] border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Linked Crypto Addresses ({fullUserDetails?.cryptoWallets?.length || 0})</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => setShowAddCryptoForm(!showAddCryptoForm)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>{showAddCryptoForm ? "Cancel" : "Add Crypto Address"}</span>
                          </button>
                        </div>

                        {showAddCryptoForm && (
                          <form onSubmit={handleAddCryptoSubmit} className="p-3 bg-[#161822] rounded-xl border border-emerald-500/30 space-y-3">
                            <div className="font-bold text-white text-xs">Add User Crypto Address</div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div>
                                <label className="block text-gray-400 text-[10px] mb-1">Asset</label>
                                <select
                                  value={cryptoForm.asset}
                                  onChange={(e) => setCryptoForm((p) => ({ ...p, asset: e.target.value }))}
                                  className="w-full bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                >
                                  <option value="USDT">USDT</option>
                                  <option value="BTC">BTC</option>
                                  <option value="ETH">ETH</option>
                                  <option value="ACH">ACH</option>
                                  <option value="USDC">USDC</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-gray-400 text-[10px] mb-1">Network</label>
                                <select
                                  value={cryptoForm.network}
                                  onChange={(e) => setCryptoForm((p) => ({ ...p, network: e.target.value }))}
                                  className="w-full bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                >
                                  <option value="TRC20">TRC20 (Tron)</option>
                                  <option value="ERC20">ERC20 (Ethereum)</option>
                                  <option value="BEP20">BEP20 (BNB Smart Chain)</option>
                                  <option value="BTC">Bitcoin</option>
                                  <option value="SOL">Solana</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-gray-400 text-[10px] mb-1">Wallet Label</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Personal Cold Wallet"
                                  value={cryptoForm.label}
                                  onChange={(e) => setCryptoForm((p) => ({ ...p, label: e.target.value }))}
                                  className="w-full bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-gray-400 text-[10px] mb-1">Wallet Address *</label>
                              <input
                                type="text"
                                required
                                placeholder="T... or 0x..."
                                value={cryptoForm.address}
                                onChange={(e) => setCryptoForm((p) => ({ ...p, address: e.target.value }))}
                                className="w-full bg-[#10121A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowAddCryptoForm(false)}
                                className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isAddingCrypto}
                                className="px-4 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                              >
                                {isAddingCrypto ? "Adding..." : "Save Crypto Address"}
                              </button>
                            </div>
                          </form>
                        )}

                        {fullUserDetails?.cryptoWallets && fullUserDetails.cryptoWallets.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {fullUserDetails.cryptoWallets.map((wallet) => (
                              <div key={wallet.id} className="p-3 bg-[#161822] rounded-xl border border-white/5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white text-xs">{wallet.asset}</span>
                                    <span className="text-[10px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-gray-400">
                                      {wallet.network}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCryptoWallet(wallet.id)}
                                    disabled={isDeletingCryptoId === wallet.id}
                                    className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                                  >
                                    {isDeletingCryptoId === wallet.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                                <div className="text-[11px] text-gray-300 font-mono break-all">
                                  {wallet.address}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  Label: {wallet.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-[#161822] rounded-xl border border-white/5 text-gray-400 text-xs">
                            No crypto wallet addresses currently linked.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: ACTIVITY & RECORDS */}
                  {activeTab === "activity" && (
                    <div className="space-y-4">
                      {/* Sub-tabs */}
                      <div className="flex items-center gap-1 border-b border-white/5 pb-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setActivitySubTab("orders")}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                            activitySubTab === "orders" ? "bg-[#00A070] text-white" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Trading Orders ({fullUserDetails?.orders?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivitySubTab("transactions")}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                            activitySubTab === "transactions" ? "bg-[#00A070] text-white" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Transactions ({fullUserDetails?.transactions?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivitySubTab("deposits")}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                            activitySubTab === "deposits" ? "bg-[#00A070] text-white" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Deposits ({fullUserDetails?.deposits?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivitySubTab("withdrawals")}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                            activitySubTab === "withdrawals" ? "bg-[#00A070] text-white" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Withdrawals ({fullUserDetails?.withdrawals?.length || 0})
                        </button>
                      </div>

                      {/* Orders */}
                      {activitySubTab === "orders" && (
                        <div className="space-y-2">
                          {fullUserDetails?.orders && fullUserDetails.orders.length > 0 ? (
                            fullUserDetails.orders.map((ord) => (
                              <div key={ord.id} className="p-3 bg-[#10121A] rounded-xl border border-white/5 flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-bold text-white flex items-center gap-2">
                                    <span>{ord.symbol}</span>
                                    <span className="text-[10px] font-mono text-gray-400">{ord.category}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                      ord.type.includes("Buy") || ord.type.includes("Rise") ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
                                    }`}>
                                      {ord.type}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    {new Date(ord.createdAt).toLocaleString()}
                                  </div>
                                </div>
                                <div className="text-right font-mono">
                                  <div className="font-bold text-white">{ord.amount}</div>
                                  <div className="text-[10px] text-gray-400">@ {ord.price} • {ord.status}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-8 text-center text-gray-500">No trading orders found.</div>
                          )}
                        </div>
                      )}

                      {/* Transactions */}
                      {activitySubTab === "transactions" && (
                        <div className="space-y-2">
                          {fullUserDetails?.transactions && fullUserDetails.transactions.length > 0 ? (
                            fullUserDetails.transactions.map((tx) => (
                              <div key={tx.id} className="p-3 bg-[#10121A] rounded-xl border border-white/5 flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-bold text-white">{tx.type}</div>
                                  <div className="text-[10px] text-gray-400">{tx.description || "N/A"}</div>
                                  <div className="text-[10px] text-gray-500">{new Date(tx.createdAt).toLocaleString()}</div>
                                </div>
                                <div className="text-right font-mono">
                                  <div className="font-bold text-white">{tx.amount} {tx.asset}</div>
                                  <span className="text-[10px] text-[#00A070] font-semibold">{tx.status}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-8 text-center text-gray-500">No transactions recorded.</div>
                          )}
                        </div>
                      )}

                      {/* Deposits */}
                      {activitySubTab === "deposits" && (
                        <div className="space-y-2">
                          {fullUserDetails?.deposits && fullUserDetails.deposits.length > 0 ? (
                            fullUserDetails.deposits.map((dep) => (
                              <div key={dep.id} className="p-3 bg-[#10121A] rounded-xl border border-white/5 flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-bold text-white">{dep.method} Deposit</div>
                                  <div className="text-[10px] text-gray-400 font-mono">Ref: {dep.referenceNumber}</div>
                                  <div className="text-[10px] text-gray-500">{new Date(dep.createdAt).toLocaleString()}</div>
                                </div>
                                <div className="text-right font-mono">
                                  <div className="font-bold text-white">+{dep.amount} {dep.asset}</div>
                                  <span className="text-[10px] text-amber-400 font-semibold">{dep.status}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-8 text-center text-gray-500">No deposit requests recorded.</div>
                          )}
                        </div>
                      )}

                      {/* Withdrawals */}
                      {activitySubTab === "withdrawals" && (
                        <div className="space-y-2">
                          {fullUserDetails?.withdrawals && fullUserDetails.withdrawals.length > 0 ? (
                            fullUserDetails.withdrawals.map((wth) => (
                              <div key={wth.id} className="p-3 bg-[#10121A] rounded-xl border border-white/5 flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-bold text-white">{wth.method} Payout</div>
                                  <div className="text-[10px] text-gray-500">{new Date(wth.createdAt).toLocaleString()}</div>
                                </div>
                                <div className="text-right font-mono">
                                  <div className="font-bold text-rose-400">-{wth.amount} {wth.asset}</div>
                                  <span className="text-[10px] text-gray-400 font-semibold">{wth.status}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-8 text-center text-gray-500">No withdrawal requests recorded.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 6: RELATIONSHIP MANAGER */}
                  {activeTab === "rm" && (
                    <div className="space-y-4">
                      {/* Active Connection */}
                      <div className="space-y-3 p-4 bg-[#10121A] rounded-xl border border-white/5">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-[#00A070]" />
                            <span>Assigned Relationship Manager</span>
                          </h4>
                        </div>

                        {fullUserDetails?.rmClientConnections?.some((c) => c.status === "ACTIVE" || c.status === "ACCEPTED" || c.status === "REQUESTED") ? (
                          (() => {
                            const conn = fullUserDetails.rmClientConnections?.find((c) => c.status === "ACTIVE" || c.status === "ACCEPTED" || c.status === "REQUESTED");
                            if (!conn) return null;
                            return (
                              <div className="flex items-center justify-between p-3 bg-[#161822] border border-[#00A070]/30 rounded-xl">
                                <div>
                                  <div className="font-bold text-white flex items-center gap-2">
                                    <span>{conn.rm?.name || conn.rm?.email}</span>
                                    <span className="text-[10px] text-[#00A070] font-mono font-bold bg-[#00A070]/10 px-2 py-0.5 rounded">
                                      {conn.rm?.rmProfile?.rmCode}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-400 mt-0.5">
                                    Status: <span className="text-[#00A070] font-semibold">{conn.status}</span> • Connected: {new Date(conn.requestedAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleRemoveRm}
                                  disabled={isRemovingRm}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold cursor-pointer"
                                >
                                  {isRemovingRm ? "Removing..." : "Remove RM"}
                                </button>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="p-3 bg-[#161822] border border-white/5 rounded-xl text-gray-400 text-xs">
                            No Relationship Manager is currently assigned to this user.
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <select
                            value={selectedRmId}
                            onChange={(e) => setSelectedRmId(e.target.value)}
                            className="flex-1 bg-[#161822] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A070]"
                          >
                            <option value="">-- Select Active Relationship Manager --</option>
                            {availableRms.map((rm) => (
                              <option key={rm.id} value={rm.id}>
                                {rm.name} ({rm.rmCode}) • {rm.activeClientsCount} Clients
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleAssignRm}
                            disabled={isAssigningRm || !selectedRmId}
                            className="px-4 py-2 rounded-xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-[#00A070]/20 cursor-pointer whitespace-nowrap"
                          >
                            {isAssigningRm ? "Assigning..." : "Assign Manager"}
                          </button>
                        </div>
                      </div>

                      {/* Reviews given by user */}
                      {fullUserDetails?.rmReviewsGiven && fullUserDetails.rmReviewsGiven.length > 0 && (
                        <div className="space-y-3 p-4 bg-[#10121A] rounded-xl border border-white/5">
                          <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-white/5 pb-2">
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            <span>RM Reviews Given ({fullUserDetails.rmReviewsGiven.length})</span>
                          </h4>

                          <div className="space-y-2">
                            {fullUserDetails.rmReviewsGiven.map((rev) => (
                              <div key={rev.id} className="p-3 bg-[#161822] border border-white/5 rounded-xl space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-white">Manager: {rev.rm?.name}</span>
                                  <div className="flex items-center gap-1 text-amber-400 font-bold">
                                    <Star className="w-3 h-3 fill-amber-400" />
                                    <span>{rev.rating}.0 / 5</span>
                                  </div>
                                </div>
                                {rev.comment && <p className="text-gray-300 italic">&ldquo;{rev.comment}&rdquo;</p>}
                                <div className="text-[10px] text-gray-500 text-right">
                                  {new Date(rev.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 7: DANGER ZONE */}
                  {activeTab === "danger" && (
                    <div className="space-y-4 p-4 bg-rose-500/5 rounded-xl border border-rose-500/20">
                      <div className="flex items-center gap-2 border-b border-rose-500/20 pb-2">
                        <AlertOctagon className="w-4 h-4 text-rose-400" />
                        <h4 className="font-bold text-rose-400 uppercase tracking-wider text-[11px]">
                          Danger Zone: Permanent Account Deletion
                        </h4>
                      </div>

                      <div className="p-3 bg-[#161822] rounded-xl border border-rose-500/10 space-y-2 text-xs">
                        <p className="font-bold text-white">
                          Irreversible Administrative Purge
                        </p>
                        <p className="text-gray-300">
                          This will completely delete <span className="text-rose-400 font-mono font-bold">{profileModalUser.email}</span> (UID: #{profileModalUser.uid}) and cascade-purge all linked records:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-gray-400 text-[11px]">
                          <li>User profile, sessions, auth tokens, and linked credentials</li>
                          <li>All currency, contract, options, and P2P wallet balances</li>
                          <li>Perpetual and option orders, transaction logs, and deposit records</li>
                          <li>P2P market ads, buy/sell orders, messages, payment methods & disputes</li>
                          <li>KYC verification records and document proofs in Cloudflare storage</li>
                        </ul>

                        <div className="pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteModalUser(profileModalUser);
                              setDeleteConfirmText("");
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/20 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Permanently Delete User Account</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-white/10 bg-[#12141D] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setProfileModalUser(null);
                  setFullUserDetails(null);
                }}
                className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Deletion Confirmation Modal */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#161822] border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-white font-sans space-y-4">
            <div className="flex items-center gap-3 text-rose-400 pb-3 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanent User Deletion</h3>
                <p className="text-xs text-rose-400/90 font-mono">IRREVERSIBLE SYSTEM ACTION</p>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 text-xs text-rose-300 space-y-2">
              <p className="font-bold text-white">
                Target User: <span className="font-mono text-rose-400">{deleteModalUser.email}</span> (UID: #{deleteModalUser.uid})
              </p>
              <p className="text-[11px] text-gray-300">
                This operation permanently destroys all associated data across the entire platform:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-200 font-sans">
                <li>Authentication sessions, credentials, and user profile</li>
                <li>All wallet balances (USDT, BTC, ETH, ACH), locked & escrow funds</li>
                <li>Perpetual & Option trading orders and financial transactions</li>
                <li>P2P advertisements, orders, messages, payment methods, and feedback</li>
                <li>Relationship Manager connections, contracts, and conversation history</li>
                <li>KYC verification records and documents in Cloudflare D1 storage</li>
              </ul>
            </div>

            {deleteModalUser.email === "admin@ethsltd.com" || deleteModalUser.uid === 100001 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>This is the primary protected system Super Admin account and cannot be deleted.</span>
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-300 block mb-1.5">
                  To confirm permanent deletion, type <span className="font-mono text-rose-400 font-bold">DELETE</span> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-[#1E202B] border border-white/10 focus:border-rose-500 px-3.5 py-2.5 rounded-xl text-xs text-white outline-none font-mono"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalUser(null);
                  setDeleteConfirmText("");
                }}
                disabled={isDeletingUser}
                className="px-4 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {!(deleteModalUser.email === "admin@ethsltd.com" || deleteModalUser.uid === 100001) && (
                <button
                  type="button"
                  onClick={handlePermanentDelete}
                  disabled={deleteConfirmText.trim() !== "DELETE" || isDeletingUser}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
                >
                  {isDeletingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Permanently Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 text-white" />
                      <span>Permanently Delete User</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
