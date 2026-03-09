const axios = require("axios");
const WA_BASE_URL = "https:
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const processedMessages = new Set();
const MESSAGE_ID_TTL = 60_000; 
async function sendTextMessage(to, text) {
  const url = `${WA_BASE_URL}/${PHONE_NUMBER_ID}/messages`;
  try {
    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body: text,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`[WhatsApp] ✅ Message sent to ${to} | ID: ${response.data.messages?.[0]?.id}`);
    return response.data;
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error("[WhatsApp] ❌ Failed to send message:", JSON.stringify(errData, null, 2));
    throw error;
  }
}
async function markAsRead(messageId) {
  const url = `${WA_BASE_URL}/${PHONE_NUMBER_ID}/messages`;
  try {
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.warn("[WhatsApp] ⚠️ Could not mark message as read:", error.message);
  }
}
async function simulateTypingDelay(text) {
  const typingTime = Math.min(Math.max(text.length * 50, 800), 3500);
  await new Promise((resolve) => setTimeout(resolve, typingTime));
}
function parseIncomingMessage(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    if (!value?.messages) return null;
    const message = value.messages[0];
    const contact = value.contacts?.[0];
    if (message.type !== "text") {
      return {
        type: message.type,
        from: message.from,
        messageId: message.id,
        isText: false,
        senderName: contact?.profile?.name || "Someone",
      };
    }
    return {
      type: "text",
      isText: true,
      from: message.from,           
      messageId: message.id,
      text: message.text.body,
      senderName: contact?.profile?.name || "Someone",
      timestamp: new Date(Number(message.timestamp) * 1000),
    };
  } catch (err) {
    console.error("[WhatsApp] ❌ Failed to parse message:", err.message);
    return null;
  }
}
function isDuplicate(messageId) {
  if (processedMessages.has(messageId)) return true;
  processedMessages.add(messageId);
  setTimeout(() => processedMessages.delete(messageId), MESSAGE_ID_TTL);
  return false;
}
module.exports = {
  sendTextMessage,
  markAsRead,
  simulateTypingDelay,
  parseIncomingMessage,
  isDuplicate,
};
