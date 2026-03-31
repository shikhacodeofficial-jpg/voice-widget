"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";

type Status =
  | "idle"
  | "connecting"
  | "connected"
  | "speaking"
  | "disconnecting"
  | "error";

const AGENT_KEYWORD_MAP: Record<string, string> = {
  "super agent": "emp1",
  "ai super agent": "emp1",
  chatbox: "emp2",
  avatar: "emp2",
  "social media": "emp5",
  "video creator": "emp4",
  "viral idea": "emp3",
  "blog manager": "emp6",
  "scrape manager": "emp7",
  "google sheet": "emp8",
  "calendar manager": "emp9",
  "online sales": "emp10",
  "email manager": "emp11",
  telephone: "emp12",
  "phone salesperson": "emp13",
  "phone receptionist": "emp14",
  "phone sales assistant": "emp15",
  "documents manager": "emp16",
  "admin assistant": "emp17",
};

function detectAgent(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [kw, id] of Object.entries(AGENT_KEYWORD_MAP)) {
    if (lower.includes(kw)) return id;
  }
  return null;
}

export default function VoiceWidget() {
  const userId =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("userId") ??
        "anonymous")
      : "anonymous";

  const [status, setStatus] = useState<Status>("idle");
  const [conversationId, setConvId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ source: string; text: string }[]>(
    [],
  );
  const [showChat, setShowChat] = useState(false);
  const startedAtRef = useRef<string | null>(null);
  const lastEmpIdRef = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isActive = status === "connected" || status === "speaking";

  const postToWP = useCallback((payload: Record<string, unknown>) => {
    try {
      window.parent.postMessage(payload, "*");
    } catch {}
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const conversation = useConversation({
    onMessage: ({ source, message }: any) => {
      setMessages((prev) => [...prev, { source, text: message }]);
      if (source === "ai") {
        setStatus("speaking");
        postToWP({ type: "agent_message", source: "ai", message });
        const empId = detectAgent(message);
        if (empId && empId !== lastEmpIdRef.current) {
          lastEmpIdRef.current = empId;
          postToWP({ type: "open_agent", empId });
        }
      } else {
        setStatus("connected");
        postToWP({ type: "agent_message", source: "user", message });
      }
    },
    onError: (err: any) => {
      setErrorMsg(typeof err === "string" ? err : "Connection error");
      setStatus("error");
      postToWP({ type: "call_failed" });
    },
  });
  const WP_API = "https://jamayaai.com/wp-json/jamayaai/v1";

  const startCall = useCallback(async () => {
    setStatus("connecting");
    setErrorMsg(null);
    setMessages([]);
    lastEmpIdRef.current = null;
    setShowChat(true);

    try {
      const res = await fetch("/api/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to get signed URL");
      const { signedUrl } = await res.json();
      const convId = await conversation.startSession({ signedUrl });
      startedAtRef.current = new Date().toISOString();
      setConvId(convId);
      setStatus("connected");

      // ── Notify WP: call started ──────────────────────
      postToWP({ type: "call_connected", conversationId: convId, userId });
      fetch(WP_API + "/call-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          conversationId: convId,
          startedAt: startedAtRef.current,
        }),
      }).catch((e) => console.error("[widget] call-start failed:", e));
    } catch (err) {
      console.error("[widget] startCall failed:", err);
      setStatus("error");
      setErrorMsg("Could not start session");
      postToWP({ type: "call_failed" });
    }
  }, [conversation, userId, postToWP]);

  const endCall = useCallback(async () => {
    setStatus("disconnecting");
    const endedAt = new Date().toISOString();
    try {
      await conversation.endSession();
    } catch {}

    // ── Notify WP: call ended ────────────────────────────
    fetch(WP_API + "/call-end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        conversationId: conversationId ?? "unknown",
        startedAt: startedAtRef.current,
        endedAt,
        messageCount: messages.length,
      }),
    }).catch((e) => console.error("[widget] call-end failed:", e));

    try {
      await fetch("/api/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          conversationId: conversationId ?? "unknown",
          startedAt: startedAtRef.current,
          endedAt,
        }),
      });
    } catch {}

    postToWP({ type: "call_ended", conversationId, userId, endedAt });
    startedAtRef.current = null;
    lastEmpIdRef.current = null;
    setConvId(null);
    setStatus("idle");
  }, [conversation, conversationId, userId, messages.length, postToWP]);
  // const startCall = useCallback(async () => {
  //   setStatus("connecting");
  //   setErrorMsg(null);
  //   setMessages([]);
  //   lastEmpIdRef.current = null;
  //   setShowChat(true);
  //   try {
  //     const res = await fetch("/api/start-session", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ userId }),
  //     });
  //     if (!res.ok) throw new Error("Failed to get signed URL");
  //     const { signedUrl } = await res.json();
  //     const convId = await conversation.startSession({ signedUrl });
  //     startedAtRef.current = new Date().toISOString();
  //     setConvId(convId);
  //     setStatus("connected");
  //     postToWP({ type: "call_connected", conversationId: convId, userId });
  //   } catch (err) {
  //     console.error("[widget] startCall failed:", err);
  //     setStatus("error");
  //     setErrorMsg("Could not start session");
  //     postToWP({ type: "call_failed" });
  //   }
  // }, [conversation, userId, postToWP]);

  // const endCall = useCallback(async () => {
  //   setStatus("disconnecting");
  //   const endedAt = new Date().toISOString();
  //   try {
  //     await conversation.endSession();
  //   } catch {}
  //   try {
  //     await fetch("/api/end-session", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         userId,
  //         conversationId: conversationId ?? "unknown",
  //         startedAt: startedAtRef.current,
  //         endedAt,
  //       }),
  //     });
  //   } catch (err) {
  //     console.error("[widget] end-session failed:", err);
  //   }
  //   postToWP({ type: "call_ended", conversationId, userId, endedAt });
  //   startedAtRef.current = null;
  //   lastEmpIdRef.current = null;
  //   setConvId(null);
  //   setStatus("idle");
  // }, [conversation, conversationId, userId, postToWP]);

  const handleAvatarClick = useCallback(() => {
    if (status === "connecting" || status === "disconnecting") return;
    if (isActive) {
      setShowChat((prev) => !prev);
    } else {
      startCall();
    }
  }, [status, isActive, startCall]);

  useEffect(() => {
    if (status !== "error") return;
    const t = setTimeout(() => {
      setStatus("idle");
      setErrorMsg(null);
    }, 3000);
    return () => clearTimeout(t);
  }, [status]);

  const statusColor = isActive
    ? "#00ffff"
    : status === "error"
      ? "#f87171"
      : "rgba(255,255,255,0.4)";

  const statusLabel =
    errorMsg ??
    (status === "idle"
      ? "Click to talk"
      : status === "connecting"
        ? "Connecting…"
        : status === "connected"
          ? "Listening…"
          : status === "speaking"
            ? "Speaking…"
            : status === "disconnecting"
              ? "Ending…"
              : "Error");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: transparent; }
        .vw-root { font-family: 'DM Mono', monospace; display: flex; flex-direction: column; align-items: center; gap: 0; width: 100%; min-height: 100vh; padding: 12px 8px; background: transparent; }
        .vw-avatar-wrap { position: relative; cursor: pointer; width: 140px; height: 140px; flex-shrink: 0; }
        .vw-avatar-img { width: 140px; height: 140px; border-radius: 50%; object-fit: cover; object-position: top; border: 3px solid transparent; transition: border-color 0.4s, box-shadow 0.4s; display: block; }
        .vw-avatar-wrap[data-active="true"] .vw-avatar-img { border-color: #00ffff; box-shadow: 0 0 28px rgba(0,255,255,0.55); animation: avatarPulse 2s ease-in-out infinite; }
        @keyframes avatarPulse { 0%,100%{box-shadow:0 0 20px rgba(0,255,255,0.4)} 50%{box-shadow:0 0 45px rgba(0,255,255,0.8)} }
        .vw-badge { position: absolute; bottom: 4px; right: 4px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #0f0f13; transition: background 0.3s; font-size: 14px; }
        .vw-status { margin-top: 8px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; text-align: center; transition: color 0.3s; }
        .vw-chat { width: 100%; margin-top: 12px; background: rgba(15,15,20,0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; max-height: 340px; }
        .vw-chat-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
        .vw-chat-header-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ffff; animation: blink 1.4s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .vw-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
        .vw-msg { max-width: 85%; padding: 8px 12px; border-radius: 12px; font-size: 12px; line-height: 1.5; word-break: break-word; }
        .vw-msg.ai { background: rgba(0,255,255,0.08); border: 1px solid rgba(0,255,255,0.15); color: #e0fffe; align-self: flex-start; border-bottom-left-radius: 4px; }
        .vw-msg.user { background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.25); color: #f0e8ff; align-self: flex-end; border-bottom-right-radius: 4px; }
        .vw-msg-label { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.45; margin-bottom: 3px; }
        .vw-empty { text-align: center; color: rgba(255,255,255,0.2); font-size: 11px; padding: 20px; }
        .vw-chat-footer { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; align-items: center; }
        .vw-end-btn { all: unset; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #f87171; border: 1px solid rgba(248,113,113,0.25); border-radius: 99px; padding: 5px 14px; transition: background 0.2s; white-space: nowrap; }
        .vw-end-btn:hover { background: rgba(248,113,113,0.1); }
        .vw-conv-id { font-size: 8px; color: rgba(255,255,255,0.15); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
      `}</style>

      <div className="vw-root">
        <div
          className="vw-avatar-wrap"
          data-active={String(isActive)}
          onClick={handleAvatarClick}
          role="button"
          aria-label={isActive ? "Toggle chat" : "Start call"}
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleAvatarClick()}
        >
          <img
            className="vw-avatar-img"
            src="https://jamayaai.com/wp-content/themes/Theme/templates/images/avatar.png"
            alt="AI Avatar"
            onError={(e: any) => {
              e.target.style.background = "#1a0f2e";
            }}
          />
          <div
            className="vw-badge"
            style={{
              background: isActive
                ? "#00ffff"
                : status === "connecting" || status === "disconnecting"
                  ? "#f59e0b"
                  : status === "error"
                    ? "#f87171"
                    : "rgba(30,30,40,0.9)",
            }}
          >
            {isActive
              ? "🔴"
              : status === "connecting" || status === "disconnecting"
                ? "⏳"
                : "🎙️"}
          </div>
        </div>

        <div className="vw-status" style={{ color: statusColor }}>
          {statusLabel}
        </div>

        {showChat && (
          <div className="vw-chat">
            <div className="vw-chat-footer">
              {isActive && (
                <button className="vw-end-btn" onClick={endCall}>
                  End call
                </button>
              )}
              {conversationId && (
                <span className="vw-conv-id" title={conversationId}>
                  {conversationId}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
