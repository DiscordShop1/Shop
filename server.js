const express = require("express");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const app = express();

const PORT = process.env.PORT || 3000;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================================================
   ZAMÓWIENIA ZE STRONY
========================================================= */

app.post("/api/order", async (req, res) => {
  try {
    const { customer, cart, total } = req.body;

    if (!customer || !cart || !cart.length) {
      return res.status(400).json({
        error: "Nieprawidłowe zamówienie."
      });
    }

    const orderId = "ORD-" + Date.now();

    const products = cart
      .map(
        item =>
          `• ${item.name} × ${item.quantity} — ${(item.price * item.quantity).toFixed(2)} zł`
      )
      .join("\n");

    const message =
      `🛒 **NOWE ZAMÓWIENIE ${orderId}**\n\n` +
      `👤 **Klient:** ${customer.name}\n` +
      `📞 **Kontakt:** ${customer.contact}\n` +
      `💬 **Wiadomość:** ${customer.message || "Brak"}\n\n` +
      `📦 **Produkty:**\n${products}\n\n` +
      `💰 **Suma:** ${Number(total).toFixed(2)} zł`;

    if (DISCORD_WEBHOOK_URL) {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: message
        })
      });
    }

    if (discordClient.isReady() && ORDERS_CHANNEL_ID) {
      const channel = await discordClient.channels
        .fetch(ORDERS_CHANNEL_ID)
        .catch(() => null);

      if (channel && channel.isTextBased()) {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x55ff91)
              .setTitle(`🛒 Nowe zamówienie ${orderId}`)
              .addFields(
                {
                  name: "👤 Klient",
                  value: String(customer.name).slice(0, 1024)
                },
                {
                  name: "📞 Kontakt",
                  value: String(customer.contact).slice(0, 1024)
                },
                {
                  name: "📦 Produkty",
                  value: products.slice(0, 1024)
                },
                {
                  name: "💰 Suma",
                  value: `${Number(total).toFixed(2)} zł`
                },
                {
                  name: "💬 Wiadomość",
                  value: String(customer.message || "Brak").slice(0, 1024)
                }
              )
              .setTimestamp()
          ]
        });
      }
    }

    console.log("Otrzymano zamówienie:", req.body);

    res.json({
      success: true,
      orderId
    });

  } catch (error) {
    console.error("Błąd zamówienia:", error);

    res.status(500).json({
      error: "Nie udało się wysłać zamówienia."
    });
  }
});

/* =========================================================
   DISCORD BOT
========================================================= */

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

discordClient.once("ready", () => {
  console.log(`🤖 Bot zalogowany jako ${discordClient.user.tag}`);
});

/* =========================================================
   AUTOMATYCZNA ODPOWIEDŹ NA TICKET
========================================================= */

discordClient.on("messageCreate", async message => {
  try {
    if (message.author.bot) return;

    /*
      Bot reaguje tylko na wiadomości zawierające
      słowa związane ze złożeniem zamówienia.
    */

    const text = message.content.toLowerCase();

    const orderWords = [
      "złożyłem zamówienie",
      "zlozylem zamowienie",
      "złożyłam zamówienie",
      "zlozylam zamowienie",
      "złożyłem zamowienie",
      "zlozylem zamowienie",
      "zamówiłem",
      "zamowilem",
      "zamówiłam",
      "zamowilam"
    ];

    const isOrderMessage = orderWords.some(word =>
      text.includes(word)
    );

    if (!isOrderMessage) return;

    await sendMainMenu(message.channel);

  } catch (error) {
    console.error("Błąd messageCreate:", error);
  }
});

/* =========================================================
   MENU GŁÓWNE
========================================================= */

async function sendMainMenu(channel) {
  const embed = new EmbedBuilder()
    .setColor(0x55ff91)
    .setTitle("👋 W jaki sposób możemy Ci pomóc?")
    .setDescription(
      "Zaznacz, co Cię sprowadza:\n\n" +
      "🛒 **Zamówienie** — chcesz złożyć zamówienie.\n" +
      "🆘 **Pomoc** — masz pytanie lub problem."
    )
    .setFooter({
      text: "KupGraj • Obsługa klienta"
    });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("help_type")
    .setPlaceholder("📋 Wybierz opcję...")
    .addOptions([
      {
        label: "Zamówienie",
        description: "Chcę złożyć zamówienie",
        value: "order",
        emoji: "🛒"
      },
      {
        label: "Pomoc",
        description: "Potrzebuję pomocy",
        value: "help",
        emoji: "🆘"
      }
    ]);

  await channel.send({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  });
}

/* =========================================================
   INTERAKCJE DISCORD
========================================================= */

discordClient.on("interactionCreate", async interaction => {
  try {

    /* -------------------------
       MENU ZAMÓWIENIE / POMOC
    ------------------------- */

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "help_type"
    ) {

      if (interaction.values[0] === "order") {
        await showProducts(interaction);
      }

      if (interaction.values[0] === "help") {
        await showHelpModal(interaction);
      }

      return;
    }

    /* -------------------------
       WYBÓR PRODUKTU
    ------------------------- */

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "product_select"
    ) {

      const product = interaction.values[0];

      await showPaymentMenu(interaction, product);

      return;
    }

    /* -------------------------
       WYBÓR PŁATNOŚCI
    ------------------------- */

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "payment_select"
    ) {

      const [product, payment] =
        interaction.values[0].split("|");

      await showSummary(
        interaction,
        product,
        payment
      );

      return;
    }

    /* -------------------------
       PRZYCISKI
    ------------------------- */

    if (interaction.isButton()) {

      if (interaction.customId.startsWith("confirm_order|")) {

        const [, product, payment] =
          interaction.customId.split("|");

        await confirmOrder(
          interaction,
          product,
          payment
        );

        return;
      }

      if (interaction.customId === "cancel_order") {

        await interaction.update({
          content: "❌ Zamówienie zostało anulowane.",
          embeds: [],
          components: []
        });

        return;
      }
    }

  } catch (error) {
    console.error("Błąd interactionCreate:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Wystąpił błąd. Spróbuj ponownie.",
        ephemeral: true
      });
    }
  }
});

/* =========================================================
   PRODUKTY
========================================================= */

async function showProducts(interaction) {

  const menu = new StringSelectMenuBuilder()
    .setCustomId("product_select")
    .setPlaceholder("📦 Wybierz produkt...")
    .addOptions([
      {
        label: "Minecraft — KOSZT KONTA",
        description: "25 zł • Konto bez dostępu do maila",
        value: "Minecraft — KOSZT KONTA|25",
        emoji: "⛏️"
      },
      {
        label: "Minecraft — PEŁNY DOSTĘP",
        description: "35 zł • Konto + dostęp do maila",
        value: "Minecraft — PEŁNY DOSTĘP|35",
        emoji: "💎"
      },
      {
        label: "Discord — START",
        description: "20 zł • Podstawowa konfiguracja",
        value: "Discord — START|20",
        emoji: "⚙️"
      },
      {
        label: "Discord — PRO",
        description: "40 zł • Rozbudowana konfiguracja",
        value: "Discord — PRO|40",
        emoji: "🤖"
      },
      {
        label: "Discord — FULL",
        description: "60 zł • Pełna konfiguracja",
        value: "Discord — FULL|60",
        emoji: "🛡️"
      },
      {
        label: "Inne gry",
        description: "Zapytaj o dostępne produkty",
        value: "Inne gry|0",
        emoji: "🎮"
      }
    ]);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle("📦 Jakie zamówienie chcesz złożyć?")
        .setDescription(
          "Wybierz produkt z poniższej listy."
        )
    ],
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  });
}

/* =========================================================
   PŁATNOŚĆ
========================================================= */

async function showPaymentMenu(interaction, product) {

  const [name, price] = product.split("|");

  if (Number(price) === 0) {

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0xa45cff)
          .setTitle("🎮 Inne gry")
          .setDescription(
            "Napisz na tym tickecie, jaką grę chcesz zamówić.\n\n" +
            "Obsługa odpowie Ci z dostępnością i ceną."
          )
      ],
      components: []
    });

    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("payment_select")
    .setPlaceholder("💳 Wybierz metodę płatności...")
    .addOptions([
      {
        label: "BLIK",
        description: `${price} zł`,
        value: `${name}|${price}|BLIK`,
        emoji: "💵"
      },
      {
        label: "PaySafeCard",
        description: `${(Number(price) * 1.10).toFixed(2)} zł (+10%)`,
        value: `${name}|${price}|PaySafeCard`,
        emoji: "🎫"
      }
    ]);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle("💳 Wybierz metodę płatności")
        .setDescription(
          `**Produkt:** ${name}\n` +
          `**Cena:** ${price} zł\n\n` +
          "🎫 PaySafeCard — doliczane +10%."
        )
    ],
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  });
}

/* =========================================================
   PODSUMOWANIE
========================================================= */

async function showSummary(interaction, product, payment) {

  const parts = product.split("|");

  const name = parts[0];
  const price = Number(parts[1]);

  const finalPrice =
    payment === "PaySafeCard"
      ? price * 1.10
      : price;

  const confirmButton =
    new ButtonBuilder()
      .setCustomId(
        `confirm_order|${name}|${payment}|${finalPrice}`
      )
      .setLabel("Potwierdź")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success);

  const cancelButton =
    new ButtonBuilder()
      .setCustomId("cancel_order")
      .setLabel("Anuluj")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle("🧾 Podsumowanie zamówienia")
        .setDescription(
          `📦 **Produkt:** ${name}\n` +
          `💰 **Cena:** ${finalPrice.toFixed(2)} zł\n` +
          `💳 **Płatność:** ${payment}\n\n` +
          "Czy wszystko się zgadza?"
        )
    ],
    components: [
      new ActionRowBuilder().addComponents(
        confirmButton,
        cancelButton
      )
    ]
  });
}

/* =========================================================
   POTWIERDZENIE
========================================================= */

async function confirmOrder(
  interaction,
  product,
  payment
) {

  const parts = product.split("|");

  const name = parts[0];
  const price = Number(parts[1]);

  const finalPrice =
    payment === "PaySafeCard"
      ? price * 1.10
      : price;

  const orderId =
    "DC-" + Date.now();

  const orderEmbed =
    new EmbedBuilder()
      .setColor(0x55ff91)
      .setTitle(`🛒 NOWE ZAMÓWIENIE ${orderId}`)
      .addFields(
        {
          name: "👤 Klient",
          value: `<@${interaction.user.id}>`
        },
        {
          name: "📦 Produkt",
          value: name
        },
        {
          name: "💳 Płatność",
          value: payment
        },
        {
          name: "💰 Kwota",
          value: `${finalPrice.toFixed(2)} zł`
        }
      )
      .setTimestamp();

  if (ORDERS_CHANNEL_ID) {

    const ordersChannel =
      await discordClient.channels
        .fetch(ORDERS_CHANNEL_ID)
        .catch(() => null);

    if (
      ordersChannel &&
      ordersChannel.isTextBased()
    ) {

      const row =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(`realize|${orderId}`)
            .setLabel("Realizuj")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(`cancel_admin|${orderId}`)
            .setLabel("Anuluj")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId(`approve|${orderId}`)
            .setLabel("Zatwierdź")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Primary)

        );

      await ordersChannel.send({
        embeds: [orderEmbed],
        components: [row]
      });
    }
  }

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle("✅ Zamówienie przyjęte!")
        .setDescription(
          `Twoje zamówienie **${orderId}** zostało przekazane do obsługi.\n\n` +
          `📦 **${name}**\n` +
          `💰 **${finalPrice.toFixed(2)} zł**\n` +
          `💳 **${payment}**\n\n` +
          "⏳ Poczekaj na wiadomość od obsługi."
        )
    ],
    components: []
  });
}

/* =========================================================
   POMOC — FORMULARZ
========================================================= */

async function showHelpModal(interaction) {

  const modal =
    new ModalBuilder()
      .setCustomId("help_modal")
      .setTitle("🆘 Pomoc");

  const problem =
    new TextInputBuilder()
      .setCustomId("problem")
      .setLabel("W czym możemy Ci pomóc?")
      .setPlaceholder(
        "Opisz dokładnie swój problem..."
      )
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(problem)
  );

  await interaction.showModal(modal);
}

discordClient.on("interactionCreate", async interaction => {

  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "help_modal") {

    const problem =
      interaction.fields.getTextInputValue("problem");

    const embed =
      new EmbedBuilder()
        .setColor(0xa45cff)
        .setTitle("🆘 Prośba o pomoc")
        .addFields(
          {
            name: "👤 Użytkownik",
            value: `<@${interaction.user.id}>`
          },
          {
            name: "📝 Problem",
            value: problem
          }
        )
        .setTimestamp();

    await interaction.reply({
      content:
        "✅ Twoja wiadomość została wysłana do obsługi.",
      ephemeral: true
    });

    await interaction.channel.send({
      embeds: [embed]
    });
  }
});

/* =========================================================
   START BOTA
========================================================= */

if (DISCORD_TOKEN) {

  discordClient.login(DISCORD_TOKEN)
    .catch(error => {
      console.error(
        "❌ Nie udało się zalogować bota:",
        error
      );
    });

} else {

  console.warn(
    "⚠️ Brak DISCORD_TOKEN — bot Discord nie został uruchomiony."
  );

}

/* =========================================================
   START SERWERA
========================================================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🌐 Sklep działa na porcie ${PORT}`
  );
});
