"use client";

import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  Loader2, 
  CreditCard, 
  PlusCircle, 
  AlertCircle, 
  ShieldAlert, 
  CheckCircle2, 
  Wallet, 
  Building2, 
  Star, 
  Trash2, 
  Edit3, 
  X, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  Info,
  QrCode
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserTradingInfo } from "@/actions/trade";
import { 
  checkWithdrawalEligibility,
  submitWithdrawal, 
  getUserProfile,
  getUserBankAccounts,
  saveBankAccount,
  setPrimaryBankAccount,
  deleteBankAccount,
  getUserCryptoWallets,
  saveCryptoWallet,
  setPrimaryCryptoWallet,
  deleteCryptoWallet
} from "@/actions/user";
import { validateCryptoAddress } from "@/lib/crypto-validation";
import { toast } from "sonner";

export default function WithdrawPage() {
  const router = useRouter();

  // General state
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<string>("");
  const [fundPassword, setFundPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // KYC Verification state
  const [isKycEligible, setIsKycEligible] = useState<boolean | null>(null);
  const [kycStatus, setKycStatus] = useState<string>("NOT_SUBMITTED");
  const [kycRejectionReason, setKycRejectionReason] = useState<string | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);

  // Active Category: Bank vs Crypto
  const [activeMethod, setActiveMethod] = useState<"BANK" | "CRYPTO">("BANK");

  // Bank Accounts state
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  // Crypto Wallets state
  const [cryptoWallets, setCryptoWallets] = useState<any[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");

  // Add/Edit Bank Modal State
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<any | null>(null);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    branchName: "",
    country: "India",
    isPrimary: false,
  });
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Add/Edit Crypto Modal State
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [editingCrypto, setEditingCrypto] = useState<any | null>(null);
  const [cryptoForm, setCryptoForm] = useState({
    asset: "USDT",
    network: "TRC20",
    address: "",
    label: "",
    memo: "",
    isPrimary: false,
  });
  const [isSavingCrypto, setIsSavingCrypto] = useState(false);

  // Delete Confirmation Modal
  const [deletingItem, setDeletingItem] = useState<{ type: "BANK" | "CRYPTO"; id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initial Load & KYC Verification Check
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [kycCheck, tradeInfo, banks, wallets] = await Promise.all([
        checkWithdrawalEligibility(),
        getUserTradingInfo(),
        getUserBankAccounts(),
        getUserCryptoWallets(),
      ]);

      // KYC validation
      setIsKycEligible(kycCheck.eligible);
      setKycStatus(kycCheck.kycStatus || "NOT_SUBMITTED");
      setKycRejectionReason(kycCheck.rejectionReason || null);

      if (!kycCheck.eligible) {
        setShowKycModal(true);
      }

      // Balance
      if (tradeInfo.success) {
        setBalance(tradeInfo.balance);
      }

      // Bank Accounts
      setBankAccounts(banks);
      if (banks.length > 0) {
        const primary = banks.find((b: any) => b.isPrimary) || banks[0];
        setSelectedBankId(primary.id);
      }

      // Crypto Wallets
      setCryptoWallets(wallets);
      if (wallets.length > 0) {
        const primary = wallets.find((w: any) => w.isPrimary) || wallets[0];
        setSelectedWalletId(primary.id);
      }
    } catch (err) {
      console.error("Error loading withdrawal data:", err);
      toast.error("Failed to load user account details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const numAmount = parseFloat(amount) || 0;
  const handlingFee = 0.0;
  const receiveAmount = Math.max(0, numAmount - handlingFee);

  // Selected Bank & Wallet references
  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0] || null;
  const selectedWallet = cryptoWallets.find((w) => w.id === selectedWalletId) || cryptoWallets[0] || null;

  // Handle Bank Account Save
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.bankName.trim() || !bankForm.accountHolder.trim() || !bankForm.accountNumber.trim()) {
      toast.error("Please fill in all mandatory bank fields.");
      return;
    }

    if (!editingBank && bankForm.accountNumber.trim() !== bankForm.confirmAccountNumber.trim()) {
      toast.error("Account numbers do not match. Please verify.");
      return;
    }

    setIsSavingBank(true);
    try {
      const res = await saveBankAccount({
        id: editingBank ? editingBank.id : undefined,
        bankName: bankForm.bankName.trim(),
        accountHolder: bankForm.accountHolder.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        confirmAccountNumber: bankForm.confirmAccountNumber.trim(),
        ifscCode: bankForm.ifscCode.trim(),
        branchName: bankForm.branchName.trim(),
        country: bankForm.country.trim(),
        isPrimary: bankForm.isPrimary,
      });

      if (res.success) {
        toast.success(editingBank ? "Bank account updated successfully!" : "Bank account added successfully!");
        setShowBankModal(false);
        setEditingBank(null);
        // Reload bank accounts
        const updated = await getUserBankAccounts();
        setBankAccounts(updated);
        if (res.data) {
          setSelectedBankId(res.data.id);
        }
      } else {
        toast.error(res.error || "Failed to save bank account.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSavingBank(false);
    }
  };

  // Handle Crypto Wallet Save
  const handleSaveCrypto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cryptoForm.address.trim() || !cryptoForm.network.trim()) {
      toast.error("Please provide both blockchain network and wallet address.");
      return;
    }

    const validation = validateCryptoAddress(cryptoForm.asset, cryptoForm.network, cryptoForm.address);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid wallet address.");
      return;
    }

    setIsSavingCrypto(true);
    try {
      const res = await saveCryptoWallet({
        id: editingCrypto ? editingCrypto.id : undefined,
        asset: cryptoForm.asset,
        network: cryptoForm.network,
        address: cryptoForm.address.trim(),
        label: cryptoForm.label.trim() || `${cryptoForm.asset}-${cryptoForm.network} Wallet`,
        memo: cryptoForm.memo.trim(),
        isPrimary: cryptoForm.isPrimary,
      });

      if (res.success) {
        toast.success(editingCrypto ? "Crypto wallet updated successfully!" : "Crypto wallet saved successfully!");
        setShowCryptoModal(false);
        setEditingCrypto(null);
        // Reload crypto wallets
        const updated = await getUserCryptoWallets();
        setCryptoWallets(updated);
        if (res.data) {
          setSelectedWalletId(res.data.id);
        }
      } else {
        toast.error(res.error || "Failed to save crypto wallet.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSavingCrypto(false);
    }
  };

  // Set Primary Bank Account
  const handleSetPrimaryBank = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await setPrimaryBankAccount(id);
      if (res.success) {
        toast.success("Default bank account updated.");
        const updated = await getUserBankAccounts();
        setBankAccounts(updated);
        setSelectedBankId(id);
      } else {
        toast.error(res.error || "Failed to set primary account.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Set Primary Crypto Wallet
  const handleSetPrimaryCrypto = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await setPrimaryCryptoWallet(id);
      if (res.success) {
        toast.success("Default crypto wallet updated.");
        const updated = await getUserCryptoWallets();
        setCryptoWallets(updated);
        setSelectedWalletId(id);
      } else {
        toast.error(res.error || "Failed to set primary wallet.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      if (deletingItem.type === "BANK") {
        const res = await deleteBankAccount(deletingItem.id);
        if (res.success) {
          toast.success("Bank account removed.");
          const updated = await getUserBankAccounts();
          setBankAccounts(updated);
          if (updated.length > 0) {
            setSelectedBankId(updated[0].id);
          } else {
            setSelectedBankId("");
          }
        } else {
          toast.error(res.error || "Failed to delete account.");
        }
      } else {
        const res = await deleteCryptoWallet(deletingItem.id);
        if (res.success) {
          toast.success("Crypto wallet removed.");
          const updated = await getUserCryptoWallets();
          setCryptoWallets(updated);
          if (updated.length > 0) {
            setSelectedWalletId(updated[0].id);
          } else {
            setSelectedWalletId("");
          }
        } else {
          toast.error(res.error || "Failed to delete wallet.");
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
      setDeletingItem(null);
    }
  };

  // Open Edit Bank Form
  const openEditBank = (bank: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBank(bank);
    setBankForm({
      bankName: bank.bankName || "",
      accountHolder: bank.accountHolder || bank.fullName || "",
      accountNumber: bank.accountNumber || bank.iban || "",
      confirmAccountNumber: bank.accountNumber || bank.iban || "",
      ifscCode: bank.ifscCode || bank.swiftCode || "",
      branchName: bank.branchName || "",
      country: bank.country || "India",
      isPrimary: bank.isPrimary || false,
    });
    setShowBankModal(true);
  };

  // Open Edit Crypto Form
  const openEditCrypto = (wallet: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCrypto(wallet);
    setCryptoForm({
      asset: wallet.asset || "USDT",
      network: wallet.network || "TRC20",
      address: wallet.address || "",
      label: wallet.label || "",
      memo: wallet.memo || "",
      isPrimary: wallet.isPrimary || false,
    });
    setShowCryptoModal(true);
  };

  // Submit Withdrawal Handler
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Double check KYC
    if (!isKycEligible) {
      setShowKycModal(true);
      return;
    }

    // 2. Validate selected destination
    if (activeMethod === "BANK" && !selectedBank) {
      toast.error("Please add or select a bank account before submitting.");
      return;
    }

    if (activeMethod === "CRYPTO" && !selectedWallet) {
      toast.error("Please add or select a crypto wallet before submitting.");
      return;
    }

    // 3. Amount validation
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid withdrawal amount.");
      return;
    }

    if (numAmount < 10) {
      toast.error("Minimum withdrawal amount is 10.00 USDT.");
      return;
    }

    if (numAmount > balance) {
      toast.error(`Insufficient balance. Available: ${balance.toFixed(4)} USDT`);
      return;
    }

    // 4. Fund password
    if (!fundPassword) {
      toast.error("Please enter your 6-digit transaction PIN / Fund Password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitWithdrawal({
        amount: numAmount,
        fundPassword,
        method: activeMethod,
        methodId: activeMethod === "BANK" ? selectedBank?.id : selectedWallet?.id,
      });

      if (res.success) {
        toast.success("Withdrawal application submitted successfully!");
        router.push("/assets/records?tab=withdraw");
      } else {
        if (res.kycStatus && res.kycStatus !== "APPROVED") {
          setIsKycEligible(false);
          setKycStatus(res.kycStatus);
          setKycRejectionReason(res.rejectionReason || null);
          setShowKycModal(true);
        } else {
          toast.error(res.error || "Failed to submit withdrawal application.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to mask account number
  const maskAcc = (num?: string) => {
    if (!num) return "••••••••";
    if (num.length <= 4) return num;
    return `•••• •••• ${num.slice(-4)}`;
  };

  // Helper to shorten wallet address
  const shortAddr = (addr?: string) => {
    if (!addr) return "••••";
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      {/* Sticky Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <span className="font-bold text-lg">Withdraw Assets</span>
        </div>
        <Link 
          href="/assets/records?tab=withdraw" 
          className="text-xs text-[#00A070] font-semibold hover:underline"
        >
          Withdrawal Records
        </Link>
      </header>

      <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
            <span className="text-xs text-gray-400 font-mono">Verifying withdrawal credentials...</span>
          </div>
        ) : (
          <>
            {/* KYC Status Banner if Not Verified */}
            {!isKycEligible && (
              <div 
                onClick={() => setShowKycModal(true)}
                className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-amber-500/15 transition-all shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">
                      {kycStatus === "PENDING"
                        ? "KYC Verification Pending Review"
                        : kycStatus === "REJECTED"
                        ? "KYC Application Declined"
                        : "KYC Verification Required"}
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {kycStatus === "REJECTED"
                        ? "Action required: Review rejection details and re-submit."
                        : "Complete document verification to unlock withdrawals."}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </div>
            )}

            {/* Withdrawal Category Selector (Bank vs Crypto) */}
            <div className="grid grid-cols-2 gap-2 bg-[#1A1C24] p-1.5 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setActiveMethod("BANK")}
                className={`py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  activeMethod === "BANK"
                    ? "bg-[#00A070] text-white shadow-lg shadow-[#00A070]/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Withdraw via Bank</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMethod("CRYPTO")}
                className={`py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  activeMethod === "CRYPTO"
                    ? "bg-[#00A070] text-white shadow-lg shadow-[#00A070]/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Withdraw via Crypto</span>
              </button>
            </div>

            {/* ================= BANK METHOD VIEW ================= */}
            {activeMethod === "BANK" && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                    Bank Accounts ({bankAccounts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBank(null);
                      setBankForm({
                        bankName: "",
                        accountHolder: "",
                        accountNumber: "",
                        confirmAccountNumber: "",
                        ifscCode: "",
                        branchName: "",
                        country: "India",
                        isPrimary: bankAccounts.length === 0,
                      });
                      setShowBankModal(true);
                    }}
                    className="text-xs font-bold text-[#00A070] hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Bank Account</span>
                  </button>
                </div>

                {bankAccounts.length === 0 ? (
                  <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">No Bank Accounts Linked</h4>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">
                        Link your personal bank account to receive direct fiat currency transfers.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBankModal(true)}
                      className="mt-2 px-5 py-2.5 bg-[#00A070] hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Add Bank Account Now
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {bankAccounts.map((card) => {
                      const isSelected = selectedBankId === card.id;
                      return (
                        <div
                          key={card.id}
                          onClick={() => setSelectedBankId(card.id)}
                          className={`relative p-4 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-gradient-to-r from-[#00A070]/20 via-[#1A1C24] to-[#1A1C24] border-[#00A070] shadow-lg shadow-[#00A070]/10"
                              : "bg-[#1A1C24] border-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                isSelected ? "bg-[#00A070] text-white" : "bg-white/5 text-gray-400"
                              }`}>
                                <CreditCard className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-white">{card.bankName}</span>
                                  {card.isPrimary && (
                                    <span className="text-[10px] bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                                      <Star className="w-2.5 h-2.5 fill-current" />
                                      PRIMARY
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 font-mono">
                                  {maskAcc(card.accountNumber || card.iban)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {!card.isPrimary && (
                                <button
                                  type="button"
                                  onClick={(e) => handleSetPrimaryBank(card.id, e)}
                                  title="Set as Default Account"
                                  className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => openEditBank(card, e)}
                                title="Edit Account"
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingItem({ type: "BANK", id: card.id, title: card.bankName });
                                }}
                                title="Delete Account"
                                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-between items-center text-[11px] text-gray-400">
                            <span>Holder: <strong className="text-gray-300 font-medium">{card.accountHolder || card.fullName}</strong></span>
                            {card.ifscCode && (
                              <span className="font-mono text-gray-400">IFSC: {card.ifscCode}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================= CRYPTO METHOD VIEW ================= */}
            {activeMethod === "CRYPTO" && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                    Crypto Wallets ({cryptoWallets.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCrypto(null);
                      setCryptoForm({
                        asset: "USDT",
                        network: "TRC20",
                        address: "",
                        label: "",
                        memo: "",
                        isPrimary: cryptoWallets.length === 0,
                      });
                      setShowCryptoModal(true);
                    }}
                    className="text-xs font-bold text-[#00A070] hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Crypto Wallet</span>
                  </button>
                </div>

                {cryptoWallets.length === 0 ? (
                  <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">No Crypto Wallets Saved</h4>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">
                        Add an on-chain cryptocurrency address (e.g. TRC20, ERC20, BEP20) for instant payouts.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCryptoModal(true)}
                      className="mt-2 px-5 py-2.5 bg-[#00A070] hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Add Crypto Wallet Now
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {cryptoWallets.map((wallet) => {
                      const isSelected = selectedWalletId === wallet.id;
                      return (
                        <div
                          key={wallet.id}
                          onClick={() => setSelectedWalletId(wallet.id)}
                          className={`relative p-4 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-gradient-to-r from-[#00A070]/20 via-[#1A1C24] to-[#1A1C24] border-[#00A070] shadow-lg shadow-[#00A070]/10"
                              : "bg-[#1A1C24] border-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                                isSelected ? "bg-[#00A070] text-white" : "bg-white/5 text-gray-400"
                              }`}>
                                {wallet.network.slice(0, 3)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-white">{wallet.label || `${wallet.asset} Wallet`}</span>
                                  <span className="text-[10px] bg-white/10 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded">
                                    {wallet.network}
                                  </span>
                                  {wallet.isPrimary && (
                                    <span className="text-[10px] bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                                      <Star className="w-2.5 h-2.5 fill-current" />
                                      PRIMARY
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 font-mono">
                                  {shortAddr(wallet.address)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {!wallet.isPrimary && (
                                <button
                                  type="button"
                                  onClick={(e) => handleSetPrimaryCrypto(wallet.id, e)}
                                  title="Set as Default Wallet"
                                  className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => openEditCrypto(wallet, e)}
                                title="Edit Wallet"
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingItem({ type: "CRYPTO", id: wallet.id, title: wallet.label || wallet.network });
                                }}
                                title="Delete Wallet"
                                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {wallet.memo && (
                            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-gray-400 font-mono">
                              Memo / Tag: <span className="text-gray-200">{wallet.memo}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Withdrawal Form */}
            <form onSubmit={handleWithdraw} className="flex flex-col gap-4 mt-1">
              <div className="bg-[#1A1C24] p-5 rounded-2xl border border-white/5 space-y-4 shadow-xl">
                <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
                  <span>Withdrawal Amount</span>
                  <span>Available: <strong className="text-white">{balance.toFixed(4)} USDT</strong></span>
                </div>

                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-2xl sm:text-3xl font-bold font-mono outline-none w-2/3 text-white placeholder:text-gray-600"
                    required
                  />
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-sm text-gray-300 font-semibold">USDT</span>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={() => setAmount(balance.toString())}
                      className="text-[#00A070] font-bold text-sm hover:underline"
                    >
                      ALL
                    </button>
                  </div>
                </div>

                {/* Fund Password / PIN */}
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-xs text-gray-400">Transaction PIN / Fund Password</span>
                  <input
                    type="password"
                    placeholder="Enter 6-digit PIN"
                    value={fundPassword}
                    onChange={(e) => setFundPassword(e.target.value)}
                    className="bg-transparent text-right outline-none text-sm w-1/2 text-white font-mono placeholder:text-gray-600 tracking-wider"
                    required
                  />
                </div>

                {/* Fee & Receivable Calculation */}
                <div className="flex flex-col gap-2 pt-1 text-xs font-mono">
                  <div className="flex justify-between text-gray-400">
                    <span>Handling Fee</span>
                    <span>{handlingFee.toFixed(6)} USDT</span>
                  </div>
                  <div className="flex justify-between text-gray-200 font-bold text-sm">
                    <span>Net Receivable ({activeMethod === "CRYPTO" ? (selectedWallet?.asset || "USDT") : "USDT"})</span>
                    <span className="text-[#00A070] font-mono">{receiveAmount.toFixed(4)}</span>
                  </div>
                </div>

                {/* Selected Method Summary Snapshot preview */}
                <div className="bg-[#12141C] p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#00A070]" />
                    <span>Payout Destination:</span>
                  </span>
                  <span className="font-medium text-gray-200">
                    {activeMethod === "BANK"
                      ? selectedBank ? `${selectedBank.bankName} (${maskAcc(selectedBank.accountNumber || selectedBank.iban)})` : "None Selected"
                      : selectedWallet ? `${selectedWallet.network}: ${shortAddr(selectedWallet.address)}` : "None Selected"}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || (activeMethod === "BANK" ? !selectedBank : !selectedWallet)}
                className="w-full py-4 bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold rounded-xl text-base shadow-lg shadow-[#00A070]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : !isKycEligible ? (
                  "KYC Verification Required"
                ) : activeMethod === "BANK" && !selectedBank ? (
                  "Link Bank Account First"
                ) : activeMethod === "CRYPTO" && !selectedWallet ? (
                  "Add Crypto Wallet First"
                ) : (
                  "Submit Withdrawal Request"
                )}
              </button>
            </form>

            {/* Notes Section */}
            <div className="text-xs text-gray-500 flex flex-col gap-2.5 leading-relaxed bg-[#1A1C24] p-4 rounded-xl border border-white/5">
              <h4 className="text-gray-400 font-bold mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#00A070]" />
                Security & Withdrawal Guidelines:
              </h4>
              <p>1. <strong>Mandatory Verification:</strong> In compliance with international AML regulations, all withdrawals require an approved KYC identity status.</p>
              <p>2. <strong>Daily Quota:</strong> Maximum 3 withdrawal applications permitted per calendar day. Minimum withdrawal is 10.00 USDT.</p>
              <p>3. <strong>Immutable Request Snapshot:</strong> The exact beneficiary details selected at the time of submission are frozen with your request and will not be impacted by future edits to your address book.</p>
              <p>4. <strong>Processing Time:</strong> Administrative review and blockchain disbursement typically complete within 1-12 hours.</p>
            </div>
          </>
        )}
      </div>

      {/* ================= KYC REQUIRED MODAL ================= */}
      {showKycModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-amber-500/40 rounded-3xl p-6 shadow-2xl text-white font-sans flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 shadow-xl shadow-amber-500/10">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              KYC Verification Required
            </h3>

            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              You must complete your KYC verification before withdrawing funds.
            </p>

            {/* Detailed KYC Status details */}
            <div className="w-full bg-[#10121A] border border-white/10 rounded-2xl p-4 text-left mb-6 space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Status:</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  kycStatus === "PENDING"
                    ? "bg-amber-500/20 text-amber-400"
                    : kycStatus === "REJECTED"
                    ? "bg-rose-500/20 text-rose-400"
                    : "bg-gray-500/20 text-gray-400"
                }`}>
                  {kycStatus === "PENDING"
                    ? "UNDER REVIEW"
                    : kycStatus === "REJECTED"
                    ? "DECLINED"
                    : "NOT SUBMITTED"}
                </span>
              </div>

              {kycStatus === "REJECTED" && kycRejectionReason && (
                <div className="pt-2 border-t border-white/10">
                  <span className="text-rose-400 font-semibold block text-[11px]">Rejection Reason:</span>
                  <p className="text-gray-300 font-sans text-xs mt-0.5">{kycRejectionReason}</p>
                  <p className="text-amber-400 font-sans text-[11px] mt-1.5">
                    Corrective Action: Please upload fresh, clear identification documents with matching account holder credentials.
                  </p>
                </div>
              )}

              {kycStatus === "PENDING" && (
                <div className="pt-2 border-t border-white/10 text-gray-400 font-sans text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Your submission is currently queued for administrative verification. Please check back shortly.</span>
                </div>
              )}
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowKycModal(false);
                  router.push("/profile/kyc");
                }}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 flex items-center justify-center gap-2 shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
              >
                <span>OK — Proceed to KYC Verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowKycModal(false)}
                className="py-2 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT BANK ACCOUNT MODAL ================= */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in overflow-y-auto py-10">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-3xl p-6 shadow-2xl text-white font-sans my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#00A070]" />
                {editingBank ? "Edit Bank Account" : "Add Bank Account"}
              </h3>
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Bank Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Axis Bank, HDFC, Chase, HSBC"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Account Holder Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Official name matching bank records"
                  value={bankForm.accountHolder}
                  onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Account Number / IBAN <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter full account number"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                  required
                />
              </div>

              {!editingBank && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Confirm Account Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Re-enter account number to verify"
                    value={bankForm.confirmAccountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, confirmAccountNumber: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    IFSC / SWIFT Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AXIS000123"
                    value={bankForm.ifscCode}
                    onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Branch / City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai Main"
                    value={bankForm.branchName}
                    onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  placeholder="e.g. India, United States, UAE"
                  value={bankForm.country}
                  onChange={(e) => setBankForm({ ...bankForm, country: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="primaryBankCheck"
                  checked={bankForm.isPrimary}
                  onChange={(e) => setBankForm({ ...bankForm, isPrimary: e.target.checked })}
                  className="w-4 h-4 rounded text-[#00A070] focus:ring-0 bg-[#10121A] border-white/20"
                />
                <label htmlFor="primaryBankCheck" className="text-xs text-gray-300 cursor-pointer">
                  Set as default / primary withdrawal account
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  disabled={isSavingBank}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-[#00A070] hover:bg-emerald-500 flex items-center justify-center gap-1.5 shadow-lg shadow-[#00A070]/20"
                >
                  {isSavingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Bank Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT CRYPTO WALLET MODAL ================= */}
      {showCryptoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in overflow-y-auto py-10">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-3xl p-6 shadow-2xl text-white font-sans my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#00A070]" />
                {editingCrypto ? "Edit Crypto Wallet" : "Add Crypto Wallet"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCryptoModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCrypto} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Cryptocurrency <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={cryptoForm.asset}
                    onChange={(e) => setCryptoForm({ ...cryptoForm, asset: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                  >
                    <option value="USDT">USDT</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Network / Chain <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={cryptoForm.network}
                    onChange={(e) => setCryptoForm({ ...cryptoForm, network: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3 py-2.5 text-xs text-white outline-none font-mono"
                  >
                    <option value="TRC20">TRC20 (Tron)</option>
                    <option value="ERC20">ERC20 (Ethereum)</option>
                    <option value="BEP20">BEP20 (BNB Smart Chain)</option>
                    <option value="POLYGON">Polygon (MATIC)</option>
                    <option value="BITCOIN">Bitcoin (BTC)</option>
                    <option value="SOLANA">Solana (SOL)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Wallet Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Paste on-chain destination address"
                  value={cryptoForm.address}
                  onChange={(e) => setCryptoForm({ ...cryptoForm, address: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                  required
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  TRC20 starts with &apos;T&apos;; ERC20/BEP20 starts with &apos;0x&apos;.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Wallet Label / Tag Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Binance Account, Ledger Cold Wallet"
                  value={cryptoForm.label}
                  onChange={(e) => setCryptoForm({ ...cryptoForm, label: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Memo / Destination Tag (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty if not required by exchange"
                  value={cryptoForm.memo}
                  onChange={(e) => setCryptoForm({ ...cryptoForm, memo: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="primaryCryptoCheck"
                  checked={cryptoForm.isPrimary}
                  onChange={(e) => setCryptoForm({ ...cryptoForm, isPrimary: e.target.checked })}
                  className="w-4 h-4 rounded text-[#00A070] focus:ring-0 bg-[#10121A] border-white/20"
                />
                <label htmlFor="primaryCryptoCheck" className="text-xs text-gray-300 cursor-pointer">
                  Set as default / primary crypto wallet
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCryptoModal(false)}
                  disabled={isSavingCrypto}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCrypto}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-[#00A070] hover:bg-emerald-500 flex items-center justify-center gap-1.5 shadow-lg shadow-[#00A070]/20"
                >
                  {isSavingCrypto ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Crypto Wallet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION DIALOG ================= */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Remove {deletingItem.type === "BANK" ? "Bank Account" : "Crypto Wallet"}?
            </h3>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Are you sure you want to remove &quot;{deletingItem.title}&quot; from your saved withdrawal destinations? Previous historical withdrawals will not be affected.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
