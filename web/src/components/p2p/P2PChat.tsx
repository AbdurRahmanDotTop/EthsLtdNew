"use client";

import { useState, useRef, useEffect } from "react";
import { getP2pMessages, sendP2pMessage } from "@/actions/p2p";
import { Send, ShieldAlert, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface P2PChatProps {
  order: any;
  currentUserId?: string;
}

export function P2PChat({ order, currentUserId }: P2PChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSending, setIsSending] = useState(false);

  const isChatActive = !["COMPLETED", "CANCELLED", "EXPIRED"].includes(order.status);
  const effectiveUserId = currentUserId || order.currentUserId;

  const loadMessages = async () => {
    try {
      const res = await getP2pMessages(order.id);
      if (res.success && res.data) {
        setMessages(res.data);
      }
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => {
      if (!document.hidden && isChatActive) {
        loadMessages();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [order.id, isChatActive]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !isChatActive || isSending) return;

    const messageText = inputValue.trim().slice(0, 1000);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      orderId: order.id,
      senderId: effectiveUserId || "ME",
      senderRole: order.role || "USER",
      message: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendP2pMessage(order.id, messageText);
      if (!res.success) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (res.error?.includes("Unauthorized") || res.error?.includes("Log in")) {
          window.location.href = `/login?redirect=${encodeURIComponent(`/p2p/order/${order.id}`)}`;
        }
      } else {
        loadMessages();
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const isBuyer = order.role === "BUYER" || (effectiveUserId && order.buyerId === effectiveUserId);

  return (
    <div className="flex flex-col h-full bg-[#161822] border border-white/10 rounded-2xl shadow-xl overflow-hidden relative">
      {/* Header */}
      <div className="shrink-0 p-3 sm:p-4 border-b border-white/10 bg-[#121212]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
            Secure Trade Chat
            <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-[#00A070]/20 text-[#00A070] font-semibold whitespace-nowrap">
              {isBuyer ? "Buyer View" : "Seller View"}
            </span>
          </h3>
          <span className="text-[11px] text-gray-400 font-mono">
            #{order.orderNumber || order.id?.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 self-start sm:self-auto shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Escrow Channel
        </div>
      </div>

      {/* Message Window: flex-1 min-h-0 allows messages to scroll while keeping input pinned */}
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 overscroll-contain"
      >
        {/* Warning Banner */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 p-2.5 sm:p-3 rounded-xl flex items-start gap-2.5 text-[11px] sm:text-xs leading-relaxed shrink-0">
          <ShieldAlert className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p>
            Never release crypto before verifying funds directly inside your bank account. Do NOT trust SMS or emails alone. ETHSLTD staff will never ask you to release funds.
          </p>
        </div>

        {messages.map((msg) => {
          if (msg.senderRole === "SYSTEM" || msg.senderId === "SYSTEM") {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] text-gray-300 text-center max-w-[90%] leading-relaxed">
                  {msg.message}
                </div>
              </div>
            );
          }

          const isMe =
            (effectiveUserId && msg.senderId === effectiveUserId) ||
            msg.senderId === "ME" ||
            (!effectiveUserId && isBuyer && msg.senderRole === "BUYER") ||
            (!effectiveUserId && !isBuyer && msg.senderRole === "SELLER");

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                  isMe
                    ? "bg-[#00A070] text-white rounded-br-xs"
                    : "bg-[#121212] border border-white/10 text-gray-200 rounded-bl-xs"
                }`}
              >
                <div className={`text-[10px] font-semibold mb-1 ${isMe ? "text-white/80" : "text-[#00A070]"}`}>
                  {isMe ? "You" : (msg.sender?.name || (isBuyer ? "Seller" : "Buyer"))}
                </div>
                <p className="break-words [overflow-wrap:anywhere] text-xs sm:text-sm whitespace-pre-wrap">
                  {msg.message}
                </p>
                <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${isMe ? "text-white/70" : "text-gray-500"}`}>
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {isMe && <CheckCheck className="w-3 h-3" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Input Area */}
      <div className="shrink-0 p-2.5 sm:p-3 border-t border-white/10 bg-[#121212]/95 backdrop-blur-md">
        {!isChatActive ? (
          <div className="py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs text-center flex items-center justify-center gap-2">
            <CheckCheck className="w-4 h-4 text-gray-500" />
            <span>Chat closed for {order.status?.toLowerCase().replace(/_/g, " ")} order</span>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              disabled={!isChatActive || isSending}
              maxLength={1000}
              className="flex-1 max-h-28 min-h-[40px] py-2.5 px-3.5 bg-[#161822] text-xs sm:text-sm text-white placeholder-gray-500 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00A070] resize-none leading-relaxed transition-all"
            />
            <Button
              type="submit"
              disabled={!isChatActive || !inputValue.trim() || isSending}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl bg-[#00A070] hover:bg-[#00B07C] text-white shadow-md cursor-pointer transition-transform active:scale-95"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

