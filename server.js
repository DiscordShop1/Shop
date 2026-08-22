const express = require("express");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const app = express();

const PORT = process.env.PORT || 3000;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================================================
   POMOCNICZE
========================================================= */

async function getChannel(channelId) {
  if (!channelId) return null;

  try {
    return await discordClient.channels.fetch(channelId);
  } catch (error) {
    console.error("❌ Nie znaleziono kanału:", error);
    return null;
  }
}

/* =========================================================
   ZAMÓWIENIE ZE STRONY
========================================================= */

app.post("/api/order", async (req, res) => {
  try {
    console.log("📦 Otrzymano zamówienie:");
    console.log(req.body);

    const { customer, cart, total, discordId } = req.body;

    if (!customer) {
      return res.status(400).json({
        success: false,
        error: "Brak danych klienta."
      });
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Koszyk jest pusty."
      });
    }

    /*
      Discord ID może przyjść:
      - jako req.body.discordId
      - albo customer.discordId
    */

    const userId =
      discordId ||
      customer.discordId ||
      customer.discordID ||
      customer.discord_id;

    if (!userId) {
      console.log("❌ Brak Discord ID klienta.");

      return res.status(400).json({
        success: false,
        error:
          "Brak Discord ID. Klient musi podać swoje Discord ID."
      });
    }

    const orderId = "ORD-" + Date.now();

    /* =====================================================
       PRODUKTY
    ===================================================== */

    const products = cart
      .map((item) => {
        const quantity =
          Number(item.quantity) || 1;

        const price =
          Number(item.price) || 0;

        return (
          `• ${item.name} × ${quantity} — ` +
          `${(price * quantity).toFixed(2)} zł`
        );
      })
      .join("\n");

    const totalPrice =
      Number(total) || 0;

    /* =====================================================
       KANAŁ BAZOWY
    ===================================================== */

    if (!ORDERS_CHANNEL_ID) {
      console.error(
        "❌ Brak ORDERS_CHANNEL_ID w Render."
      );

      return res.status(500).json({
        success: false,
        error:
          "Bot nie ma ustawionego ORDERS_CHANNEL_ID."
      });
    }

    const ordersChannel =
      await getChannel(ORDERS_CHANNEL_ID);

    if (!ordersChannel) {
      return res.status(500).json({
        success: false,
        error:
          "Nie znaleziono kanału zamówień."
      });
    }

    if (!ordersChannel.guild) {
      return res.status(500).json({
        success: false,
        error:
          "Kanał zamówień nie należy do serwera Discord."
      });
    }

    const guild =
      ordersChannel.guild;

    /* =====================================================
       SPRAWDZENIE UŻYTKOWNIKA
    ===================================================== */

    let customerUser;

    try {
      customerUser =
        await guild.members.fetch(userId);
    } catch (error) {
      console.error(
        "❌ Nie znaleziono użytkownika:",
        userId
      );

      return res.status(400).json({
        success: false,
        error:
          "Nie znaleziono tego użytkownika na serwerze Discord."
      });
    }

    /* =====================================================
       SPRAWDZENIE CZY BOT MA UPRAWNIENIA
    ===================================================== */

    const botMember =
      guild.members.me;

    if (!botMember) {
      return res.status(500).json({
        success: false,
        error:
          "Nie znaleziono bota na serwerze."
      });
    }

    if (
      !botMember.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      console.error(
        "❌ BOT NIE MA MANAGE_CHANNELS!"
      );

      return res.status(500).json({
        success: false,
        error:
          "Bot nie ma uprawnienia Manage Channels."
      });
    }

    /* =====================================================
       NAZWA KANAŁU
    ===================================================== */

    const safeName =
      String(
        customerUser.user.username ||
        customer.name ||
        "klient"
      )
        .toLowerCase()
        .replace(/[^a-z0-9ąćęłńóśźż_-]/gi, "-")
        .replace(/-+/g, "-")
        .slice(0, 20);

    const channelName =
      `zamowienie-${safeName}`;

    /* =====================================================
       TWORZENIE PRYWATNEGO KANAŁU
    ===================================================== */

    console.log(
      `🔨 Tworzę kanał ${channelName} dla ${customerUser.user.tag}`
    );

    const ticketChannel =
      await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,

        permissionOverwrites: [

          /* =============================================
             @EVERYONE
          ============================================= */

          {
            id: guild.roles.everyone.id,

            deny: [
              PermissionsBitField.Flags.ViewChannel
            ]
          },

          /* =============================================
             KLIENT
          ============================================= */

          {
            id: customerUser.id,

            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks
            ]
          },

          /* =============================================
             BOT
          ============================================= */

          {
            id: botMember.id,

            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageMessages,
              PermissionsBitField.Flags.EmbedLinks
            ]
          }

        ]
      });

    console.log(
      `✅ Utworzono kanał: ${ticketChannel.id}`
    );

    /* =====================================================
       ZAMÓWIENIE EMBED
    ===================================================== */

    const orderEmbed =
      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle(
          `🛒 NOWE ZAMÓWIENIE`
        )
        .setDescription(
          `Witaj <@${customerUser.id}>! 👋\n\n` +
          `Twoje zamówienie zostało utworzone.\n` +
          `Obsługa pojawi się tutaj i zajmie się realizacją.`
        )
        .addFields(

          {
            name: "🆔 ID zamówienia",
            value: orderId
          },

          {
            name: "👤 Klient",
            value:
              `<@${customerUser.id}>`
          },

          {
            name: "📦 Produkty",
            value:
              String(products || "Brak")
                .slice(0, 1024)
          },

          {
            name: "💰 Suma",
            value:
              `${totalPrice.toFixed(2)} zł`
          },

          {
            name: "📞 Kontakt",
            value:
              String(
                customer.contact || "Brak"
              ).slice(0, 1024)
          },

          {
            name: "💬 Wiadomość",
            value:
              String(
                customer.message || "Brak"
              ).slice(0, 1024)
          }

        )
        .setFooter({
          text:
            "KupGraj • Obsługa zamówienia"
        })
        .setTimestamp();

    /* =====================================================
       PRZYCISK ZAMKNIĘCIA
    ===================================================== */

    const closeButton =
      new ButtonBuilder()
        .setCustomId(
          `close_ticket|${ticketChannel.id}`
        )
        .setLabel(
          "Zamknij zamówienie"
        )
        .setEmoji("🔒")
        .setStyle(
          ButtonStyle.Danger
        );

    const row =
      new ActionRowBuilder()
        .addComponents(
          closeButton
        );

    /* =====================================================
       WIADOMOŚĆ W KANALE
    ===================================================== */

    await ticketChannel.send({
      content:
        `<@${customerUser.id}>`,
      embeds: [
        orderEmbed
      ],
      components: [
        row
      ]
    });

    /* =====================================================
       WIADOMOŚĆ NA KANALE ZAMÓWIEŃ
    ===================================================== */

    const ordersEmbed =
      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle(
          `🛒 NOWE ZAMÓWIENIE — ${orderId}`
        )
        .addFields(

          {
            name: "👤 Klient",
            value:
              `<@${customerUser.id}>`
          },

          {
            name: "📦 Produkty",
            value:
              String(products || "Brak")
                .slice(0, 1024)
          },

          {
            name: "💰 Suma",
            value:
              `${totalPrice.toFixed(2)} zł`
          },

          {
            name: "📨 Ticket",
            value:
              `<#${ticketChannel.id}>`
          }

        )
        .setTimestamp();

    await ordersChannel.send({
      embeds: [
        ordersEmbed
      ]
    });

    /* =====================================================
       ODPOWIEDŹ DO STRONY
    ===================================================== */

    return res.json({
      success: true,
      orderId,
      channelId:
        ticketChannel.id,
      channelUrl:
        `https://discord.com/channels/${guild.id}/${ticketChannel.id}`
    });

  } catch (error) {

    console.error(
      "❌ BŁĄD TWORZENIA ZAMÓWIENIA:"
    );

    console.error(error);

    return res.status(500).json({
      success: false,
      error:
        "Nie udało się utworzyć zamówienia."
    });
  }
});

/* =========================================================
   PRZYCISKI DISCORD
========================================================= */

discordClient.on(
  "interactionCreate",
  async (interaction) => {

    try {

      if (!interaction.isButton()) {
        return;
      }

      /* ===================================================
         ZAMKNIĘCIE TICKETU
      =================================================== */

      if (
        interaction.customId.startsWith(
          "close_ticket|"
        )
      ) {

        if (!interaction.guild) {
          return;
        }

        const member =
          interaction.member;

        const isAdmin =
          member.permissions.has(
            PermissionsBitField.Flags.Administrator
          );

        const isManager =
          member.permissions.has(
            PermissionsBitField.Flags.ManageChannels
          );

        const isTicketOwner =
          interaction.channel.permissionOverwrites.cache.has(
            interaction.user.id
          );

        if (
          !isAdmin &&
          !isManager &&
          !isTicketOwner
        ) {

          await interaction.reply({
            content:
              "❌ Nie masz uprawnień do zamknięcia tego zamówienia.",
            ephemeral: true
          });

          return;
        }

        await interaction.reply({
          content:
            "🔒 Zamówienie zostanie zamknięte za 5 sekund..."
        });

        setTimeout(async () => {

          try {

            await interaction.channel.delete(
              "Zamknięcie zamówienia"
            );

          } catch (error) {

            console.error(
              "❌ Nie udało się usunąć kanału:",
              error
            );

          }

        }, 5000);

        return;
      }

    } catch (error) {

      console.error(
        "❌ Błąd interakcji:",
        error
      );

      try {

        if (
          !interaction.replied &&
          !interaction.deferred
        ) {

          await interaction.reply({
            content:
              "❌ Wystąpił błąd.",
            ephemeral: true
          });

        }

      } catch {}

    }

  }
);

/* =========================================================
   BOT READY
========================================================= */

discordClient.once(
  "ready",
  () => {

    console.log(
      "========================================"
    );

    console.log(
      `🤖 BOT ONLINE: ${discordClient.user.tag}`
    );

    console.log(
      `📨 ORDERS_CHANNEL_ID: ${
        ORDERS_CHANNEL_ID || "BRAK"
      }`
    );

    console.log(
      "========================================"
    );

  }
);

/* =========================================================
   LOGOWANIE
========================================================= */

if (!DISCORD_TOKEN) {

  console.error(
    "❌ BRAK DISCORD_TOKEN W ENVIRONMENT VARIABLES!"
  );

} else {

  discordClient
    .login(DISCORD_TOKEN)
    .then(() => {

      console.log(
        "🔑 Próba logowania bota..."
      );

    })
    .catch((error) => {

      console.error(
        "❌ BŁĄD LOGOWANIA BOTA:"
      );

      console.error(error);

    });

}

/* =========================================================
   START
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
