require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { startBot, wipeSession } = require("./bot");
const path = require("path");

let apiWarning = "";
if (!process.env.GEMINI_API_KEY) {
  apiWarning = "❌ Missing required environment variable: GEMINI_API_KEY. AI responses will fail.";
  console.error(apiWarning);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

let currentStatus = "disconnected";
let currentQR = null;

io.on("connection", (socket) => {
  console.log("[Server] Web client connected");

  socket.emit("status", currentStatus);
  if (apiWarning) {
    socket.emit("log", apiWarning);
  }

  if (currentQR && currentStatus !== "connected") {
    socket.emit("qr", currentQR);
  }

  socket.on("disconnect", () => {
    console.log("[Server] Web client disconnected");
  });

  socket.on("wipe_session", async () => {
    console.log("[Server] Received wipe_session command from UI.");
    io.emit("log", "Command received: Terminating and wiping WhatsApp session...");
    await wipeSession();
  });
});

startBot(io, (status) => currentStatus = status, (qr) => currentQR = qr);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 WhatsApp × Gemini Bot (Baileys) running on port ${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`\nOpen the dashboard to scan the QR code and connect.\n`);
});

process.on("SIGTERM", () => {
  console.log("\n[Server] SIGTERM received — shutting down gracefully");
  process.exit(0);
});
