
require("dotenv").config();

const {
    Client,
    GatewayIntentBits
} = require("discord.js");

// ======================================================
// KONFIGURACJA
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

// ======================================================
// BOT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ======================================================
// GOTOWOŚĆ
// ======================================================

client.once("ready", () => {
    console.log(✅ Nick-bot działa jako ${client.user.tag});
});

// ======================================================
// ZMIANA RÓL
// ======================================================

client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {

        // Tylko nasz serwer
        if (newMember.guild.id !== GUILD_ID) return;

        // Sprawdzamy, czy zmieniły się role
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        const rolesChanged =
            oldRoles.size !== newRoles.size ||
            oldRoles.some(role => !newRoles.has(role.id)) ||
            newRoles.some(role => !oldRoles.has(role.id));

        if (!rolesChanged) return;

        // ==================================================
        // NAJWYŻSZA ROLA
        // ==================================================

        const roles = newMember.roles.cache
            .filter(role => role.id !== newMember.guild.id)
            .sort((a, b) => b.position - a.position);

        const highestRole = roles.first();

        // ==================================================
        // BAZOWY NICK
        // ==================================================

        let baseNick =
            newMember.nickname ||
            newMember.user.username;

        // Usuwamy poprzedni prefix, np.
        // LVL 1 •
        // VIP •
        // Zweryfikowany •
        // itd.

        baseNick = baseNick.replace(
            /^.+?\s•\s/i,
            ""
        );

        // ==================================================
        // NOWY NICK
        // ==================================================

        let newNick;

        if (highestRole) {
            newNick = ${highestRole.name} • ${baseNick};
        } else {
            newNick = baseNick;
        }

        // Discord pozwala maksymalnie na 32 znaki
        if (newNick.length > 32) {
            newNick = newNick.substring(0, 32);
        }

        // Jeżeli nick już jest prawidłowy — nic nie robimy
        if (newMember.nickname === newNick) return;

        // ==================================================
        // ZMIANA NICKU
        // ==================================================

        await newMember.setNickname(newNick);

        console.log(
            ✏️ ${newMember.user.tag} → ${newNick}
        );

    } catch (error) {

        console.error(
            "❌ Błąd podczas zmiany nicku:",
            error.message
        );

    }
});

// ======================================================
// LOGOWANIE
// ======================================================

client.login(TOKEN);

".env"

DISCORD_TOKEN=TWÓJ_TOKEN_BOTA
GUILD_ID=ID_TWOJEGO_SERWERA

Uprawnienia bota

Bot musi mieć:

Zarządzanie pseudonimami

A jego rola musi znajdować się wyżej niż role użytkowników, których nicki ma zmieniać.

Przykład

Użytkownik:

"Kamil"

ma role:

"@everyone"
"Zweryfikowany"
"LVL 5"
"VIP"

Jeżeli "VIP" jest najwyżej w hierarchii, bot ustawi:

"VIP • Kamil"

Jeżeli później "LVL 6" stanie wyżej niż "VIP", ustawi:

"LVL 6 • Kamil"

Po odebraniu "LVL 6" ponownie sprawdzi wszystkie role i wybierze aktualnie najwyższą.
Wysłano
Napisz wiadomość
Napisz do:
