"use client";

import { Lock, X, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  returnUrl?: string;
}

export function LoginPromptModal({
  isOpen,
  onClose,
  title = "Please Log In to Trade",
  description = "You must be logged in to your ETHS LTD account to place trades, manage orders, and access real-time wallet balances.",
  returnUrl = "/trade",
}: LoginPromptModalProps) {
  if (!isOpen) return null;

  const loginHref = `/login?redirect=${encodeURIComponent(returnUrl)}`;
  const registerHref = `/register?redirect=${encodeURIComponent(returnUrl)}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm rounded-2xl bg-[#161822] border border-white/10 p-6 shadow-2xl text-center select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00A070]/15 border border-[#00A070]/30 text-[#00A070]">
          <Lock className="w-7 h-7" />
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-xs text-gray-400 mb-6 leading-relaxed">
          {description}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <Link
            href={loginHref}
            className="w-full py-3 px-4 rounded-xl bg-[#00A070] hover:bg-[#00B07C] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
          >
            <LogIn className="w-4 h-4" />
            <span>Log In to Continue</span>
          </Link>

          <Link
            href={registerHref}
            className="w-full py-3 px-4 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-gray-200 font-semibold text-sm flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New Account</span>
          </Link>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors mt-1 cursor-pointer"
          >
            Continue Browsing Market
          </button>
        </div>
      </div>
    </div>
  );
}
