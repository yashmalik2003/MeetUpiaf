// 📁 app/api/debug-gemini/route.js
import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "❌ CRITICAL: GEMINI_API_KEY is missing from .env" },
      { status: 500 }
    );
  }

  // We use v1beta 'list models' endpoint to see what is available to you
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    return NextResponse.json({
      keyStatus: "Key is present",
      statusCode: response.status,
      availableModels: data.models
        ? data.models.map((m) => m.name)
        : "NONE FOUND",
      fullError: data.error || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
