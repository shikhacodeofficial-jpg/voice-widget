"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useConversation } from "@elevenlabs/react"

type Status = "idle" | "connecting" | "connected" | "speaking" | "disconnecting" | "error"

function PulseOrb({ status }: { status: Status }) {
  const isActive  = status === "connected" || status === "speaking"
  const isLoading = status === "connecting" || status === "disconnecting"

  return (
    <div className="orb-container" data-status={status}>
      {[0, 1, 2].map(i => (
        <div key={i} className="orb-ring" style={{
          animationDelay    : `${i * 0.4}s`,
          animationPlayState: isActive ? "running" : "paused",
          opacity           : isActive ? 1 : 0,
        }} />
      ))}
      <div className={`orb-core ${isLoading ? "orb-spin" : ""}`}>
        {status === "idle" && (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
        {(status === "connected" || status === "speaking") && (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="9" width="2" height="6" rx="1"/>
            <rect x="10" y="6" width="2" height="12" rx="1"/>
            <rect x="14" y="8" width="2" height="8" rx="1"/>
            <rect x="18" y="10" width="2" height="4" rx="1"/>
          </svg>
        )}
        {(status === "connecting" || status === "disconnecting") && (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        )}
        {status === "error" && (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </div>
    </div>
  )
}

const LABEL: Record<Status, string> = {
  idle         : "Tap to talk",
  connecting   : "Connecting…",
  connected    : "Listening",
  speaking     : "Agent speaking",
  disconnecting: "Ending call…",
  error        : "Error — tap to retry",
}

// ── Agent keyword → WP div ID map ───────────────────────────────────────────
// Add all your agents here — key = words AI might say, value = your WP div ID
const AGENT_KEYWORD_MAP: Record<string, string> = {
  "super agent"          : "emp4",
  "ai super agent"       : "emp4",
  "chatbox"              : "emp1",
  "avatar"               : "emp1",
  "social media"         : "emp2",
  "video creator"        : "emp3",
  "viral idea"           : "emp3",
  "blog manager"         : "emp5",
  "scrape manager"       : "emp6",
  "google sheet"         : "emp7",
  "calendar manager"     : "emp8",
  "online sales"         : "emp9",
  "email manager"        : "emp10",
  "telephone"            : "emp11",
  "phone salesperson"    : "emp12",
  "phone receptionist"   : "emp13",
  "phone sales assistant": "emp14",
  "documents manager"    : "emp15",
  "admin assistant"      : "emp16",
}

function detectAgentFromMessage(message: string): string | null {
  const lower = message.toLowerCase()
  for (const [keyword, empId] of Object.entries(AGENT_KEYWORD_MAP)) {
    if (lower.includes(keyword)) return empId
  }
  return null
}

export default function VoiceWidget() {
  const userId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("userId") ?? "anonymous"
    : "anonymous"

  const [status, setStatus]         = useState<Status>("idle")
  const [conversationId, setConvId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const startedAtRef                = useRef<string | null>(null)
  const lastEmpIdRef                = useRef<string | null>(null)

  // ── Post message to WordPress parent ────────────────────────────────────
  const postToWP = useCallback((payload: Record<string, unknown>) => {
    try {
      window.parent.postMessage(payload, "*")
    } catch (e) {
      console.warn("[widget] postMessage failed:", e)
    }
  }, [])

  const conversation = useConversation({
    onMessage: ({ source, message }: { source: "user" | "ai"; message: string }) => {
      if (source === "ai") {
        setStatus("speaking")

        // Send full message to WP for display/logging
        postToWP({ type: "agent_message", source: "ai", message })

        // Detect agent keyword and notify WP to open the right div
        const empId = detectAgentFromMessage(message)
        if (empId && empId !== lastEmpIdRef.current) {
          lastEmpIdRef.current = empId
          postToWP({ type: "open_agent", empId })
          console.log(`[widget] Detected agent: ${empId} from message: "${message}"`)
        }
      } else {
        setStatus("connected")
        postToWP({ type: "agent_message", source: "user", message })
      }
    },
    onError: (err: unknown) => {
      console.error("[widget] error:", err)
      setErrorMsg(typeof err === "string" ? err : "Connection error")
      setStatus("error")
      postToWP({ type: "call_failed" })
    },
  })

  // ── Start call ───────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    setStatus("connecting")
    setErrorMsg(null)
    lastEmpIdRef.current = null

    try {
      const res = await fetch("/api/start-session", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ userId }),
      })

      if (!res.ok) throw new Error("Failed to get signed URL")
      const { signedUrl } = await res.json()

      const convId = await conversation.startSession({ signedUrl })

      startedAtRef.current = new Date().toISOString()
      setConvId(convId)
      setStatus("connected")

      // Notify WP call started
      postToWP({ type: "call_connected", conversationId: convId, userId })

      console.log(`[widget] Started: userId=${userId} conversationId=${convId}`)
    } catch (err) {
      console.error("[widget] startCall failed:", err)
      setStatus("error")
      setErrorMsg("Could not start session")
      postToWP({ type: "call_failed" })
    }
  }, [conversation, userId, postToWP])

  // ── End call ─────────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    setStatus("disconnecting")
    const endedAt = new Date().toISOString()

    try { await conversation.endSession() } catch (_) {}

    if (conversationId) {
      try {
        await fetch("/api/end-session", {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({
            userId,
            conversationId,
            startedAt: startedAtRef.current,
            endedAt,
          }),
        })
      } catch (err) {
        console.error("[widget] end-session failed:", err)
      }
    }

    // Notify WP call ended
    postToWP({ type: "call_ended", conversationId, userId, endedAt })

    startedAtRef.current  = null
    lastEmpIdRef.current  = null
    setConvId(null)
    setStatus("idle")
  }, [conversation, conversationId, userId, postToWP])

  const handleToggle = useCallback(() => {
    if (status === "connecting" || status === "disconnecting") return
    if (status === "connected" || status === "speaking") endCall()
    else startCall()
  }, [status, startCall, endCall])

  useEffect(() => {
    if (status !== "error") return
    const t = setTimeout(() => { setStatus("idle"); setErrorMsg(null) }, 3000)
    return () => clearTimeout(t)
  }, [status])

  const isActive = status === "connected" || status === "speaking"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .widget { font-family: 'DM Mono', monospace; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 36px 28px; background: #0f0f13; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; width: 240px; position: relative; overflow: hidden; }
        .widget::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 200px; height: 200px; background: radial-gradient(circle, rgba(99,220,190,0.08) 0%, transparent 70%); pointer-events: none; transition: opacity 0.6s ease; opacity: 0; }
        .widget[data-active="true"]::before { opacity: 1; }
        .orb-container { position: relative; width: 100px; height: 100px; cursor: pointer; flex-shrink: 0; }
        .orb-ring { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid rgba(99,220,190,0.5); animation: ringExpand 2s ease-out infinite; transition: opacity 0.4s; }
        @keyframes ringExpand { 0% { transform: scale(0.8); opacity: 0.7; } 100% { transform: scale(1.6); opacity: 0; } }
        .orb-core { position: absolute; inset: 14px; border-radius: 50%; background: linear-gradient(135deg, #1a1a24, #252535); border: 1.5px solid rgba(99,220,190,0.3); display: flex; align-items: center; justify-content: center; color: #63dcbe; transition: background 0.3s, box-shadow 0.3s, border-color 0.3s; }
        .orb-container[data-status="connected"] .orb-core, .orb-container[data-status="speaking"] .orb-core { background: linear-gradient(135deg, #0d2420, #163530); border-color: rgba(99,220,190,0.7); box-shadow: 0 0 24px rgba(99,220,190,0.25), inset 0 0 16px rgba(99,220,190,0.05); }
        .orb-container[data-status="error"] .orb-core { border-color: rgba(248,113,113,0.6); color: #f87171; box-shadow: 0 0 16px rgba(248,113,113,0.2); }
        .orb-spin { animation: spin 1.2s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .status-label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #4a4a60; transition: color 0.3s; text-align: center; }
        .widget[data-active="true"] .status-label { color: #63dcbe; }
        .widget[data-status="error"] .status-label { color: #f87171; }
        .conv-id { font-size: 9px; letter-spacing: 0.05em; color: #2e2e40; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 99px; padding: 3px 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .end-btn { all: unset; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #f87171; border: 1px solid rgba(248,113,113,0.2); border-radius: 99px; padding: 5px 16px; transition: background 0.2s; }
        .end-btn:hover { background: rgba(248,113,113,0.08); }
        .user-badge { font-size: 9px; color: #2e2e40; letter-spacing: 0.06em; text-transform: uppercase; }
      `}</style>

      <div className="widget" data-active={String(isActive)} data-status={status}>
        <div className="orb-container" data-status={status} onClick={handleToggle}
          role="button" aria-label={isActive ? "End call" : "Start call"}
          tabIndex={0} onKeyDown={e => e.key === "Enter" && handleToggle()}>
          <PulseOrb status={status} />
        </div>
        <span className="status-label">{errorMsg ?? LABEL[status]}</span>
        {conversationId && <span className="conv-id" title={conversationId}>{conversationId}</span>}
        {isActive && <button className="end-btn" onClick={endCall}>End call</button>}
        <span className="user-badge">uid: {userId}</span>
      </div>
    </>
  )
}
