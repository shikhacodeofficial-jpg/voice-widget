import { NextRequest, NextResponse } from "next/server"

const CORS = {
  "Access-Control-Allow-Origin" : process.env.WORDPRESS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  try {
    const { userId, conversationId, startedAt, endedAt } = await req.json()

    const durationSeconds = startedAt && endedAt
      ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
      : null

    // Send to n8n webhook
    const n8nUrl = process.env.N8N_WEBHOOK_URL
    if (n8nUrl) {
      await fetch(n8nUrl, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({
          event         : "session_ended",
          userId,
          conversationId,
          startedAt,
          endedAt,
          durationSeconds,
          agentId       : process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
          timestamp     : new Date().toISOString(),
        }),
      }).catch(e => console.error("[end-session] n8n webhook failed:", e))
    }

    return NextResponse.json({ success: true }, { status: 200, headers: CORS })

  } catch (err) {
    console.error("[end-session] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS })
  }
}
