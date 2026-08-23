require("dotenv").config();

const path = require("path");
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

/* =========================================================
   KONFIGURACJA
========================================================= */

const PORT = process.env.PORT || 3000;
const ORDER_CHANNEL_NAME = "zamówienia";

/*
  Strona i bot działają na tym samym Render Web Service.
  Pliki:
  index.html
  style.css
  script.js
  banner.png
  bot.js
*/

/* =========================================================
   EXPRESS
========================================================= */

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-order-key"]
}));

app.use(express.json({
  limit: "100kb"
}));

/*
  Udostępniamy pliki strony z głównego folderu projektu.
  Dzięki temu:
  /              -> index.html
  /style.css     -> style.css
  /script.js     -> script.js
  /banner.png    -> banner.png
*/
app.use(express.static(__dirname));

/* =========================================================
   DISCORD BOT
========================================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =========================================================
   ZNAJDOWANIE KANAŁU ZAMÓWIENIA
========================================================= */

function findOrdersChannel(guild) {
  return guild.channels.cache.find(channel =>
    channel.isTextBased() &&
    channel.name.toLowerCase().includes(ORDER_CHANNEL_NAME.toLowerCase())
  );
}

/* =========================================================
   STRONA GŁÓWNA
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    discord: client.isReady(),
    bot: client.isReady() ? client.user.tag : null,
    service: "Kupujemy — Sklep + Discord Bot"
  });
});

/* =========================================================
   TEST DISCORDA
========================================================= */

app.get("/api/test", async (req, res) => {
  try {
    if (!client.isReady()) {
      return res.status(503).json({
        ok: false,
        error: "Bot Discord nie jest jeszcze gotowy."
      });
    }

    const guild = client.guilds.cache.first();

    if (!guild) {
      return res.status(503).json({
        ok: false,
        error: "Bot nie znajduje serwera Discord."
      });
    }

    const channel = findOrdersChannel(guild);

    if (!channel) {
      return res.status(404).json({
        ok: false,
        error: `Nie znaleziono kanału ${ORDER_CHANNEL_NAME}.`
      });
    }

    await channel.send(
      "🧪 **TEST KUPUJEMY**\n" +
      "Bot, API i kanał zamówień działają poprawnie! ✅"
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

/* =========================================================
   API — NOWE ZAMÓWIENIE
========================================================= */

app.post("/api/order", async (req, res) => {
  try {

    /* -----------------------------------------------------
       OPCJONALNY KLUCZ API
    ----------------------------------------------------- */

    if (
      process.env.ORDER_API_KEY &&
      req.headers["x-order-key"] !== process.env.ORDER_API_KEY
    ) {
      return res.status(401).json({
        ok: false,
        error: "Nieprawidłowy klucz API."
      });
    }

    /* -----------------------------------------------------
       SPRAWDZENIE BOTA
    ----------------------------------------------------- */

    if (!client.isReady()) {
      return res.status(503).json({
        ok: false,
        error: "Bot Discord nie jest jeszcze gotowy."
      });
    }

    /* -----------------------------------------------------
       DANE ZAMÓWIENIA
    ----------------------------------------------------- */

    const {
      discord,
      payment,
      extra,
      items,
      total,
      baseTotal,
      surcharge
    } = req.body || {};

    if (
      !discord ||
      !payment ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return res.status(400).json({
        ok: false,
        error: "Brak wymaganych danych zamówienia."
      });
    }

    /* -----------------------------------------------------
       PŁATNOŚĆ
    ----------------------------------------------------- */

    if (!["BLIK", "Paysafecard"].includes(payment)) {
      return res.status(400).json({
        ok: false,
        error: "Nieprawidłowa metoda płatności."
      });
    }

    /* -----------------------------------------------------
       SERWER DISCORD
    ----------------------------------------------------- */

    const guild = client.guilds.cache.first();

    if (!guild) {
      return res.status(503).json({
        ok: false,
        error: "Bot nie znajduje serwera Discord."
      });
    }

    /* -----------------------------------------------------
       KANAŁ ZAMÓWIENIA
    ----------------------------------------------------- */

    const channel = findOrdersChannel(guild);

    if (!channel) {
      return res.status(404).json({
        ok: false,
        error: `Nie znaleziono kanału ${ORDER_CHANNEL_NAME}.`
      });
    }

    /* -----------------------------------------------------
       PRODUKTY
    ----------------------------------------------------- */

    const productLines = items
      .map(item => {
        const quantity = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const name = String(item.name || "Nieznany produkt");

        return `• ${quantity}× ${name} — ${(price * quantity).toFixed(2).replace(".00", "")} zł`;
      })
      .join("\n");

    /* -----------------------------------------------------
       KATEGORIA
    ----------------------------------------------------- */

    const itemNames = items
      .map(item => String(item.name || "").toLowerCase())
      .join(" ");

    let category = "Inne gry";

    if (
      itemNames.includes("minecraft") ||
      itemNames.includes("mc premium")
    ) {
      category = "Minecraft Premium";
    } else if (
      itemNames.includes("discord") ||
      itemNames.includes("konfiguracja")
    ) {
      category = "Konfiguracja Discord";
    }

    /* -----------------------------------------------------
       KWOTY
    ----------------------------------------------------- */

    const safeBaseTotal = Number(baseTotal || total || 0);
    const safeSurcharge = Number(surcharge || 0);
    const safeTotal = Number(
      total || safeBaseTotal + safeSurcharge
    );

    /* -----------------------------------------------------
       EMBED
    ----------------------------------------------------- */

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
          name: "💳 Płatność",
          value: payment,
          inline: true
        },
        {
          name: "👤 Discord",
          value: String(discord).slice(0, 1024),
          inline: true
        },
        {
          name: "🛍️ Produkty",
          value: productLines.slice(0, 1024),
          inline: false
        },
        {
          name: "💰 Kwota bazowa",
          value: `${safeBaseTotal.toFixed(2).replace(".00", "")} zł`,
          inline: true
        },
        {
          name: "💵 Do zapłaty",
          value: `${safeTotal.toFixed(2).replace(".00", "")} zł`,
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

    /* -----------------------------------------------------
       DOPŁATA PAYSAFECARD
    ----------------------------------------------------- */

    if (payment === "Paysafecard") {
      embed.addFields({
        name: "➕ Dopłata Paysafecard",
        value:
          `+10% = ${safeSurcharge.toFixed(2).replace(".00", "")} zł`,
        inline: true
      });
    }

    /* -----------------------------------------------------
       PRZYCISKI
    ----------------------------------------------------- */

    const row = new ActionRowBuilder().addComponents(

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

    /* -----------------------------------------------------
       WYSŁANIE ZAMÓWIENIA
    ----------------------------------------------------- */

    const sentMessage = await channel.send({
      content: "📨 **NOWE ZAMÓWIENIE!**",
      embeds: [embed],
      components: [row]
    });

    console.log(
      `📦 Nowe zamówienie wysłane. ID wiadomości: ${sentMessage.id}`
    );

    /* -----------------------------------------------------
       ODPOWIEDŹ DO STRONY
    ----------------------------------------------------- */

    res.json({
      ok: true,
      message: "Zamówienie zostało wysłane do Discorda.",
      orderMessageId: sentMessage.id,
      channel: channel.name
    });

  } catch (error) {

    console.error("❌ Błąd podczas obsługi zamówienia:");
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Wystąpił błąd podczas wysyłania zamówienia."
    });
  }
});

/* =========================================================
   PRZYCISKI DISCORD
========================================================= */

client.on("interactionCreate", async interaction => {

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

  try {

    await interaction.reply({
      content:
        `${messages[interaction.customId]}\n` +
        `👤 Obsługa: ${interaction.user}`,
      ephemeral: false
    });

    console.log(
      `🔘 ${interaction.customId} użyte przez ${interaction.user.tag}`
    );

  } catch (error) {

    console.error(
      "❌ Błąd podczas obsługi przycisku:",
      error
    );

  }

});

/* =========================================================
   KOMENDA !test
========================================================= */

client.on("messageCreate", async message => {

  if (message.author.bot) return;

  if (message.content.trim() === "!test") {

    await message.reply(
      "✅ **Kupujemy-BOT działa poprawnie!**\n" +
      "🌐 API działa\n" +
      "🤖 Discord działa\n" +
      "🛒 Sklep działa"
    );

  }

});

/* =========================================================
   BOT READY
========================================================= */

client.once("ready", () => {

  console.log("========================================");
  console.log("✅ KUPUJEMY BOT URUCHOMIONY");
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📨 Kanał zamówień: ${ORDER_CHANNEL_NAME}`);
  console.log("========================================");

});

/* =========================================================
   BŁĘDY DISCORDA
========================================================= */

client.on("error", error => {
  console.error("❌ Discord Client Error:", error);
});

/* =========================================================
   START SERWERA HTTP
========================================================= */

app.listen(PORT, "0.0.0.0", () => {

  console.log("========================================");
  console.log("🌐 KUPUJEMY WEB SERVICE URUCHOMIONY");
  console.log(`🚀 Port: ${PORT}`);
  console.log("📄 Strona: index.html");
  console.log("🎨 CSS: style.css");
  console.log("⚙️ JS: script.js");
  console.log("🖼️ Obrazy: pliki z folderu projektu");
  console.log("========================================");

});

/* =========================================================
   LOGOWANIE BOTA
========================================================= */

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ BRAK DISCORD_TOKEN W ENVIRONMENT VARIABLES!"
  );

} else {

  client.login(process.env.DISCORD_TOKEN)
    .then(() => {
      console.log("🔐 Token Discord został zaakceptowany.");
    })
    .catch(error => {
      console.error(
        "❌ Nie udało się zalogować bota Discord:",
        error
      );
    });

}