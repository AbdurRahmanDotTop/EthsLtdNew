"use client";

import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  Loader2, 
  CreditCard, 
  PlusCircle, 
  Building2, 
  Star, 
  Trash2, 
  Edit3, 
  X, 
  ShieldCheck 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  getUserBankAccounts, 
  saveBankAccount, 
  setPrimaryBankAccount, 
  deleteBankAccount 
} from "@/actions/user";
import { toast } from "sonner";

export default function BankCardManagementPage() {
  const router = useRouter();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<any | null>(null);
  const [form, setForm] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    branchName: "",
    country: "India",
    isPrimary: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const data = await getUserBankAccounts();
      setBankAccounts(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load bank cards");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleOpenAdd = () => {
    setEditingCard(null);
    setForm({
      bankName: "",
      accountHolder: "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifscCode: "",
      branchName: "",
      country: "India",
      isPrimary: bankAccounts.length === 0,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (card: any) => {
    setEditingCard(card);
    setForm({
      bankName: card.bankName || "",
      accountHolder: card.accountHolder || card.fullName || "",
      accountNumber: card.accountNumber || card.iban || "",
      confirmAccountNumber: card.accountNumber || card.iban || "",
      ifscCode: card.ifscCode || card.swiftCode || "",
      branchName: card.branchName || "",
      country: card.country || "India",
      isPrimary: card.isPrimary || false,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bankName.trim() || !form.accountHolder.trim() || !form.accountNumber.trim()) {
      toast.error("Please fill in bank name, account holder, and account number.");
      return;
    }

    if (!editingCard && form.accountNumber.trim() !== form.confirmAccountNumber.trim()) {
      toast.error("Account numbers do not match. Please verify.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveBankAccount({
        id: editingCard ? editingCard.id : undefined,
        bankName: form.bankName.trim(),
        accountHolder: form.accountHolder.trim(),
        accountNumber: form.accountNumber.trim(),
        confirmAccountNumber: form.confirmAccountNumber.trim(),
        ifscCode: form.ifscCode.trim(),
        branchName: form.branchName.trim(),
        country: form.country.trim(),
        isPrimary: form.isPrimary,
      });

      if (res.success) {
        toast.success(editingCard ? "Bank card updated successfully!" : "Bank card bound successfully!");
        setShowModal(false);
        setEditingCard(null);
        loadAccounts();
      } else {
        toast.error(res.error || "Failed to save bank card.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      const res = await setPrimaryBankAccount(id);
      if (res.success) {
        toast.success("Primary bank account updated.");
        loadAccounts();
      } else {
        toast.error(res.error || "Failed to update default account.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await deleteBankAccount(deletingId);
      if (res.success) {
        toast.success("Bank card removed.");
        setDeletingId(null);
        loadAccounts();
      } else {
        toast.error(res.error || "Failed to delete bank card.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const maskAcc = (num?: string) => {
    if (!num) return "••••••••";
    if (num.length <= 4) return num;
    return `•••• •••• ${num.slice(-4)}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white pb-24 font-sans select-none">
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121212] sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/assets" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <span className="font-bold text-lg">Bank Account Management</span>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="text-xs font-bold text-[#00A070] hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Card</span>
        </button>
      </header>

      <div className="p-4 max-w-lg mx-auto w-full flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-20 text-[#00A070]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="bg-[#1A1C24] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">No Bank Cards Bound</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Bind your verified bank account to enable seamless INR/fiat currency withdrawals.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-3 px-6 py-3 bg-[#00A070] hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Bind Bank Card Now
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bankAccounts.map((card) => (
              <div
                key={card.id}
                className="bg-[#1A1C24] border border-white/5 hover:border-white/20 p-5 rounded-2xl flex flex-col gap-3 transition-all shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00A070] to-emerald-600 flex items-center justify-center text-white shadow-md">
                      <CreditCard className="w-5 h-5" />
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
                        onClick={() => handleSetPrimary(card.id)}
                        title="Set as Default Account"
                        className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(card)}
                      title="Edit Card"
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(card.id)}
                      title="Delete Card"
                      className="p-2 text-gray-400 hover:text-rose-400 hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex justify-between items-center text-xs text-gray-400">
                  <span>Account Holder: <strong className="text-white">{card.accountHolder || card.fullName}</strong></span>
                  {card.ifscCode && (
                    <span className="font-mono">IFSC: <strong className="text-gray-300">{card.ifscCode}</strong></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Security Info */}
        <div className="bg-[#1A1C24] p-4 rounded-xl border border-white/5 text-xs text-gray-400 flex items-start gap-2.5 leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-[#00A070] shrink-0 mt-0.5" />
          <span>
            Account numbers are stored securely with end-to-end encryption. Primary account is initially chosen during withdrawals, but you can select any linked card at time of payout.
          </span>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in overflow-y-auto py-10">
          <div className="w-full max-w-md bg-[#161822] border border-white/10 rounded-3xl p-6 shadow-2xl text-white font-sans my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#00A070]" />
                {editingCard ? "Edit Bank Account" : "Add Bank Account"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Bank Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Axis Bank, HDFC, Chase"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
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
                  placeholder="Beneficiary name on bank account"
                  value={form.accountHolder}
                  onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
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
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                  required
                />
              </div>

              {!editingCard && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Confirm Account Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Re-enter account number"
                    value={form.confirmAccountNumber}
                    onChange={(e) => setForm({ ...form, confirmAccountNumber: e.target.value })}
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
                    value={form.ifscCode}
                    onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
                    className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Connaught Place"
                    value={form.branchName}
                    onChange={(e) => setForm({ ...form, branchName: e.target.value })}
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
                  placeholder="e.g. India"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full bg-[#10121A] border border-white/10 focus:border-[#00A070] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="primaryCardCheck"
                  checked={form.isPrimary}
                  onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                  className="w-4 h-4 rounded text-[#00A070] focus:ring-0 bg-[#10121A] border-white/20"
                />
                <label htmlFor="primaryCardCheck" className="text-xs text-gray-300 cursor-pointer">
                  Set as default / primary account
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-[#00A070] hover:bg-emerald-500 flex items-center justify-center gap-1.5 shadow-lg shadow-[#00A070]/20"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Bank Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161822] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Delete Bank Account?</h3>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Are you sure you want to remove this bank account? Historical withdrawals will not be altered.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
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
