import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/splitmates";

export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export async function POST(request: Request) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { imageBase64, mimeType } = await request.json() as { imageBase64: string; mimeType: string };

    if (!imageBase64) return NextResponse.json({ error: "No image provided" }, { status: 400 });

    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: `You are analyzing a receipt. Extract the following information:
1. TOTAL amount paid (final amount including taxes)
2. Store/merchant name as the title
3. Best matching category from this exact list: groceries, food, fast_food, alcohol, transport, entertainment, utilities, online_shopping, subscriptions, luxury, smoking, gambling, rent, other

Category guide:
- groceries = supermarket (Kaufland, Lidl, Carrefour, Mega Image etc.)
- food = restaurant, cafe, bakery
- fast_food = McDonald's, KFC, Subway, pizza delivery
- alcohol = bar, liquor store
- transport = fuel, taxi, parking, Uber/Bolt
- entertainment = cinema, concert, games
- utilities = electricity, water, internet, phone bill
- online_shopping = eMAG, Amazon etc.
- subscriptions = Netflix, Spotify, gym membership
- luxury = jewelry, designer brands
- other = anything else

Return ONLY valid JSON like: {"amount": 45.50, "title": "Kaufland", "currency": "RON", "category": "groceries", "date": "2026-06-10"}
The date must be in YYYY-MM-DD format. If no date is visible on the receipt, set "date" to null.
If you cannot find the total return: {"amount": null, "title": null, "currency": null, "category": "other", "date": null}
No explanation, only JSON.`,
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0,
      }),
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Could not parse receipt" }, { status: 422 });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("parse-receipt error:", error);
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
  }
}
