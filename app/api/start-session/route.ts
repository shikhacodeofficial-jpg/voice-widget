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
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400, headers: CORS })

    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!
    const apiKey  = process.env.ELEVENLABS_API_KEY!

    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey } }
    )

    if (!elRes.ok) {
      const err = await elRes.text()
      console.error("[start-session] ElevenLabs error:", err)
      return NextResponse.json({ error: "Failed to get signed URL" }, { status: 502, headers: CORS })
    }

    const { signed_url: signedUrl } = await elRes.json()
    return NextResponse.json({ signedUrl, agentId }, { status: 200, headers: CORS })

  } catch (err) {
    console.error("[start-session] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS })
  }
}
