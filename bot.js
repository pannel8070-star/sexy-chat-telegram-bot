const TelegramBot = require('node-telegram-bot-api');
const { Octokit } = require("@octokit/rest");
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Ek simple web page, taaki Render ko lage ki server chal raha hai
app.get('/', (req, res) => {
    res.send('Bot is running 24/7! 🚀');
});

app.listen(port, () => {
    console.log(`Dummy web server listening on port ${port}`);
});

// --- CONFIGURATION ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'pannel8070-star';
const REPO = 'sexy-chat-playstore-page';
const RELEASE_TAG = 'v1.0';
const FILE_NAME = 'sexy_chat.apk';
// ---------------------

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// 1. /start command ka reply
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "👋 Welcome bhai! \n\nMain Sexy Chat APK Updater Bot hoon. Mujhe naya APK file bhejo, main use GitHub pe upload kar dunga aur website automatically update ho jayegi! 🚀");
});

// 2. /help command ka reply
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "📌 *Help Menu*\n\n1. Mujhe seedha naya APK file bhejo.\n2. Main GitHub pe purana APK delete karke naya upload kar dunga.\n3. Website ka download link automatically naya APK serve karega.\n\nAb bhejo APK! 📁", { parse_mode: 'Markdown' });
});

// 3. Agar koi normal text bheje (bina file ke)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    // Agar message text hai aur / se start nahi hota
    if (msg.text && !msg.text.startsWith('/')) {
        bot.sendMessage(chatId, "Bhai, mujhe text mat bhejo. Seedha APK file bhejo taaki main upload kar sakun! 📁");
    }
});

// 4. Document (APK) receive karne ka handler
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.document.file_id;
    const fileName = msg.document.file_name;

    if (!fileName.endsWith('.apk')) {
        return bot.sendMessage(chatId, "❌ Bhai, sirf APK file bhejo!");
    }

    bot.sendMessage(chatId, "⏳ APK mil gaya! Ab GitHub pe upload kar raha hoon...");

    try {
        // Telegram se file download karo
        const fileLink = await bot.getFileLink(fileId);
        const response = await axios({ url: fileLink, responseType: 'stream' });
        const tempPath = `./${FILE_NAME}`;
        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // GitHub se purana asset delete karo
        const release = await octokit.rest.repos.getReleaseByTag({ owner: OWNER, repo: REPO, tag: RELEASE_TAG });
        const oldAsset = release.data.assets.find(a => a.name === FILE_NAME);

        if (oldAsset) {
            await octokit.rest.repos.deleteReleaseAsset({ owner: OWNER, repo: REPO, asset_id: oldAsset.id });
            bot.sendMessage(chatId, "🗑️ Purana APK delete ho gaya.");
        }

        // Naya APK upload karo
        const stats = fs.statSync(tempPath);
        await octokit.rest.repos.uploadReleaseAsset({
            owner: OWNER, repo: REPO, release_id: release.data.id,
            name: FILE_NAME, data: fs.readFileSync(tempPath),
            headers: { 'content-type': 'application/vnd.android.package-archive', 'content-length': stats.size }
        });

        bot.sendMessage(chatId, "✅ APK successfully replace ho gaya GitHub pe! Website automatically update ho jayegi. 🎉");
        fs.unlinkSync(tempPath); // Temp file delete karo

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "❌ Error aaya bhai: " + error.message);
    }
});

console.log("Bot chalu ho gaya hai...");