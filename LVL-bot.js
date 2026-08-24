require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    Client,
    GatewayIntentBits
} = require("discord.js");

// ======================================================
// KONFIGURACJA
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;

// ID SERWERA
const GUILD_ID = "1538986523234672661";

// Ile XP za wiadomość
const XP_MIN = 15;
const XP_MAX = 25;

// Ile sekund trzeba odczekać przed kolejnym XP
const XP_COOLDOWN = 60;

// ======================================================
// ROLE 1-100
// ======================================================

// Bot szuka ról po nazwie.
// Jeżeli role nazywają się np.:
// 1, 2, 3, 4 ... 100
// to nic więcej nie trzeba tutaj wpisywać.

const LEVEL_ROLES = [];

for (let i = 1; i <= 100; i++) {
    LEVEL_ROLES.push(`🆙 LvL ${i}`);
}

// ======================================================
// PLIK Z DANYMI
// ======================================================

const DATA_FILE = path.join(__dirname, "levels.json");

let levels = {};

// Wczytywanie danych
if (fs.existsSync(DATA_FILE)) {
    try {
        levels = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        console.log("Wczytano dane leveli.");
    } catch (error) {
        console.log("Nie udało się wczytać levels.json.");
        levels = {};
    }
}

// Zapisywanie danych
function saveLevels() {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(levels, null, 2),
        "utf8"
    );
}

// ======================================================
// FUNKCJE XP
// ======================================================

// XP potrzebne do konkretnego poziomu
function xpForLevel(level) {
    // Poziom 1 = 100 XP
    // Poziom 2 = 200 XP
    // Poziom 3 = 300 XP itd.
    return level * 100;
}

// Obliczanie poziomu na podstawie XP
function getLevel(xp) {
    let level = 0;

    for (let i = 1; i <= 100; i++) {
        if (xp >= xpForLevel(i)) {
            level = i;
        } else {
            break;
        }
    }

    return level;
}

// Losowa ilość XP
function randomXP() {
    return Math.floor(
        Math.random() * (XP_MAX - XP_MIN + 1)
    ) + XP_MIN;
}

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ======================================================
// GOTOWOŚĆ BOTA
// ======================================================

client.once("ready", async () => {
    console.log("====================================");
    console.log("       LVL BOT URUCHOMIONY");
    console.log("====================================");

    console.log(`Bot: ${client.user.tag}`);

    try {
        const guild = await client.guilds.fetch(GUILD_ID);

        console.log(`Serwer: ${guild.name}`);

        // Sprawdzenie ról
        let znalezione = 0;

        for (let i = 0; i < LEVEL_ROLES.length; i++) {
            const roleName = LEVEL_ROLES[i];

            const role = guild.roles.cache.find(
                r => r.name === roleName
            );

            if (role) {
                znalezione++;
            } else {
                console.log(
                    `BRAK ROLI: ${roleName}`
                );
            }
        }

        console.log(
            `Znaleziono ${znalezione}/100 ról levelowych.`
        );

    } catch (error) {
        console.error(
            "Nie udało się pobrać serwera:",
            error
        );
    }
});

// ======================================================
// XP COOLDOWN
// ======================================================

const cooldowns = new Map();

// ======================================================
// WIADOMOŚCI
// ======================================================

client.on("messageCreate", async (message) => {

    // Ignoruj boty
    if (message.author.bot) return;

    // Ignoruj DM
    if (!message.guild) return;

    // Tylko nasz serwer
    if (message.guild.id !== GUILD_ID) return;

    const userId = message.author.id;

    // ==================================================
    // COOLDOWN
    // ==================================================

    const now = Date.now();

    if (cooldowns.has(userId)) {

        const lastMessage = cooldowns.get(userId);

        if (now - lastMessage < XP_COOLDOWN * 1000) {
            return;
        }
    }

    cooldowns.set(userId, now);

    // ==================================================
    // DANE UŻYTKOWNIKA
    // ==================================================

    if (!levels[userId]) {
        levels[userId] = {
            xp: 0,
            level: 0
        };
    }

    const userData = levels[userId];

    const oldLevel = userData.level;

    // Dodaj XP
    userData.xp += randomXP();

    // Oblicz nowy poziom
    let newLevel = getLevel(userData.xp);

    // Maksymalny poziom
    if (newLevel > 100) {
        newLevel = 100;
    }

    userData.level = newLevel;

    // Zapis
    saveLevels();

    // ==================================================
    // AWANS
    // ==================================================

    if (newLevel > oldLevel) {

        await giveLevelRole(
            message.member,
            newLevel
        );

        // Wiadomość o awansie
        await message.channel.send(
            `🎉 **${message.author} awansował na poziom ${newLevel}!**`
        );
    }
});

// ======================================================
// NADAWANIE RANGI
// ======================================================

async function giveLevelRole(member, level) {

    if (level < 1) return;

    if (level > 100) level = 100;

    // Znajdź aktualną rolę poziomu
    const newRoleName = LEVEL_ROLES[level - 1];

    const newRole = member.guild.roles.cache.find(
        role => role.name === newRoleName
    );

    if (!newRole) {

        console.log(
            `Nie znaleziono roli poziomu ${level}: ${newRoleName}`
        );

        return;
    }

    // ==================================================
    // USUWANIE STAREJ RANGI
    // ==================================================

    for (const roleName of LEVEL_ROLES) {

        const oldRole = member.guild.roles.cache.find(
            role => role.name === roleName
        );

        if (
            oldRole &&
            member.roles.cache.has(oldRole.id) &&
            oldRole.id !== newRole.id
        ) {

            try {
                await member.roles.remove(oldRole);
            } catch (error) {
                console.log(
                    `Nie udało się usunąć roli ${oldRole.name}.`
                );
            }
        }
    }

    // ==================================================
    // NADANIE NOWEJ RANGI
    // ==================================================

    if (!member.roles.cache.has(newRole.id)) {

        try {

            await member.roles.add(newRole);

            console.log(
                `${member.user.tag} otrzymał rangę ${newRole.name}`
            );

        } catch (error) {

            console.error(
                `Nie udało się nadać rangi ${newRole.name}:`,
                error
            );
        }
    }
}

// ======================================================
// KOMENDA !level
// ======================================================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    if (!message.guild) return;

    if (message.guild.id !== GUILD_ID) return;

    if (message.content.toLowerCase() === "!level") {

        const userId = message.author.id;

        if (!levels[userId]) {
            levels[userId] = {
                xp: 0,
                level: 0
            };
        }

        const userData = levels[userId];

        const currentLevel = userData.level;

        if (currentLevel >= 100) {

            return message.reply(
                `🏆 **${message.author.username}**, masz maksymalny poziom **100**!`
            );
        }

        const nextLevel = currentLevel + 1;

        const requiredXP = xpForLevel(nextLevel);

        const missingXP =
            Math.max(0, requiredXP - userData.xp);

        await message.reply(
            `📊 **Twój poziom:** ${currentLevel}\n` +
            `✨ **XP:** ${userData.xp}\n` +
            `🎯 **Następny poziom:** ${nextLevel}\n` +
            `📈 **Brakuje:** ${missingXP} XP`
        );
    }
});

// ======================================================
// KOMENDA !rank
// ======================================================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    if (!message.guild) return;

    if (message.guild.id !== GUILD_ID) return;

    if (message.content.toLowerCase() === "!rank") {

        const userId = message.author.id;

        if (!levels[userId]) {
            levels[userId] = {
                xp: 0,
                level: 0
            };
        }

        const userData = levels[userId];

        await message.reply(
            `🏅 **${message.author.username}**\n\n` +
            `⭐ Poziom: **${userData.level}/100**\n` +
            `✨ XP: **${userData.xp}**`
        );
    }
});

// ======================================================
// LOGOWANIE
// ======================================================

if (!TOKEN) {

    console.error(
        "BRAK DISCORD_TOKEN w Environment Variables!"
    );

    process.exit(1);
}

client.login(TOKEN);
