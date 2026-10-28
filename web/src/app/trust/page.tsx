import { Shield, Lock, FileCheck } from "lucide-react";

export default function TrustPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white p-4 sm:p-6 pb-24 max-w-2xl mx-auto w-full">
      <header className="mb-6 sm:mb-8 mt-2 sm:mt-4 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-[#00A070]">Trust & Security</h1>
        <p className="text-gray-400 mt-2 text-xs sm:text-sm">Your assets are protected with industry-leading security.</p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="bg-[#1A1C24] p-4 sm:p-6 rounded-xl flex items-start gap-3.5 sm:gap-4 border border-white/5">
          <div className="bg-[#00A070]/20 p-2.5 sm:p-3 rounded-full text-[#00A070] shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">Cold Storage</h3>
            <p className="text-sm text-gray-400">98% of digital assets are stored securely offline in air-gapped cold storage.</p>
          </div>
        </div>

        <div className="bg-[#1A1C24] p-6 rounded-xl flex items-start gap-4 border border-white/5">
          <div className="bg-[#00A070]/20 p-3 rounded-full text-[#00A070]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">Advanced Encryption</h3>
            <p className="text-sm text-gray-400">All personal and financial data is encrypted using military-grade standards.</p>
          </div>
        </div>

        <div className="bg-[#1A1C24] p-6 rounded-xl flex items-start gap-4 border border-white/5">
          <div className="bg-[#00A070]/20 p-3 rounded-full text-[#00A070]">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">Regulatory Compliance</h3>
            <p className="text-sm text-gray-400">We adhere strictly to global AML and KYC compliance requirements.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
