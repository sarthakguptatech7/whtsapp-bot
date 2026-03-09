const express = require("express");
const router = express.Router();
const {
  sendTextMessage,
  markAsRead,
  simulateTypingDelay,
  parseIncomingMessage,
  isDuplicate,
} = require("./whatsapp");
const { generateSmartReply, clearHistory } = require("./gemini");
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) {
    console.log("[Webhook] ✅ Webhook verified by WhatsApp");
    return res.status(200).send(challenge);
  }
  console.warn("[Webhook] ❌ Verification failed — token mismatch");
  return res.sendStatus(403);
});
router.post("/", async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== "whatsapp_business_account") return;
  const parsed = parseIncomingMessage(body);
  if (!parsed) return; 
  const { from, messageId, senderName, isText, type } = parsed;
  if (isDuplicate(messageId)) {
    console.log(`[Webhook] 🔁 Duplicate message ${messageId} — skipped`);
    return;
  }
  markAsRead(messageId);
  if (!isText) {
    console.log(`[Webhook] 📎 Received ${type} from ${from} — sending polite fallback`);
    const mediaResponses = {
      image: "ooh nice pic! 😄 I can't actually see images yet, but working on it",
      audio: "ah, a voice note! can't listen to those just yet — text me instead?",
      video: "a video! sadly I'm text-only for now 😅",
      document: "got a doc there! I can't read files yet, but drop your question as text",
      sticker: "haha love the sticker energy 😂 what's up?",
    };
    const reply = mediaResponses[type] || "I'm text-only for now — what's on your mind?";
    await sendTextMessage(from, reply);
    return;
  }
  const { text } = parsed;
  if (text.toLowerCase().trim() === "reset" || text.toLowerCase().trim() === "forget") {
    clearHistory(from);
    await sendTextMessage(from, "Fresh start! What's on your mind? 🧹");
    return;
  }
  console.log(`[Webhook] 💬 "${text}" from ${senderName} (${from})`);
  try {
    const aiReply = await generateSmartReply(from, text);
    await simulateTypingDelay(aiReply);
    await sendTextMessage(from, aiReply);
    console.log(`[Webhook] 🤖 Reply sent to ${from}: "${aiReply.substring(0, 80)}..."`);
  } catch (error) {
    console.error(`[Webhook] ❌ Error handling message from ${from}:`, error.message);
    await sendTextMessage(from, "Something went weird on my end — mind trying that again?");
  }
});
module.exports = router;
