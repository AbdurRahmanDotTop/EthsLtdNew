"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  FileText,
  Lock,
  User,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { getRmConversation, sendRmMessage } from "@/actions/rm";
import { toast } from "sonner";

export default function RmPrivateChatPage({ params }: { params: Promise<{ connectionId: string }> }) {
  const resolvedParams = use(params);
  const connectionId = resolvedParams.connectionId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lockedReason, setLockedReason] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChat = async (isBackground = false) => {
    try {
      const res = await getRmConversation(connectionId);
      if (res.success) {
        setData(res);
        setMessages(res.messages || []);
        setLockedReason(null);
      } else {
        if (res.requiresActiveContract) {
          setLockedReason(res.error || "Contract must be signed by both parties.");
        } else if (!isBackground) {
          toast.error(res.error || "Chat unavailable");
        }
      }
    } catch (e: any) {
      if (!isBackground) toast.error(e.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchChat();

    // 4-second visibility-aware polling interval for real-time messages
    pollIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        fetchChat(true);
      }
    }, 4000);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchChat(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [connectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !data?.conversationId || isSending) return;

    const text = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      const res = await sendRmMessage({
        conversationId: data.conversationId,
        text,
      });

      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message]);
        scrollToBottom();
      } else {
        toast.error(res.error || "Failed to send message.");
        setInputText(text); // restore on failure
      }
    } catch (e: any) {
      toast.error(e.message);
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#00A070]/20 border-t-[#00A070] rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Connecting to secure private channel...</span>
      </div>
    );
  }

  // Access Gate: If contract is not fully signed
  if (lockedReason) {
    return (
      <div className="min-h-screen py-16 px-4 max-w-md mx-auto text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-xl">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Private Chat Locked</h2>
          <p className="text-xs text-gray-300 leading-relaxed">{lockedReason}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#161822] border border-white/5 text-xs text-gray-400 text-left space-y-2">
          <div className="font-semibold text-gray-200">Compliance & Security Rule:</div>
          <p className="text-[11px] text-gray-400">
            Private communications between clients and Relationship Managers are strictly guarded. Full execution of the ETH Investment Contract with signatures from both parties is required before messages can be exchanged.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/relationship-managers"
            className="w-full py-2.5 rounded-xl bg-[#00A070] hover:bg-[#008f64] text-white text-xs font-bold shadow-lg shadow-[#00A070]/20 transition-all text-center"
          >
            Review & Sign Contract
          </Link>
          <button
            onClick={() => router.back()}
            className="w-full py-2.5 rounded-xl bg-[#161822] hover:bg-[#1E202B] text-gray-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const other = data?.otherParty;
  const currentUserId = data?.currentUserId;

  return (
    <div className="min-h-[calc(100vh-120px)] max-w-4xl mx-auto flex flex-col bg-[#161822] rounded-3xl border border-white/10 shadow-2xl overflow-hidden my-4">
      {/* Chat Header */}
      <div className="px-5 py-4 bg-[#14151E] border-b border-white/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Other Party Avatar & Title */}
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-[#1E202B] border border-white/10 overflow-hidden flex items-center justify-center font-bold text-white text-sm">
              {other?.avatarUrl ? (
                <img src={other.avatarUrl} alt={other.name} className="w-full h-full object-cover" />
              ) : (
                other?.name?.charAt(0) || "U"
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00A070] border-2 border-[#14151E]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs">
                {other?.name}
              </h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00A070]/15 text-[#00A070] border border-[#00A070]/30 font-mono">
                {other?.rmCode || other?.role}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <span>{other?.designation}</span>
              <span className="text-gray-600">•</span>
              <span className="text-[#00A070] font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Contract Active
              </span>
            </div>
          </div>
        </div>

        {/* Header Right: Contract Link */}
        {data?.contractId && (
          <Link
            href={`/contracts/${data.contractId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E202B] hover:bg-[#252836] border border-white/10 text-gray-300 hover:text-white text-xs font-semibold transition-all shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-[#00A070]" />
            <span className="hidden sm:inline">Contract #{data.contractNumber}</span>
            <span className="sm:hidden">Contract</span>
          </Link>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[calc(100vh-280px)] min-h-[350px]">
        {/* Security / Encryption Notice */}
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-[11px] text-gray-400">
            <Lock className="w-3 h-3 text-[#00A070]" />
            <span>End-to-End Cryptographically Bound Advisory Channel</span>
          </div>
        </div>

        {/* Message List */}
        {messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-xs space-y-2">
            <MessageSquare className="w-10 h-10 mx-auto text-gray-600" />
            <p>No messages yet. Send a message to start your advisory session.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"} space-y-1 animate-in fade-in duration-100`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words shadow-md ${
                    isMine
                      ? "bg-gradient-to-br from-[#00A070] to-[#008f64] text-white rounded-br-sm"
                      : "bg-[#1E202B] text-gray-200 border border-white/5 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>

                <div className="flex items-center gap-1.5 px-1 text-[10px] text-gray-500">
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isMine && (
                    <span>
                      {msg.isRead ? (
                        <CheckCheck className="w-3.5 h-3.5 text-cyan-400 inline" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-gray-500 inline" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-[#14151E] border-t border-white/5 flex items-end gap-2">
        <textarea
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a confidential advisory message... (Enter to send, Shift+Enter for newline)"
          className="flex-1 bg-[#1A1C28] border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00A070] transition-colors resize-none max-h-32"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="w-11 h-11 rounded-2xl bg-[#00A070] hover:bg-[#008f64] disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
