require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const app = express();

/* =========================
   KONFIGURACJA API
========================= */

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-order-key"]
}));

app.use(express.json({ limit: "100kb" }));

const PORT = process.env.PORT || 3000;
const ORDER_CHANNEL_NAME = "zamówienia";

/* =========================
   DISCORD BOT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =========================
   SZUKANIE KANAŁU ZAMÓWIENIA
========================= */

function findOrdersChannel() {
  for (const guild of client.guilds.cache.values()) {

    const channel = guild.channels.cache.find(
      ch =>
        ch.isTextBased() &&
        ch.name.includes(ORDER_CHANNEL_NAME)
    );

    if (channel) {
      return channel;
    }
  }

  return null;
}

/* =========================
   STRONA GŁÓWNA API
========================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Kupujemy Bot API",
    status: "online"
  });
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    discord: client.isReady(),
    bot: client.user ? client.user.tag : null
  });
});

/* =========================
   TEST DISCORD
========================= */

app.get("/api/test", async (req, res) => {
  try {

    if (!client.isReady()) {
      return res.status(503).json({
        ok: false,
        error: "Bot Discord nie jest jeszcze gotowy."
      });
    }

    const channel = findOrdersChannel();

    if (!channel) {
      return res.status(404).json({
        ok: false,
        error: `Nie znaleziono kanału zawierającego nazwę "${ORDER_CHANNEL_NAME}".`
      });
    }

    await channel.send(
      "🧪 **TEST KUPUJEMY**\nBot oraz API działają poprawnie! ✅"
    );

    res.json({
      ok: true,
      message: "Wiadomość testowa została wysłana.",
      channel: channel.name
    });

  } catch (error) {

    console.error("Błąd /api/test:", error);

    res.status(500).json({
      ok: false,
      error: "Nie udało się wysłać wiadomości testowej."
    });
  }
});

/* =========================
   ODBIERANIE ZAMÓWIENIA
========================= */

app.post("/api/order", async (req, res) => {

  try {

    console.log("📨 Otrzymano żądanie zamówienia.");

    /* -------------------------
       OPCJONALNY KLUCZ API
    ------------------------- */

    if (
      process.env.ORDER_API_KEY &&
      req.headers["x-order-key"] !== process.env.ORDER_API_KEY
    ) {

      console.log("❌ Nieprawidłowy ORDER_API_KEY.");

      return res.status(401).json({
        ok: false,
        error: "Nieprawidłowy klucz API."
      });
    }

    /* -------------------------
       SPRAWDZENIE BOTA
    ------------------------- */

    if (!client.isReady()) {

      console.log("❌ Bot Discord nie jest gotowy.");

      return res.status(503).json({
        ok: false,
        error: "Bot Discord nie jest jeszcze gotowy."
      });
    }

    /* -------------------------
       DANE ZAMÓWIENIA
    ------------------------- */

    const {
      discord,
      payment,
      extra,
      items,
      total,
      baseTotal,
      surcharge
    } = req.body || {};

    console.log("📦 Dane zamówienia:", req.body);

    /* -------------------------
       WALIDACJA
    ------------------------- */

    if (
      !discord ||
      !payment ||
      !Array.isArray(items) ||
      items.length === 0
    ) {

      return res.status(400).json({
        ok: false,
        error: "Brak wymaganych danych zamówienia."
      });
    }

    if (!["BLIK", "Paysafecard"].includes(payment)) {

      return res.status(400).json({
        ok: false,
        error: "Nieprawidłowa metoda płatności."
      });
    }

    /* -------------------------
       KANAŁ ZAMÓWIENIA
    ------------------------- */

    const channel = findOrdersChannel();

    if (!channel) {

      console.log(
        `❌ Nie znaleziono kanału "${ORDER_CHANNEL_NAME}".`
      );

      return res.status(404).json({
        ok: false,
        error: `Nie znaleziono kanału "${ORDER_CHANNEL_NAME}".`
      });
    }

    console.log(
      `✅ Znaleziono kanał zamówień: ${channel.name}`
    );

    /* =========================
       PRODUKTY
    ========================= */

    const productLines = items
      .map(item => {

        const quantity = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const name = String(item.name || "Produkt");

        return `• ${quantity}× ${name} — ${price} zł`;
      })
      .join("\n");

    /* =========================
       KATEGORIA
    ========================= */

    let category = "Inne gry";

    if (
      items.some(item =>
        String(item.name)
          .toLowerCase()
          .startsWith("minecraft")
      )
    ) {

      category = "Minecraft Premium";

    } else if (
      items.some(item =>
        String(item.name)
          .toLowerCase()
          .startsWith("konfiguracja discord")
      )
    ) {

      category = "Konfiguracja Discord";
    }

    /* =========================
       KWOTY
    ========================= */

    const numericBaseTotal = Number(
      baseTotal !== undefined ? baseTotal : total
    );

    const numericSurcharge = Number(
      surcharge || 0
    );

    const numericTotal = Number(
      total || numericBaseTotal + numericSurcharge
    );

    /* =========================
       EMBED
    ========================= */

    const embed = new EmbedBuilder()
      .setTitle("🛒 NOWE ZAMÓWIENIE — KUPUJEMY")
      .setColor(0x57F287)

      .addFields(

        {
          name: "📦 Kategoria",
          value: category,
          inline: true
        },

        {
          name: "🛍️ Produkty",
          value: productLines.slice(0, 1024),
          inline: false
        },

        {
          name: "💰 Kwota bazowa",
          value:
            `${numericBaseTotal.toFixed(2).replace(".00", "")} zł`,
          inline: true
        },

        {
          name: "💳 Płatność",
          value: payment,
          inline: true
        },

        {
          name: "💵 Do zapłaty",
          value:
            `${numericTotal.toFixed(2).replace(".00", "")} zł`,
          inline: true
        },

        {
          name: "👤 Discord",
          value: String(discord).slice(0, 1024),
          inline: true
        },

        {
          name: "📝 Dodatkowe informacje",
          value: String(extra || "Brak").slice(0, 1024),
          inline: false
        }

      )

      .setFooter({
        text: `Kupujemy • ${new Date().toLocaleString("pl-PL")}`
      })

      .setTimestamp();

    /* =========================
       PAYSAFE CARD +10%
    ========================= */

    if (payment === "Paysafecard") {

      embed.addFields({
        name: "➕ Dopłata Paysafecard",
        value:
          `+10% = ${numericSurcharge.toFixed(2).replace(".00", "")} zł`,
        inline: true
      });
    }

    /* =========================
       PRZYCISKI
    ========================= */

    const row = new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId("order_realize")
          .setLabel("REALIZUJ")
          .setEmoji("🟢")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("order_cancel")
          .setLabel("ANULUJ")
          .setEmoji("🔴")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("order_accept")
          .setLabel("ZATWIERDŹ")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Primary)

      );

    /* =========================
       WYSŁANIE NA DISCORD
    ========================= */

    await channel.send({

      content:
        "📨 **NOWE ZAMÓWIENIE!**\n" +
        "🔔 Prosimy o sprawdzenie szczegółów poniżej.",

      embeds: [embed],

      components: [row]

    });

    console.log("✅ Zamówienie wysłane na Discorda.");

    /* =========================
       ODPOWIEDŹ DLA STRONY
    ========================= */

    return res.json({
      ok: true,
      message: "Zamówienie zostało wysłane."
    });

  } catch (error) {

    console.error("❌ BŁĄD API ZAMÓWIENIA:");
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: "Wystąpił błąd podczas wysyłania zamówienia."
    });
  }
});

/* =========================
   OBSŁUGA PRZYCISKÓW
========================= */

client.on("interactionCreate", async interaction => {

  try {

    if (!interaction.isButton()) return;

    const allowedButtons = [
      "order_realize",
      "order_cancel",
      "order_accept"
    ];

    if (!allowedButtons.includes(interaction.customId)) {
      return;
    }

    const messages = {

      order_realize:
        "🟢 **Zamówienie oznaczone jako REALIZOWANE.**",

      order_cancel:
        "🔴 **Zamówienie ANULOWANE.**",

      order_accept:
        "✅ **Zamówienie ZATWIERDZONE.**"

    };

    await interaction.reply({

      content:
        `${messages[interaction.customId]}\n` +
        `👤 Obsługa: ${interaction.user}`,

      ephemeral: false

    });

  } catch (error) {

    console.error(
      "❌ Błąd podczas obsługi przycisku:",
      error
    );

  }

});

/* =========================
   KOMENDA !TEST
========================= */

client.on("messageCreate", async message => {

  try {

    if (message.author.bot) return;

    if (message.content.trim() === "!test") {

      await message.reply(
        "✅ **Kupujemy-BOT działa poprawnie!**"
      );
    }

  } catch (error) {

    console.error(
      "❌ Błąd komendy !test:",
      error
    );

  }

});

/* =========================
   BOT READY
========================= */

client.once("ready", () => {

  console.log("");
  console.log("=================================");
  console.log("✅ KUPUJEMY BOT URUCHOMIONY");
  console.log("=================================");

  console.log(
    `🤖 Bot: ${client.user.tag}`
  );

  console.log(
    `🌐 Port API: ${PORT}`
  );

  console.log(
    `📨 Kanał zamówień: ${ORDER_CHANNEL_NAME}`
  );

  console.log(
    `🏠 Serwery: ${client.guilds.cache.size}`
  );

  console.log("=================================");
  console.log("");

});

/* =========================
   START HTTP
========================= */

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `🌐 HTTP API działa na porcie ${PORT}`
  );

});

/* =========================
   LOGOWANIE DISCORD
========================= */

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ BRAK DISCORD_TOKEN W ENVIRONMENT VARIABLES!"
  );

} else {

  client.login(process.env.DISCORD_TOKEN)
    .then(() => {
      console.log("🔐 Logowanie do Discorda rozpoczęte.");
    })
    .catch(error => {
      console.error(
        "❌ Nie udało się zalogować do Discorda:"
      );
      console.error(error);
    });

}
