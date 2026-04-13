import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": process.env.WORDPRESS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const { userId, isGuest } = await req.json();

    const apiKey = process.env.ELEVENLABS_API_KEY!;

    // Try all possible env var names as fallback
    const loggedInAgent =
      process.env.ELEVENLABS_AGENT_ID ||
      process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ||
      "";

    const guestAgent =
      process.env.ELEVENLABS_AGENT_GUEST_ID ||
      process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_GUEST_ID ||
      loggedInAgent; // fallback to logged-in agent if guest not set

    const agentId = isGuest ? guestAgent : loggedInAgent;

    // Debug log — check Vercel function logs
    console.log("[start-session] isGuest:", isGuest);
    console.log("[start-session] agentId:", agentId);
    console.log("[start-session] apiKey set:", !!apiKey);

    if (!agentId) {
      return NextResponse.json(
        { error: "No agent ID configured" },
        { status: 500, headers: CORS },
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key configured" },
        { status: 500, headers: CORS },
      );
    }

    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey } },
    );

    if (!elRes.ok) {
      const err = await elRes.text();
      console.error("[start-session] ElevenLabs error:", err);
      return NextResponse.json(
        { error: "Failed to get signed URL", detail: err },
        { status: 502, headers: CORS },
      );
    }

    const { signed_url: signedUrl } = await elRes.json();
    return NextResponse.json(
      { signedUrl, agentId },
      { status: 200, headers: CORS },
    );
  } catch (err) {
    console.error("[start-session] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS },
    );
  }
}
