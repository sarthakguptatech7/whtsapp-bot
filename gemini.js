const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const conversationHistory = new Map();
const MAX_HISTORY = 10; 
const SYSTEM_PROMPT = `You are a warm, witty, and thoughtful assistant responding over WhatsApp.
Personality & Tone:
- You write like a real person texting — casual, natural, a little playful
- Keep replies SHORT unless the question genuinely needs depth (WhatsApp isn't an essay platform)
- Use light humour where it fits. Don't force it.
- Never be robotic or use corporate-speak. No "Certainly!", "Of course!", "Absolutely!" openers — just answer.
- Occasionally use filler phrases like "honestly", "tbh", "ngl", "right?" to feel natural
- Use contractions (it's, you're, I'm, doesn't) always — never stiff formal English
- Emojis: use them sparingly and only when they add warmth or clarity. 1-2 max per message.
- If someone seems upset or stressed, acknowledge it like a human would — briefly and genuinely
- Don't repeat the user's question back to them before answering
- If you don't know something, say so directly ("No idea tbh, but..." or "Not sure about that one")
Formatting for WhatsApp:
- No markdown headers (# or ##) ever
- No bullet point overload — if listing things, keep it to 3 max or weave into sentences
- Bold (*text*) only for something truly important
- Short paragraphs. One idea per paragraph.
- If a reply is naturally long, break it into 2-3 short WhatsApp-style "messages" separated by newlines
Remember: you're texting a friend, not writing a report.`;
function getHistory(userId) {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  return conversationHistory.get(userId);
}
function trimHistory(history) {
  while (history.length > MAX_HISTORY * 2) {
    history.splice(0, 2); 
  }
}
function enrichPrompt(message) {
  const lower = message.toLowerCase().trim();
  if (lower.length <= 5) {
    return `${message}\n[note: very short message, keep reply brief and casual]`;
  }
  if (lower.startsWith("hey") || lower === "hi" || lower === "hello" || lower === "sup") {
    return `${message}\n[note: greeting message, reply warmly and briefly, maybe ask what's up]`;
  }
  if (lower.includes("?")) {
    return message; 
  }
  if (lower.includes("help") || lower.includes("how do i") || lower.includes("how to")) {
    return `${message}\n[note: help request, be practical and clear but still casual]`;
  }
  return message;
}
async function generateSmartReply(userId, userMessage) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.85,       
      topP: 0.92,
      topK: 40,
      maxOutputTokens: 300,    
      candidateCount: 1,
    },
  });
  const history = getHistory(userId);
  const enrichedMessage = enrichPrompt(userMessage);
  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(enrichedMessage);
    const response = result.response;
    const replyText = response.text().trim();
    history.push(
      { role: "user", parts: [{ text: userMessage }] },
      { role: "model", parts: [{ text: replyText }] }
    );
    trimHistory(history);
    return replyText;
  } catch (error) {
    console.error("[Gemini] Generation error:", error.message);
    const fallbacks = [
      "Ugh, my brain glitched for a sec 😅 mind trying again?",
      "Something went weird on my end — can you resend that?",
      "Hmm, didn't quite catch that. Could you try again?",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
function clearHistory(userId) {
  conversationHistory.delete(userId);
}
module.exports = { generateSmartReply, clearHistory };
