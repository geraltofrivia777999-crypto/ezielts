"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Send,
  Sparkles,
  ChevronLeft,
  Bot,
  User,
  Lock,
  Loader2,
  BookOpen,
  Mic2,
  PenLine,
  Headphones,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTutorMessages } from "@/lib/supabase/queries";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
interface Message {
  id: string;
  role: Role;
  content: string;
  loading?: boolean;
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: BookOpen, text: "Как улучшить Reading score с 5.5 до 7.0?" },
  { icon: PenLine, text: "Объясни Task Achievement для Writing Task 2" },
  { icon: Headphones, text: "Советы для Listening Section 4" },
  { icon: Mic2, text: "Как звучать fluently в Speaking Part 2?" },
];

// ─── Free limit (mock — real check is server-side) ────────────────────────────
const FREE_LIMIT = 3;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Привет! Я твой AI-тьютор по IELTS 👋\n\nМогу помочь с любым модулем: Reading, Writing, Listening или Speaking. Задай вопрос или выбери тему ниже.\n\n*У тебя 3 бесплатных вопроса. Pro — неограниченно.*",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usedCount, setUsedCount] = useState(0);
  const [paywalled, setPaywalled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load history from Supabase on mount
  useEffect(() => {
    async function loadHistory() {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;

      const history = await getTutorMessages(sb, user.id, 50);
      if (history.length === 0) return;

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const loaded: Message[] = (history as any[]).map((m) => ({
        id: m.id as string,
        role: m.role as Role,
        content: m.content as string,
      }));

      // Replace welcome with full history (keep welcome as first)
      setMessages((prev) => [prev[0], ...loaded]);
      // Count user messages for free limit
      setUsedCount(loaded.filter((m) => m.role === "user").length);
    }
    loadHistory();
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    if (usedCount >= FREE_LIMIT) {
      setPaywalled(true);
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const loadingMsg: Message = { id: "loading", role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setMessages((prev) => prev.filter((m) => m.id !== "loading"));
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: data.message },
        ]);
        setPaywalled(true);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error("API error");

      // Stream response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value, { stream: true });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === "loading"
                ? { ...m, content: assistantText, loading: false }
                : m
            )
          );
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === "loading"
            ? { id: Date.now().toString(), role: "assistant", content: assistantText, loading: false }
            : m
        )
      );
      setUsedCount((c) => c + 1);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== "loading"));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Произошла ошибка. Попробуйте ещё раз.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const remainingFree = Math.max(0, FREE_LIMIT - usedCount);

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))] px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[rgb(var(--primary))] to-[rgb(var(--secondary))] flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[rgb(var(--foreground))]">AI Тьютор</span>
            <Badge variant="secondary" className="text-xs">IELTS Expert</Badge>
          </div>
          <p className="text-xs text-[rgb(var(--muted-foreground))]">
            Отвечает на русском и английском
          </p>
        </div>

        {/* Free counter */}
        {!paywalled && (
          <div className="text-right shrink-0">
            <div className="text-xs font-medium text-[rgb(var(--foreground))]">
              {remainingFree}/{FREE_LIMIT}
            </div>
            <div className="text-xs text-[rgb(var(--muted-foreground))]">бесплатно</div>
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                msg.role === "user"
                  ? "bg-[rgb(var(--primary))]"
                  : "bg-gradient-to-br from-[rgb(var(--primary))] to-[rgb(var(--secondary))]"
              )}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-[rgb(var(--primary))] text-white rounded-tr-sm"
                  : "bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--foreground))] rounded-tl-sm"
              )}
            >
              {msg.loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[rgb(var(--primary))]" />
                  <span className="text-[rgb(var(--muted-foreground))]">Думаю...</span>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {/* Paywall in messages */}
        {paywalled && (
          <div className="rounded-2xl border border-[rgb(var(--primary)/0.3)] bg-gradient-to-br from-[rgb(var(--primary)/0.05)] to-[rgb(var(--secondary)/0.05)] p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-[rgb(var(--primary)/0.1)] flex items-center justify-center mx-auto mb-3">
              <Lock className="w-5 h-5 text-[rgb(var(--primary))]" />
            </div>
            <p className="font-semibold text-[rgb(var(--foreground))] mb-1">
              Бесплатные вопросы закончились
            </p>
            <p className="text-sm text-[rgb(var(--muted-foreground))] mb-4">
              Обновитесь до Pro — неограниченные вопросы к AI-тьютору + Writing/Speaking анализ
            </p>
            <Link href="/pricing">
              <Button size="sm" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Открыть Pro — от $4/мес
              </Button>
            </Link>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions (show when only welcome message) */}
      {messages.length === 1 && !paywalled && (
        <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
          <p className="text-xs text-[rgb(var(--muted-foreground))] mb-2 font-medium">
            Быстрые вопросы
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map(({ icon: Icon, text }) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="flex items-center gap-2 text-left text-sm bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2.5 hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.03)] transition-colors"
              >
                <Icon className="w-4 h-4 text-[rgb(var(--primary))] shrink-0" />
                <span className="text-[rgb(var(--foreground))] leading-snug">{text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 bg-[rgb(var(--background))] border-t border-[rgb(var(--border))] px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 max-w-2xl mx-auto"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              paywalled
                ? "Обновитесь до Pro для продолжения..."
                : "Задай вопрос по IELTS..."
            }
            disabled={paywalled || loading}
            className="flex-1 rounded-xl"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || loading || paywalled}
            className="rounded-xl shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        {!paywalled && (
          <p className="text-center text-xs text-[rgb(var(--muted-foreground))] mt-2">
            AI может ошибаться. Проверяй важные факты по официальным материалам IELTS.
          </p>
        )}
      </div>
    </div>
  );
}
