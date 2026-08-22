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
  TextInputStyle,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const app = express();

/* =========================================================
   USTAWIENIA
========================================================= */

const PORT = process.env.PORT || 3000;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const ORDERS_CHANNEL_ID =
  process.env.ORDERS_CHANNEL_ID;

const ORDERS_LOG_CHANNEL_ID =
  process.env.ORDERS_LOG_CHANNEL_ID ||
  ORDERS_CHANNEL_ID;

const STAFF_ROLE_ID =
  process.env.STAFF_ROLE_ID || "";

const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL || "";

/*
  Nazwa kategorii, pod którą będą tworzone prywatne kanały.
  Jeśli nie podasz CATEGORY_ID, bot utworzy kanał bez kategorii.
*/
const CATEGORY_ID =
  process.env.CATEGORY_ID || "";

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================================================
   DISCORD CLIENT
========================================================= */

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],

  partials: [
    Partials.Channel,
    Partials.Message
  ]
});

/* =========================================================
   POMOCNICZE
========================================================= */

async function getChannel(channelId) {
  if (!channelId) return null;

  return discordClient.channels
    .fetch(channelId)
    .catch(() => null);
}

function isServerOwner(interaction) {
  if (!interaction.guild) return false;

  return (
    interaction.user.id ===
    interaction.guild.ownerId
  );
}

function isStaff(interaction) {
  if (!interaction.guild) return false;

  if (isServerOwner(interaction)) {
    return true;
  }

  if (
    interaction.member &&
    interaction.member.permissions &&
    interaction.member.permissions.has(
      PermissionsBitField.Flags.ManageGuild
    )
  ) {
    return true;
  }

  if (
    STAFF_ROLE_ID &&
    interaction.member &&
    interaction.member.roles &&
    interaction.member.roles.cache.has(
      STAFF_ROLE_ID
    )
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   PRODUKTY
========================================================= */

const PRODUCTS = {
  mc_konto: {
    name: "Minecraft — KOSZT KONTA",
    price: 25,
    emoji: "⛏️"
  },

  mc_pelny: {
    name: "Minecraft — PEŁNY DOSTĘP",
    price: 35,
    emoji: "💎"
  },

  dc_start: {
    name: "Discord — START",
    price: 20,
    emoji: "⚙️"
  },

  dc_pro: {
    name: "Discord — PRO",
    price: 40,
    emoji: "🤖"
  },

  dc_full: {
    name: "Discord — FULL",
    price: 60,
    emoji: "🛡️"
  },

  inne_gry: {
    name: "Inne gry",
    price: 0,
    emoji: "🎮"
  }
};

/* =========================================================
   PRZECHOWYWANIE ZAMÓWIEŃ
========================================================= */

const pendingOrders = new Map();

/*
  pendingOrders:

  userId -> {
    productId,
    payment,
    orderId,
    guildId,
    ticketChannelId
  }
*/

/* =========================================================
   WEBHOOK / ZAMÓWIENIE ZE STRONY
========================================================= */

app.post(
  "/api/order",
  async (req, res) => {

    try {

      const {
        customer,
        cart,
        total
      } = req.body;

      if (
        !customer ||
        !cart ||
        !cart.length
      ) {
        return res.status(400).json({
          error:
            "Nieprawidłowe zamówienie."
        });
      }

      const orderId =
        "WEB-" + Date.now();

      const products =
        cart
          .map(item => {

            const quantity =
              Number(item.quantity) || 1;

            const price =
              Number(item.price) || 0;

            return (
              `• ${item.name} × ${quantity} — ` +
              `${(
                price * quantity
              ).toFixed(2)} zł`
            );

          })
          .join("\n");

      const totalPrice =
        Number(total) || 0;

      const message =
        `🛒 **NOWE ZAMÓWIENIE ${orderId}**\n\n` +
        `👤 **Klient:** ${
          customer.name || "Brak"
        }\n` +
        `📞 **Kontakt:** ${
          customer.contact || "Brak"
        }\n` +
        `💬 **Wiadomość:** ${
          customer.message || "Brak"
        }\n\n` +
        `📦 **Produkty:**\n${products}\n\n` +
        `💰 **Suma:** ${
          totalPrice.toFixed(2)
        } zł`;

      /* ===================================================
         WEBHOOK
      =================================================== */

      if (DISCORD_WEBHOOK_URL) {

        try {

          await fetch(
            DISCORD_WEBHOOK_URL,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                content: message
              })
            }
          );

        } catch (error) {

          console.error(
            "❌ Błąd webhooka:",
            error
          );

        }

      }

      /* ===================================================
         KANAŁ ZAMÓWIEŃ
      =================================================== */

      const ordersChannel =
        await getChannel(
          ORDERS_CHANNEL_ID
        );

      if (
        ordersChannel &&
        ordersChannel.isTextBased()
      ) {

        const embed =
          new EmbedBuilder()
            .setColor(0x55ff91)
            .setTitle(
              `🛒 Nowe zamówienie ${orderId}`
            )
            .addFields(

              {
                name: "👤 Klient",
                value:
                  String(
                    customer.name ||
                    "Brak"
                  ).slice(0, 1024)
              },

              {
                name: "📞 Kontakt",
                value:
                  String(
                    customer.contact ||
                    "Brak"
                  ).slice(0, 1024)
              },

              {
                name: "📦 Produkty",
                value:
                  String(
                    products ||
                    "Brak"
                  ).slice(0, 1024)
              },

              {
                name: "💰 Suma",
                value:
                  `${totalPrice.toFixed(2)} zł`
              },

              {
                name: "💬 Wiadomość",
                value:
                  String(
                    customer.message ||
                    "Brak"
                  ).slice(0, 1024)
              }

            )
            .setTimestamp();

        await ordersChannel.send({
          embeds: [embed]
        });

      }

      console.log(
        "📦 Otrzymano zamówienie ze strony:",
        orderId
      );

      return res.json({
        success: true,
        orderId
      });

    } catch (error) {

      console.error(
        "❌ Błąd /api/order:",
        error
      );

      return res.status(500).json({
        error:
          "Nie udało się wysłać zamówienia."
      });

    }

  }
);

/* =========================================================
   GOTOWOŚĆ
========================================================= */

discordClient.once(
  "ready",
  () => {

    console.log(
      `🤖 Bot zalogowany jako ${
        discordClient.user.tag
      }`
    );

    console.log(
      `📨 ORDERS_CHANNEL_ID: ${
        ORDERS_CHANNEL_ID ||
        "BRAK"
      }`
    );

    console.log(
      `👮 STAFF_ROLE_ID: ${
        STAFF_ROLE_ID ||
        "BRAK — używane będą uprawnienia Manage Server"
      }`
    );

    console.log(
      "🎫 System prywatnych kanałów zamówień: AKTYWNY"
    );

  }
);

/* =========================================================
   MESSAGE CREATE
========================================================= */

const menuCooldown =
  new Set();

discordClient.on(
  "messageCreate",
  async message => {

    try {

      if (message.author.bot) {
        return;
      }

      if (!message.guild) {
        return;
      }

      const text =
        message.content
          .toLowerCase()
          .trim();

      const orderWords = [

        "złożyłem zamówienie",
        "zlozylem zamowienie",

        "złożyłam zamówienie",
        "zlozylam zamowienie",

        "zamówiłem",
        "zamowilem",

        "zamówiłam",
        "zamowilam",

        "chcę zamówić",
        "chce zamowic",

        "chcę złożyć zamówienie",
        "chce zlozyc zamowienie",

        "zamówienie",
        "zamowienie"

      ];

      const isOrderMessage =
        orderWords.some(
          word =>
            text.includes(word)
        );

      if (!isOrderMessage) {
        return;
      }

      if (
        menuCooldown.has(
          message.channel.id
        )
      ) {
        return;
      }

      menuCooldown.add(
        message.channel.id
      );

      setTimeout(
        () => {
          menuCooldown.delete(
            message.channel.id
          );
        },
        15000
      );

      await sendMainMenu(
        message.channel
      );

    } catch (error) {

      console.error(
        "❌ messageCreate:",
        error
      );

    }

  }
);

/* =========================================================
   MENU GŁÓWNE
========================================================= */

async function sendMainMenu(
  channel
) {

  const embed =
    new EmbedBuilder()
      .setColor(0x55ff91)
      .setTitle(
        "👋 W jaki sposób możemy Ci pomóc?"
      )
      .setDescription(
        "Wybierz odpowiednią opcję:\n\n" +
        "🛒 **Zamówienie** — chcesz złożyć zamówienie.\n" +
        "🆘 **Pomoc** — masz pytanie lub problem."
      )
      .setFooter({
        text:
          "KupGraj • Obsługa klienta"
      });

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "help_type"
      )
      .setPlaceholder(
        "📋 Wybierz opcję..."
      )
      .addOptions(

        {
          label: "Zamówienie",
          description:
            "Chcę złożyć zamówienie",
          value: "order",
          emoji: "🛒"
        },

        {
          label: "Pomoc",
          description:
            "Potrzebuję pomocy",
          value: "help",
          emoji: "🆘"
        }

      );

  await channel.send({

    embeds: [
      embed
    ],

    components: [

      new ActionRowBuilder()
        .addComponents(menu)

    ]

  });

}

/* =========================================================
   INTERACTIONS
========================================================= */

discordClient.on(
  "interactionCreate",
  async interaction => {

    try {

      /* ===================================================
         MENU GŁÓWNE
      =================================================== */

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "help_type"
      ) {

        if (
          interaction.values[0] ===
          "order"
        ) {

          await showProducts(
            interaction
          );

        }

        if (
          interaction.values[0] ===
          "help"
        ) {

          await showHelpModal(
            interaction
          );

        }

        return;

      }

      /* ===================================================
         PRODUKT
      =================================================== */

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "product_select"
      ) {

        await showPaymentMenu(
          interaction,
          interaction.values[0]
        );

        return;

      }

      /* ===================================================
         PŁATNOŚĆ
      =================================================== */

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "payment_select"
      ) {

        const [
          productId,
          payment
        ] =
          interaction.values[0]
            .split("|");

        await showSummary(
          interaction,
          productId,
          payment
        );

        return;

      }

      /* ===================================================
         PRZYCISKI
      =================================================== */

      if (
        interaction.isButton()
      ) {

        const id =
          interaction.customId;

        /* ===============================================
           POTWIERDZENIE
        =============================================== */

        if (
          id ===
          "confirm_order"
        ) {

          await startPrivateOrder(
            interaction
          );

          return;

        }

        /* ===============================================
           ANULOWANIE
        =============================================== */

        if (
          id ===
          "cancel_order"
        ) {

          await interaction.update({

            embeds: [

              new EmbedBuilder()
                .setColor(0xff4444)
                .setTitle(
                  "❌ Zamówienie anulowane"
                )
                .setDescription(
                  "Zamówienie zostało anulowane."
                )

            ],

            components: []

          });

          return;

        }

        /* ===============================================
           ANKIETA DM
        =============================================== */

        if (
          id ===
          "fill_order_form"
        ) {

          await showOrderModal(
            interaction
          );

          return;

        }

        /* ===============================================
           ANULOWANIE ZAMÓWIENIA PRZEZ KLIENTA
        =============================================== */

        if (
          id.startsWith(
            "customer_cancel|"
          )
        ) {

          await interaction.update({

            content:
              "❌ Zamówienie zostało anulowane.",

            embeds: [],

            components: []

          });

          pendingOrders.delete(
            interaction.user.id
          );

          return;

        }

        /* ===============================================
           REALIZUJ
        =============================================== */

        if (
          id.startsWith(
            "realize|"
          )
        ) {

          await handleRealize(
            interaction
          );

          return;

        }

        /* ===============================================
           ANULUJ ADMIN
        =============================================== */

        if (
          id.startsWith(
            "cancel_admin|"
          )
        ) {

          await handleAdminCancel(
            interaction
          );

          return;

        }

        /* ===============================================
           ZATWIERDŹ
        =============================================== */

        if (
          id.startsWith(
            "approve|"
          )
        ) {

          await handleApprove(
            interaction
          );

          return;

        }

        /* ===============================================
           ZAMKNIJ KANAŁ
        =============================================== */

        if (
          id.startsWith(
            "close_ticket|"
          )
        ) {

          await closeTicket(
            interaction
          );

          return;

        }

      }

      /* ===================================================
         MODAL POMOCY
      =================================================== */

      if (
        interaction.isModalSubmit() &&
        interaction.customId ===
          "help_modal"
      ) {

        const problem =
          interaction.fields
            .getTextInputValue(
              "problem"
            );

        await interaction.reply({

          content:
            "✅ Twoja wiadomość została przekazana obsłudze.",

          ephemeral: true

        });

        const embed =
          new EmbedBuilder()
            .setColor(0xa45cff)
            .setTitle(
              "🆘 Prośba o pomoc"
            )
            .addFields(

              {
                name:
                  "👤 Użytkownik",

                value:
                  `<@${interaction.user.id}>`
              },

              {
                name:
                  "📝 Problem",

                value:
                  problem.slice(
                    0,
                    1024
                  )
              }

            )
            .setTimestamp();

        if (
          interaction.channel &&
          interaction.channel.isTextBased()
        ) {

          await interaction.channel.send({
            embeds: [embed]
          });

        }

        return;

      }

      /* ===================================================
         MODAL ZAMÓWIENIA
      =================================================== */

      if (
        interaction.isModalSubmit() &&
        interaction.customId ===
          "order_form"
      ) {

        await finishPrivateOrder(
          interaction
        );

        return;

      }

    } catch (error) {

      console.error(
        "❌ interactionCreate:",
        error
      );

      try {

        if (
          !interaction.replied &&
          !interaction.deferred
        ) {

          await interaction.reply({

            content:
              "❌ Wystąpił błąd. Spróbuj ponownie.",

            ephemeral: true

          });

        }

      } catch {}

    }

  }
);

/* =========================================================
   PRODUKTY
========================================================= */

async function showProducts(
  interaction
) {

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "product_select"
      )
      .setPlaceholder(
        "📦 Wybierz produkt..."
      )
      .addOptions(

        {
          label:
            PRODUCTS.mc_konto.name,

          description:
            "25 zł • Konto bez dostępu do maila",

          value:
            "mc_konto",

          emoji:
            "⛏️"
        },

        {
          label:
            PRODUCTS.mc_pelny.name,

          description:
            "35 zł • Konto + dostęp do maila",

          value:
            "mc_pelny",

          emoji:
            "💎"
        },

        {
          label:
            PRODUCTS.dc_start.name,

          description:
            "20 zł • Podstawowa konfiguracja",

          value:
            "dc_start",

          emoji:
            "⚙️"
        },

        {
          label:
            PRODUCTS.dc_pro.name,

          description:
            "40 zł • Rozbudowana konfiguracja",

          value:
            "dc_pro",

          emoji:
            "🤖"
        },

        {
          label:
            PRODUCTS.dc_full.name,

          description:
            "60 zł • Pełna konfiguracja",

          value:
            "dc_full",

          emoji:
            "🛡️"
        },

        {
          label:
            PRODUCTS.inne_gry.name,

          description:
            "Zapytaj o dostępne produkty",

          value:
            "inne_gry",

          emoji:
            "🎮"
        }

      );

  await interaction.update({

    embeds: [

      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle(
          "📦 Wybierz produkt"
        )
        .setDescription(
          "Wybierz produkt, który chcesz zamówić."
        )

    ],

    components: [

      new ActionRowBuilder()
        .addComponents(menu)

    ]

  });

}

/* =========================================================
   PŁATNOŚĆ
========================================================= */

async function showPaymentMenu(
  interaction,
  productId
) {

  const product =
    PRODUCTS[productId];

  if (!product) {

    await interaction.reply({

      content:
        "❌ Nie znaleziono produktu.",

      ephemeral: true

    });

    return;

  }

  if (
    product.price === 0
  ) {

    await interaction.update({

      embeds: [

        new EmbedBuilder()
          .setColor(0xa45cff)
          .setTitle(
            "🎮 Inne gry"
          )
          .setDescription(
            "Napisz na tym tickecie, jaką grę chcesz zamówić.\n\n" +
            "📩 Obsługa odpowie Ci z dostępnością i ceną."
          )

      ],

      components: []

    });

    return;

  }

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "payment_select"
      )
      .setPlaceholder(
        "💳 Wybierz metodę płatności..."
      )
      .addOptions(

        {
          label:
            "BLIK",

          description:
            `${product.price} zł`,

          value:
            `${productId}|BLIK`,

          emoji:
            "💵"
        },

        {
          label:
            "PaySafeCard",

          description:
            `${(
              product.price *
              1.10
            ).toFixed(2)} zł (+10%)`,

          value:
            `${productId}|PaySafeCard`,

          emoji:
            "🎫"
        }

      );

  await interaction.update({

    embeds: [

      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle(
          "💳 Wybierz metodę płatności"
        )
        .setDescription(

          `📦 **Produkt:** ${product.name}\n` +
          `💰 **Cena:** ${product.price.toFixed(2)} zł\n\n` +

          `💵 **BLIK:** ${product.price.toFixed(2)} zł\n` +

          `🎫 **PaySafeCard:** ${(
            product.price *
            1.10
          ).toFixed(2)} zł (+10%)`

        )

    ],

    components: [

      new ActionRowBuilder()
        .addComponents(menu)

    ]

  });

}

/* =========================================================
   PODSUMOWANIE
========================================================= */

async function showSummary(
  interaction,
  productId,
  payment
) {

  const product =
    PRODUCTS[productId];

  if (!product) {
    return;
  }

  const finalPrice =
    payment === "PaySafeCard"
      ? product.price * 1.10
      : product.price;

  const confirmButton =
    new ButtonBuilder()
      .setCustomId(
        "confirm_order"
      )
      .setLabel(
        "Potwierdź zamówienie"
      )
      .setEmoji(
        "✅"
      )
      .setStyle(
        ButtonStyle.Success
      );

  const cancelButton =
    new ButtonBuilder()
      .setCustomId(
        "cancel_order"
      )
      .setLabel(
        "Anuluj"
      )
      .setEmoji(
        "❌"
      )
      .setStyle(
        ButtonStyle.Danger
      );

  /*
    Zapamiętujemy wybór użytkownika.
  */

  pendingOrders.set(
    interaction.user.id,
    {
      productId,
      payment,
      guildId:
        interaction.guild.id,
      ticketChannelId:
        interaction.channel.id
    }
  );

  await interaction.update({

    embeds: [

      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle(
          "🧾 Podsumowanie zamówienia"
        )
        .setDescription(

          `📦 **Produkt:** ${product.name}\n` +
          `💰 **Kwota:** ${finalPrice.toFixed(2)} zł\n` +
          `💳 **Płatność:** ${payment}\n\n` +

          "Czy wszystko się zgadza?\n\n" +

          "Po kliknięciu **Potwierdź zamówienie** otrzymasz prywatną wiadomość od bota."

        )

    ],

    components: [

      new ActionRowBuilder()
        .addComponents(
          confirmButton,
          cancelButton
        )

    ]

  });

}

/* =========================================================
   ROZPOCZĘCIE PRYWATNEGO ZAMÓWIENIA
========================================================= */

async function startPrivateOrder(
  interaction
) {

  const data =
    pendingOrders.get(
      interaction.user.id
    );

  if (!data) {

    await interaction.reply({

      content:
        "❌ Nie znaleziono Twojego zamówienia. Rozpocznij je ponownie.",

      ephemeral: true

    });

    return;

  }

  const product =
    PRODUCTS[data.productId];

  if (!product) {
    return;
  }

  const orderId =
    "KG-" + Date.now();

  data.orderId =
    orderId;

  pendingOrders.set(
    interaction.user.id,
    data
  );

  await interaction.update({

    embeds: [

      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle(
          "📩 Sprawdź prywatną wiadomość"
        )
        .setDescription(
          "Wysłałem Ci wiadomość prywatną z krótką ankietą.\n\n" +
          "Uzupełnij ją, abyśmy mogli utworzyć Twoje zamówienie."
        )

    ],

    components: []

  });

  try {

    const dm =
      await interaction.user.createDM();

    const embed =
      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle(
          "📝 Dane do zamówienia"
        )
        .setDescription(

          `📦 **Produkt:** ${product.name}\n` +
          `💳 **Płatność:** ${data.payment}\n\n` +

          "Kliknij poniższy przycisk i uzupełnij krótką ankietę."

        );

    const button =
      new ButtonBuilder()
        .setCustomId(
          "fill_order_form"
        )
        .setLabel(
          "Uzupełnij ankietę"
        )
        .setEmoji(
          "📝"
        )
        .setStyle(
          ButtonStyle.Primary
        );

    await dm.send({

      embeds: [
        embed
      ],

      components: [

        new ActionRowBuilder()
          .addComponents(button)

      ]

    });

  } catch (error) {

    console.error(
      "❌ Nie można wysłać DM:",
      error
    );

    await interaction.followUp({

      content:
        "❌ Nie mogę wysłać Ci wiadomości prywatnej. Włącz wiadomości prywatne na tym serwerze i spróbuj ponownie.",

      ephemeral: true

    });

  }

}

/* =========================================================
   MODAL ANKIETY
========================================================= */

async function showOrderModal(
  interaction
) {

  const modal =
    new ModalBuilder()
      .setCustomId(
        "order_form"
      )
      .setTitle(
        "📝 Dane zamówienia"
      );

  const contact =
    new TextInputBuilder()
      .setCustomId(
        "contact"
      )
      .setLabel(
        "Kontakt"
      )
      .setPlaceholder(
        "Discord / e-mail / inny kontakt"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(
        100
      );

  const message =
    new TextInputBuilder()
      .setCustomId(
        "message"
      )
      .setLabel(
        "Dodatkowa wiadomość"
      )
      .setPlaceholder(
        "Np. dodatkowe informacje do zamówienia"
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(false)
      .setMaxLength(
        1000
      );

  modal.addComponents(

    new ActionRowBuilder()
      .addComponents(contact),

    new ActionRowBuilder()
      .addComponents(message)

  );

  await interaction.showModal(
    modal
  );

}

/* =========================================================
   FINALIZACJA ZAMÓWIENIA + TWORZENIE KANAŁU
========================================================= */

async function finishPrivateOrder(
  interaction
) {

  const data =
    pendingOrders.get(
      interaction.user.id
    );

  if (!data) {

    await interaction.reply({

      content:
        "❌ Nie znaleziono zamówienia. Rozpocznij je ponownie.",

      ephemeral: true

    });

    return;

  }

  const product =
    PRODUCTS[data.productId];

  if (!product) {
    return;
  }

  const contact =
    interaction.fields
      .getTextInputValue(
        "contact"
      );

  const customerMessage =
    interaction.fields
      .getTextInputValue(
        "message"
      ) || "Brak";

  const finalPrice =
    data.payment ===
    "PaySafeCard"
      ? product.price * 1.10
      : product.price;

  const guild =
    await discordClient.guilds
      .fetch(data.guildId)
      .catch(() => null);

  if (!guild) {

    await interaction.reply({

      content:
        "❌ Nie znaleziono serwera.",

      ephemeral: true

    });

    return;

  }

  /* =====================================================
     SPRAWDZENIE ISTNIEJĄCEGO KANAŁU
  ===================================================== */

  const existingChannel =
    guild.channels.cache.find(
      channel =>
        channel.name ===
        `zamowienie-${interaction.user.username
          .toLowerCase()
          .replace(/[^a-z0-9ąćęłńóśźż]/gi, "-")
          .slice(0, 15)}`
    );

  if (existingChannel) {

    await interaction.reply({

      content:
        `❌ Masz już otwarte zamówienie: ${existingChannel}`,

      ephemeral: true

    });

    return;

  }

  /* =====================================================
     UPRAWNIENIA
  ===================================================== */

  const overwrites = [

    {
      id:
        guild.roles.everyone.id,

      deny:
        [
          PermissionsBitField.Flags.ViewChannel
        ]
    },

    {
      id:
        interaction.user.id,

      allow:
        [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
    },

    {
      id:
        discordClient.user.id,

      allow:
        [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
    }

  ];

  /* =====================================================
     ROLA OBSŁUGI
  ===================================================== */

  if (STAFF_ROLE_ID) {

    overwrites.push({

      id:
        STAFF_ROLE_ID,

      allow:
        [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]

    });

  }

  /* =====================================================
     TWORZENIE KANAŁU
  ===================================================== */

  let orderChannel;

  try {

    orderChannel =
      await guild.channels.create({

        name:
          `zamowienie-${interaction.user.username
            .toLowerCase()
            .replace(
              /[^a-z0-9ąćęłńóśźż]/gi,
              "-"
            )
            .slice(0, 20)}`,

        type:
          ChannelType.GuildText,

        parent:
          CATEGORY_ID || null,

        permissionOverwrites:
          overwrites

      });

  } catch (error) {

    console.error(
      "❌ NIE UDAŁO SIĘ UTWORZYĆ KANAŁU:",
      error
    );

    await interaction.reply({

      content:
        "❌ Bot nie może utworzyć kanału. Sprawdź uprawnienie **Manage Channels / Zarządzanie kanałami**.",

      ephemeral: true

    });

    return;

  }

  /* =====================================================
     TABELA ZAMÓWIENIA
  ===================================================== */

  const orderEmbed =
    new EmbedBuilder()
      .setColor(0x55ff91)
      .setTitle(
        `🛒 NOWE ZAMÓWIENIE ${data.orderId}`
      )
      .setDescription(
        "━━━━━━━━━━━━━━━━━━━━\n" +
        "📋 **INFORMACJE O ZAMÓWIENIU**\n" +
        "━━━━━━━━━━━━━━━━━━━━"
      )
      .addFields(

        {
          name:
            "👤 Klient",

          value:
            `<@${interaction.user.id}>`
        },

        {
          name:
            "🆔 ID użytkownika",

          value:
            interaction.user.id
        },

        {
          name:
            "📦 Produkt",

          value:
            `${product.emoji} ${product.name}`
        },

        {
          name:
            "💳 Metoda płatności",

          value:
            data.payment
        },

        {
          name:
            "💰 Kwota",

          value:
            `${finalPrice.toFixed(2)} zł`
        },

        {
          name:
            "📞 Kontakt",

          value:
            contact.slice(
              0,
              1024
            )
        },

        {
          name:
            "💬 Wiadomość",

          value:
            customerMessage.slice(
              0,
              1024
            )
        }

      )
      .setFooter({

        text:
          "KupGraj • Obsługa zamówień"

      })
      .setTimestamp();

  /* =====================================================
     PRZYCISKI OBSŁUGI
  ===================================================== */

  const row =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `realize|${data.orderId}`
          )
          .setLabel(
            "Realizuj"
          )
          .setEmoji(
            "🟢"
          )
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            `cancel_admin|${data.orderId}`
          )
          .setLabel(
            "Anuluj"
          )
          .setEmoji(
            "🔴"
          )
          .setStyle(
            ButtonStyle.Danger
          ),

        new ButtonBuilder()
          .setCustomId(
            `approve|${data.orderId}`
          )
          .setLabel(
            "Zatwierdź"
          )
          .setEmoji(
            "✅"
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `close_ticket|${data.orderId}`
          )
          .setLabel(
            "Zamknij"
          )
          .setEmoji(
            "🔒"
          )
          .setStyle(
            ButtonStyle.Secondary
          )

      );

  await orderChannel.send({

    content:
      `<@${interaction.user.id}>` +
      (
        STAFF_ROLE_ID
          ? ` <@&${STAFF_ROLE_ID}>`
          : ""
      ),

    embeds: [
      orderEmbed
    ],

    components: [
      row
    ]

  });

  /* =====================================================
     WIADOMOŚĆ POWITALNA
  ===================================================== */

  await orderChannel.send({

    embeds: [

      new EmbedBuilder()
        .setColor(0xa45cff)
        .setTitle(
          "👋 Witaj w swoim zamówieniu!"
        )
        .setDescription(

          "Twoje zamówienie zostało utworzone.\n\n" +

          "👨‍💼 **Obsługa zajmie się nim w tym kanale.**\n\n" +

          "💳 Dane do płatności otrzymasz od obsługi.\n\n" +

          "🔒 Po zakończeniu zamówienia kanał może zostać zamknięty."

        )

    ]

  });

  /* =====================================================
     ODPOWIEDŹ W DM
  ===================================================== */

  await interaction.reply({

    content:
      `✅ Zamówienie zostało utworzone!\n\n` +
      `🎫 ID: **${data.orderId}**\n` +
      `📦 ${product.name}\n` +
      `💰 ${finalPrice.toFixed(2)} zł\n\n` +
      `Wróć na serwer — Twój prywatny kanał zamówienia został utworzony.`,

    ephemeral: false

  });

  /* =====================================================
     LOG
  ===================================================== */

  if (
    ORDERS_LOG_CHANNEL_ID
  ) {

    const logChannel =
      await getChannel(
        ORDERS_LOG_CHANNEL_ID
      );

    if (
      logChannel &&
      logChannel.isTextBased()
    ) {

      await logChannel.send({

        embeds: [

          new EmbedBuilder()
            .setColor(0x55ff91)
            .setTitle(
              `📋 Nowe zamówienie ${data.orderId}`
            )
            .addFields(

              {
                name:
                  "👤 Klient",

                value:
                  `<@${interaction.user.id}>`
              },

              {
                name:
                  "📦 Produkt",

                value:
                  product.name
              },

              {
                name:
                  "💰 Kwota",

                value:
                  `${finalPrice.toFixed(2)} zł`
              },

              {
                name:
                  "🎫 Kanał",

                value:
                  `${orderChannel}`
              }

            )
            .setTimestamp()

        ]

      });

    }

  }

  pendingOrders.delete(
    interaction.user.id
  );

}

/* =========================================================
   REALIZACJA
========================================================= */

async function handleRealize(
  interaction
) {

  if (!isStaff(interaction)) {

    await interaction.reply({

      content:
        "❌ Nie masz uprawnień do realizacji zamówień.",

      ephemeral: true

    });

    return;

  }

  const orderId =
    interaction.customId
      .split("|")[1] ||
    "brak";

  const embed =
    interaction.message
      .embeds[0];

  const updatedEmbed =
    EmbedBuilder
      .from(embed)
      .setColor(0xffc107)
      .setTitle(
        `🟡 REALIZACJA ZAMÓWIENIA ${orderId}`
      )
      .addFields({

        name:
          "👨‍💼 Realizuje",

        value:
          `<@${interaction.user.id}>`

      });

  await interaction.update({

    embeds: [
      updatedEmbed
    ],

    components:
      interaction.message.components

  });

}

/* =========================================================
   ANULOWANIE
========================================================= */

async function handleAdminCancel(
  interaction
) {

  if (!isStaff(interaction)) {

    await interaction.reply({

      content:
        "❌ Nie masz uprawnień do anulowania zamówień.",

      ephemeral: true

    });

    return;

  }

  const orderId =
    interaction.customId
      .split("|")[1] ||
    "brak";

  const embed =
    interaction.message
      .embeds[0];

  const updatedEmbed =
    EmbedBuilder
      .from(embed)
      .setColor(0xff4444)
      .setTitle(
        `❌ ANULOWANE ZAMÓWIENIE ${orderId}`
      )
      .addFields({

        name:
          "👨‍💼 Anulował",

        value:
          `<@${interaction.user.id}>`

      });

  await interaction.update({

    embeds: [
      updatedEmbed
    ],

    components: []

  });

}

/* =========================================================
   ZATWIERDZANIE
========================================================= */

async function handleApprove(
  interaction
) {

  if (!isServerOwner(interaction)) {

    await interaction.reply({

      content:
        "❌ Tylko właściciel serwera może zatwierdzać zamówienia.",

      ephemeral: true

    });

    return;

  }

  const orderId =
    interaction.customId
      .split("|")[1] ||
    "brak";

  const embed =
    interaction.message
      .embeds[0];

  const updatedEmbed =
    EmbedBuilder
      .from(embed)
      .setColor(0x55ff91)
      .setTitle(
        `✅ ZATWIERDZONE ZAMÓWIENIE ${orderId}`
      )
      .addFields({

        name:
          "👑 Zatwierdził",

        value:
          `<@${interaction.user.id}>`

      });

  await interaction.update({

    embeds: [
      updatedEmbed
    ],

    components:
      interaction.message.components

  });

}

/* =========================================================
   ZAMYKANIE KANAŁU
========================================================= */

async function closeTicket(
  interaction
) {

  if (!isStaff(interaction)) {

    await interaction.reply({

      content:
        "❌ Tylko obsługa może zamknąć ten kanał.",

      ephemeral: true

    });

    return;

  }

  await interaction.reply({

    content:
      "🔒 Kanał zostanie zamknięty za 5 sekund...",

    ephemeral: false

  });

  setTimeout(
    async () => {

      await interaction.channel
        .delete(
          "Zamknięcie zamówienia"
        )
        .catch(error => {

          console.error(
            "❌ Nie udało się zamknąć kanału:",
            error
          );

        });

    },
    5000
  );

}

/* =========================================================
   MODAL POMOCY
========================================================= */

async function showHelpModal(
  interaction
) {

  const modal =
    new ModalBuilder()
      .setCustomId(
        "help_modal"
      )
      .setTitle(
        "🆘 Pomoc"
      );

  const problem =
    new TextInputBuilder()
      .setCustomId(
        "problem"
      )
      .setLabel(
        "W czym możemy Ci pomóc?"
      )
      .setPlaceholder(
        "Opisz swój problem..."
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(true)
      .setMaxLength(
        1000
      );

  modal.addComponents(

    new ActionRowBuilder()
      .addComponents(problem)

  );

  await interaction.showModal(
    modal
  );

}

/* =========================================================
   LOGIN
========================================================= */

if (!DISCORD_TOKEN) {

  console.error(
    "❌ BRAK DISCORD_TOKEN W ENVIRONMENT VARIABLES!"
  );

} else {

  discordClient
    .login(
      DISCORD_TOKEN
    )
    .then(() => {

      console.log(
        "✅ Próba logowania bota została uruchomiona."
      );

    })
    .catch(error => {

      console.error(
        "❌ Błąd logowania Discord:",
        error
      );

    });

}

/* =========================================================
   START EXPRESS
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🌐 Serwer działa na porcie ${PORT}`
    );

  }
);
