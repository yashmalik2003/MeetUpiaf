import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // ✅ READ FROM ENV (Secure)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Missing API Key in .env");
    }

    // ✅ KEEP THE WORKING MODEL
    const model = "gemini-flash-latest";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemPrompt = `You are an event planning assistant.
    Return ONLY valid JSON in this exact format:
    {
      "title": "string",
      "description": "string (single paragraph)",
      "category": "tech | music | sports | art | food | business | health | education | gaming | networking | outdoor | community",
      "suggestedCapacity": number,
      "suggestedTicketType": "free" | "paid"
    }
    
    User idea: ${prompt}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Handle quota limits gracefully for users
      if (response.status === 429) {
        return NextResponse.json(
          { error: "System busy. Please try again in 30 seconds." },
          { status: 429 }
        );
      }
      throw new Error(`Gemini Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return NextResponse.json(JSON.parse(cleanedText));
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: "Failed to generate event" },
      { status: 500 }
    );
  }
}
