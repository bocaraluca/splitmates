const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export async function monitorSuspiciousUserBehavior(args: {
  userId: number;
  username: string;
  triggeredRules: Array<{ key: string; note: string }>;
  recentLogs: Array<{ actionType: string; outcome: string | null; createdAt: Date }>;
}): Promise<string> {
  const logLines = args.recentLogs
    .slice(0, 30)
    .map((l) => `- ${l.actionType} | ${l.outcome ?? "no outcome"} | ${l.createdAt.toISOString()}`)
    .join("\n");

  const ruleLines = args.triggeredRules
    .map((r) => `- ${r.key}: ${r.note}`)
    .join("\n");

  const prompt = `You are monitoring suspicious users in a bill-splitting web app called Splitmates.
The following user was flagged by the detection system:
Username: ${args.username} (id: ${args.userId})
Rules that were triggered:
${ruleLines}
Their last 30 actions:
${logLines}
Based on this, write 2-3 sentences describing what suspicious behaviour you see, what it could mean (e.g. brute force, scraping, privilege escalation attempt), and what should be done. Be direct and specific.`;

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not set");

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Groq error body:", errorBody);
      throw new Error(`Groq responded with status ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data?.choices?.[0]?.message?.content?.trim() ?? "AI analysis unavailable.";
  } catch (err) {
    console.error("AI monitor failed:", err);
    return "AI analysis unavailable.";
  }
}