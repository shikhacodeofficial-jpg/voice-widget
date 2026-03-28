"use client";

import { useRef, useState, useEffect } from "react";
import { useConversation } from "@11labs/react";

const N8N_WEBHOOK =
  "https://n8n.srv736612.hstgr.cloud/webhook/Wordpresssessionid";

async function sendToWebhook(payload: Record<string, unknown>) {
  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error("Webhook error:", err);
    return false;
  }
}

export default function VoicePage() {
  const startedAtRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connected" | "sent" | "failed">("idle");
  const [userId, setUserId] = useState<string>("guest");

  // Read userId passed from WP via URL param: ?userId=123
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("userId");
    if (uid) setUserId(uid);
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      startedAtRef.current = new Date().toISOString();
      setStatus("connected");
      console.log("✅ Connected");
    },
    onDisconnect: async () => {
      const endedAt = new Date().toISOString();
      const ok = await sendToWebhook({
        userId,
        startedAt: startedAtRef.current,
        endedAt,
        source: "elevenlabs-voice-widget",
      });
      setStatus(ok ? "sent" : "failed");
      startedAtRef.current = null;
    },
    onMessage: (msg) => {
      console.log(`[${msg.source}]:`, msg.message);
    },
    onError: (err) => {
      console.error("ElevenLabs error:", err);
    },
  });

  const isConnected = conversation.status === "connected";

  async function handleToggle() {
    if (isConnected) {
      await conversation.endSession();
    } else {
      await conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
      });
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "16px",
        padding: "20px",
        background: "transparent",
      }}
    >
      {/* Avatar / Button */}
      <button
        onClick={handleToggle}
        style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          border: isConnected
            ? "3px solid #00ffff"
            : "3px solid rgba(168,85,247,0.6)",
          background: isConnected
            ? "radial-gradient(circle, rgba(0,255,255,0.2), rgba(0,0,0,0.5))"
            : "radial-gradient(circle, rgba(168,85,247,0.3), rgba(0,0,0,0.5))",
          cursor: "pointer",
          boxShadow: isConnected
            ? "0 0 30px rgba(0,255,255,0.6)"
            : "0 0 20px rgba(168,85,247,0.4)",
          transition: "all 0.3s ease",
          fontSize: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: isConnected ? "pulse 1.5s infinite" : "none",
        }}
      >
        {isConnected ? "🔴" : "🎙️"}
      </button>

      {/* Label */}
      <p
        style={{
          color: isConnected ? "#00ffff" : "rgba(255,255,255,0.7)",
          fontSize: "14px",
          fontFamily: "sans-serif",
          margin: 0,
          textShadow: isConnected ? "0 0 10px rgba(0,255,255,0.5)" : "none",
        }}
      >
        {isConnected ? "Tap to end call" : "Tap to talk to AI"}
      </p>

      {/* Status badges */}
      {status === "sent" && (
        <p style={{ color: "#10b981", fontSize: "12px", fontFamily: "monospace", margin: 0 }}>
          ✓ Session saved
        </p>
      )}
      {status === "failed" && (
        <p style={{ color: "#ef4444", fontSize: "12px", fontFamily: "monospace", margin: 0 }}>
          ✗ Webhook failed
        </p>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,255,255,0.4); }
          50%       { box-shadow: 0 0 50px rgba(0,255,255,0.9); }
        }
      `}</style>
    </div>
  );
}
