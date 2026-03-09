require("dotenv").config();
const express = require("express");
const webhookRouter = require("./src/webhook");
const REQUIRED_ENV = [
  "WA_ACCESS_TOKEN",
  "WA_PHONE_NUMBER_ID",
  "WA_VERIFY_TOKEN",
  "GEMINI_API_KEY",
];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error("❌ Missing required environment variables:");
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error("\nCopy .env.example → .env and fill in your keys.");
  process.exit(1);
}
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
  res.json({
    status: "🟢 running",
    bot: "WhatsApp × Gemini Flash",
    webhook: `POST /webhook`,
    uptime: `${Math.floor(process.uptime())}s`,
  });
});
app.use("/webhook", webhookRouter);
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use((err, req, res, next) => {
  console.error("[Server] Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});
app.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp × Gemini bot running on port ${PORT}`);
  console.log(`   Health:  http:
  console.log(`   Webhook: http:
  console.log(`\n   Expose publicly with: ngrok http ${PORT}`);
  console.log(`   Then set webhook URL in Meta dashboard.\n`);
});
process.on("SIGTERM", () => {
  console.log("\n[Server] SIGTERM received — shutting down gracefully");
  process.exit(0);
});
