const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const pino = require("pino");
const { generateSmartReply } = require("./gemini");

let currentSock = null;

async function startBot(io, setStatus, setQR) {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`[Bot] using WA v${version.join(".")}, isLatest: ${isLatest}`);

    function createSocket() {
        currentSock = makeWASocket({
            version,
            logger: pino({ level: "silent" }),
            printQRInTerminal: true,
            auth: state,
            browser: ["WhatsApp × Gemini Bot", "Mac", "1.0.0"],
            syncFullHistory: false,
        });

        currentSock.ev.on("creds.update", saveCreds);

        currentSock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log("[Bot] Sending QR to UI...");
                setQR(qr);
                io.emit("qr", qr);
            }

            if (connection === "close") {
                const shouldReconnect =
                    lastDisconnect.error?.output?.statusCode !==
                    DisconnectReason.loggedOut;
                console.log(
                    "[Bot] Connection closed due to ",
                    lastDisconnect.error?.message || lastDisconnect.error,
                    ", reconnecting ",
                    shouldReconnect
                );
                setStatus("disconnected");
                io.emit("status", "disconnected");
                io.emit("log", "Connection closed. Reconnecting...");

                if (shouldReconnect) {
                    createSocket();
                } else {
                    console.log("[Bot] Session logged out. Please delete auth_info_baileys folder to scan again.");
                    fs.rmSync("auth_info_baileys", { recursive: true, force: true });
                    io.emit("log", "Session logged out. Restarting...");
                    setQR(null);
                    setTimeout(createSocket, 3000);
                }
            } else if (connection === "open") {
                console.log("[Bot] Connected to WhatsApp!");
                setStatus("connected");
                setQR(null);
                io.emit("status", "connected");
                io.emit("log", "Connected and ready to respond!");
            }
        });

        currentSock.ev.on("messages.upsert", async (m) => {
            if (m.type !== "notify") return;

            const message = m.messages[0];
            if (!message.message || message.key.fromMe) return;

            const remoteJid = message.key.remoteJid;
            // Extract text content (handles plain text or extended text)
            const textMessage =
                message.message.conversation ||
                message.message.extendedTextMessage?.text;

            if (textMessage) {
                console.log(`[Message] ${remoteJid}: ${textMessage}`);
                io.emit("log", `Message received from: ${remoteJid.split("@")[0]}`);

                await currentSock.readMessages([message.key]);

                // simulate typing delay
                await currentSock.sendPresenceUpdate("composing", remoteJid);

                try {
                    const replyText = await generateSmartReply(remoteJid, textMessage);

                    await currentSock.sendPresenceUpdate("paused", remoteJid);
                    await currentSock.sendMessage(remoteJid, { text: replyText }, { quoted: message });

                    io.emit("log", `Replied to ${remoteJid.split("@")[0]}`);
                } catch (error) {
                    console.error("[Bot] Failed to send reply", error);
                    io.emit("log", `Failed to reply: ${error.message}`);
                    await currentSock.sendPresenceUpdate("paused", remoteJid);
                }
            }
        });

        return currentSock;
    }

    createSocket();
}

async function wipeSession() {
    if (currentSock) {
        console.log("[Bot] Gracefully terminating session on request...");
        currentSock.logout();
    }
}

module.exports = { startBot, wipeSession };
