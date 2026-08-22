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
  ChannelType,
  OverwriteType
} = require("discord.js");

const app = express();

const PORT = process.env.PORT || 3000;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const ORDERS_CHANNEL_ID =
  process.env.ORDERS_CHANNEL_ID;

const ORDERS_LOG_CHANNEL_ID =
  process.env.ORDERS_LOG_CHANNEL_ID ||
  ORDERS_CHANNEL_ID;

const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL;

/*
=========================================================
 EXPRESS / STRONA
=========================================================
*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/*
=========================================================
 DISCORD CLIENT
=========================================================
*/

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],

  partials: [
    Partials.Channel
  ]
});

/*
=========================================================
 POMOCNICZE
=========================================================
*/

function isServerOwner(interaction) {

  if (!interaction.guild) {
    return false;
  }

  return (
    interaction.user.id ===
    interaction.guild.ownerId
  );
}

function isStaff(interaction) {

  if (!interaction.guild) {
    return false;
  }

  if (isServerOwner(interaction)) {
    return true;
  }

  return interaction.member?.permissions?.has(
    PermissionsBitField.Flags.ManageGuild
  );
}

async function getChannel(channelId) {

  if (!channelId) {
    return null;
  }

  return await discordClient.channels
    .fetch(channelId)
    .catch(() => null);
}

/*
=========================================================
 TWORZENIE PRYWATZNEGO KANAŁU ZAMÓWIENIA
=========================================================
*/

async function createPrivateOrderChannel({
  guild,
  user,
  orderId,
  product,
  payment,
  price
}) {

  try {

    /*
    -----------------------------------------------------
    SPRAWDZAMY CZY KANAŁ JUŻ ISTNIEJE
    -----------------------------------------------------
    */

    const existingChannels =
      guild.channels.cache.filter(channel =>
        channel.name ===
        `zamowienie-${user.username
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 12)}-${orderId
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(-6)}`
      );

    if (existingChannels.size > 0) {

      return existingChannels.first();

    }

    /*
    -----------------------------------------------------
    NAZWA KANAŁU
    -----------------------------------------------------
    */

    const safeUsername =
      user.username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 12) ||
      "klient";

    const safeOrderId =
      orderId
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(-6);

    const channelName =
      `zamowienie-${safeUsername}-${safeOrderId}`;

    /*
    -----------------------------------------------------
    UPRAWNIENIA
    -----------------------------------------------------
    */

    const permissionOverwrites = [

      /*
      @everyone NIE widzi kanału
      */

      {
        id: guild.roles.everyone.id,

        type: OverwriteType.Role,

        deny: [
          PermissionsBitField.Flags.ViewChannel
        ]
      },

      /*
      KUPUJĄCY WIDZI SWÓJ KANAŁ
      */

      {
        id: user.id,

        type: OverwriteType.Member,

        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      }

    ];

    /*
    -----------------------------------------------------
    WŁAŚCICIEL SERWERA
    -----------------------------------------------------
    */

    permissionOverwrites.push({

      id: guild.ownerId,

      type: OverwriteType.Member,

      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ManageMessages
      ]

    });

    /*
    -----------------------------------------------------
    TWORZENIE KANAŁU
    -----------------------------------------------------
    */

    const channel =
      await guild.channels.create({

        name: channelName,

        type: ChannelType.GuildText,

        topic:
          `Zamówienie ${orderId} • ${user.tag}`,

        permissionOverwrites,

        reason:
          `Automatyczny kanał zamówienia ${orderId}`

      });

    /*
    -----------------------------------------------------
    PANEL ZAMÓWIENIA
    -----------------------------------------------------
    */

    const orderEmbed =
      new EmbedBuilder()

        .setColor(0x55ff91)

        .setTitle(
          `🛒 ZAMÓWIENIE ${orderId}`
        )

        .setDescription(
          "🎉 **Twoje zamówienie zostało utworzone!**\n\n" +

          `👤 **Klient:** <@${user.id}>\n` +

          `📦 **Produkt:** ${product}\n` +

          `💳 **Płatność:** ${payment}\n` +

          `💰 **Kwota:** ${price.toFixed(2)} zł\n\n` +

          "📝 **Następny krok:**\n" +

          "Bot wysłał Ci na wiadomość prywatną przycisk do uzupełnienia ankiety.\n\n" +

          "Po uzupełnieniu ankiety odpowiedzi zostaną automatycznie przesłane tutaj.\n\n" +

          "⏳ Poczekaj na obsługę."

        )

        .setFooter({

          text:
            "KupGraj • Obsługa zamówienia"

        })

        .setTimestamp();

    /*
    -----------------------------------------------------
    PRZYCISKI
    -----------------------------------------------------
    */

    const row =
      new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()

            .setCustomId(
              `order_realize|${orderId}`
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
              `order_approve|${orderId}`
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
              `order_cancel|${orderId}`
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
              `order_close|${orderId}`
            )

            .setLabel(
              "Zamknij kanał"
            )

            .setEmoji(
              "🔒"
            )

            .setStyle(
              ButtonStyle.Secondary
            )

        );

    await channel.send({

      content:
        `<@${user.id}>`,

      embeds: [
        orderEmbed
      ],

      components: [
        row
      ]

    });

    /*
    -----------------------------------------------------
    WYSŁANIE DM Z ANKIETĄ
    -----------------------------------------------------
    */

    await sendQuestionnaireDM({

      user,
      orderId,
      product,
      payment,
      price

    });

    return channel;

  } catch (error) {

    console.error(
      "❌ Błąd tworzenia prywatnego kanału:",
      error
    );

    return null;
  }
}

/*
=========================================================
 ANKIETA W DM
=========================================================
*/

async function sendQuestionnaireDM({
  user,
  orderId,
  product,
  payment,
  price
}) {

  try {

    const embed =
      new EmbedBuilder()

        .setColor(0x55ff91)

        .setTitle(
          "📝 Ankieta do zamówienia"
        )

        .setDescription(

          `Cześć **${user.username}**! 👋\n\n` +

          `Twoje zamówienie **${orderId}** zostało utworzone.\n\n` +

          `📦 **Produkt:** ${product}\n` +

          `💳 **Płatność:** ${payment}\n` +

          `💰 **Kwota:** ${price.toFixed(2)} zł\n\n` +

          "Kliknij przycisk poniżej i uzupełnij krótką ankietę.\n\n" +

          "🔒 Twoje odpowiedzi zostaną przekazane wyłącznie do obsługi zamówienia."

        )

        .setFooter({

          text:
            "KupGraj • Ankieta zamówienia"

        });

    const row =
      new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()

            .setCustomId(
              `questionnaire|${orderId}`
            )

            .setLabel(
              "Uzupełnij ankietę"
            )

            .setEmoji(
              "📝"
            )

            .setStyle(
              ButtonStyle.Success
            )

        );

    await user.send({

      embeds: [
        embed
      ],

      components: [
        row
      ]

    });

    console.log(
      `📨 Wysłano ankietę DM do ${user.tag}`
    );

    return true;

  } catch (error) {

    console.error(
      `❌ Nie udało się wysłać DM do ${user.tag}:`,
      error.message
    );

    return false;
  }
}

/*
=========================================================
 ZAMÓWIENIE ZE STRONY
=========================================================
*/

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
        "ORD-" +
        Date.now();

      const products =
        cart
          .map(item => {

            const quantity =
              Number(
                item.quantity
              ) || 1;

            const price =
              Number(
                item.price
              ) || 0;

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

        `👤 **Klient:** ${customer.name}\n` +

        `📞 **Kontakt:** ${customer.contact}\n` +

        `💬 **Wiadomość:** ${customer.message || "Brak"}\n\n` +

        `📦 **Produkty:**\n${products}\n\n` +

        `💰 **Suma:** ${totalPrice.toFixed(2)} zł`;

      /*
      -----------------------------------------------------
      WEBHOOK
      -----------------------------------------------------
      */

      if (DISCORD_WEBHOOK_URL) {

        try {

          await fetch(
            DISCORD_WEBHOOK_URL,
            {

              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({

                  content:
                    message

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

      /*
      -----------------------------------------------------
      KANAŁ INFORMACYJNY
      -----------------------------------------------------
      */

      if (
        discordClient.isReady() &&
        ORDERS_CHANNEL_ID
      ) {

        const channel =
          await getChannel(
            ORDERS_CHANNEL_ID
          );

        if (
          channel &&
          channel.isTextBased()
        ) {

          await channel.send({

            embeds: [

              new EmbedBuilder()

                .setColor(
                  0x55ff91
                )

                .setTitle(
                  `🛒 Nowe zamówienie ${orderId}`
                )

                .setDescription(
                  "Zamówienie zostało złożone ze strony sklepu."
                )

                .addFields(

                  {
                    name:
                      "👤 Klient",

                    value:
                      String(
                        customer.name ||
                        "Brak"
                      ).slice(
                        0,
                        1024
                      )
                  },

                  {
                    name:
                      "📞 Kontakt",

                    value:
                      String(
                        customer.contact ||
                        "Brak"
                      ).slice(
                        0,
                        1024
                      )
                  },

                  {
                    name:
                      "📦 Produkty",

                    value:
                      String(
                        products ||
                        "Brak"
                      ).slice(
                        0,
                        1024
                      )
                  },

                  {
                    name:
                      "💰 Suma",

                    value:
                      `${totalPrice.toFixed(2)} zł`
                  }

                )

                .setTimestamp()

            ]

          });

        }

      }

      console.log(
        "📦 Otrzymano zamówienie ze strony:",
        req.body
      );

      return res.json({

        success:
          true,

        orderId

      });

    } catch (error) {

      console.error(
        "❌ Błąd zamówienia ze strony:",
        error
      );

      return res.status(500).json({

        error:
          "Nie udało się wysłać zamówienia."

      });

    }

  }
);

/*
=========================================================
 BOT READY
=========================================================
*/

discordClient.once(
  "ready",
  () => {

    console.log(
      `🤖 Bot zalogowany jako ${discordClient.user.tag}`
    );

    console.log(
      `📨 Kanał informacyjny zamówień: ${
        ORDERS_CHANNEL_ID ||
        "BRAK"
      }`
    );

  }
);

/*
=========================================================
 AUTOMATYCZNE MENU W TICKETACH
=========================================================
*/

const menuCooldown =
  new Set();

discordClient.on(
  "messageCreate",
  async message => {

    try {

      if (
        message.author.bot
      ) {
        return;
      }

      if (
        !message.guild
      ) {
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

        "chce zamówić",

        "chcę zamowic",

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

      if (
        !isOrderMessage
      ) {
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
        "❌ Błąd messageCreate:",
        error
      );

    }

  }
);

/*
=========================================================
 MENU GŁÓWNE
=========================================================
*/

async function sendMainMenu(
  channel
) {

  const embed =
    new EmbedBuilder()

      .setColor(
        0x55ff91
      )

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

      .addOptions([

        {

          label:
            "Zamówienie",

          description:
            "Chcę złożyć zamówienie",

          value:
            "order",

          emoji:
            "🛒"

        },

        {

          label:
            "Pomoc",

          description:
            "Potrzebuję pomocy",

          value:
            "help",

          emoji:
            "🆘"

        }

      ]);

  await channel.send({

    embeds: [
      embed
    ],

    components: [

      new ActionRowBuilder()
        .addComponents(
          menu
        )

    ]

  });

}

/*
=========================================================
 INTERAKCJE
=========================================================
*/

discordClient.on(
  "interactionCreate",
  async interaction => {

    try {

      /*
      =====================================================
      MENU GŁÓWNE
      =====================================================
      */

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

      /*
      =====================================================
      PRODUKT
      =====================================================
      */

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "product_select"
      ) {

        const product =
          interaction.values[0];

        await showPaymentMenu(
          interaction,
          product
        );

        return;
      }

      /*
      =====================================================
      PŁATNOŚĆ
      =====================================================
      */

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "payment_select"
      ) {

        const parts =
          interaction.values[0]
            .split("|");

        const product =
          `${parts[0]}|${parts[1]}`;

        const payment =
          parts[2];

        await showSummary(
          interaction,
          product,
          payment
        );

        return;
      }

      /*
      =====================================================
      PRZYCISKI
      =====================================================
      */

      if (
        interaction.isButton()
      ) {

        const id =
          interaction.customId;

        /*
        ---------------------------------------------------
        ANKIETA
        ---------------------------------------------------
        */

        if (
          id.startsWith(
            "questionnaire|"
          )
        ) {

          await showQuestionnaireModal(
            interaction
          );

          return;
        }

        /*
        ---------------------------------------------------
        REALIZUJ
        ---------------------------------------------------
        */

        if (
          id.startsWith(
            "order_realize|"
          )
        ) {

          await handleRealize(
            interaction
          );

          return;
        }

        /*
        ---------------------------------------------------
        ZATWIERDŹ
        ---------------------------------------------------
        */

        if (
          id.startsWith(
            "order_approve|"
          )
        ) {

          await handleApprove(
            interaction
          );

          return;
        }

        /*
        ---------------------------------------------------
        ANULUJ
        ---------------------------------------------------
        */

        if (
          id.startsWith(
            "order_cancel|"
          )
        ) {

          await handleAdminCancel(
            interaction
          );

          return;
        }

        /*
        ---------------------------------------------------
        ZAMKNIJ KANAŁ
        ---------------------------------------------------
        */

        if (
          id.startsWith(
            "order_close|"
          )
        ) {

          await handleCloseChannel(
            interaction
          );

          return;
        }

        /*
        ---------------------------------------------------
        STARE POTWIERDZENIE
        ---------------------------------------------------
        */

        if (
          id.startsWith(
            "confirm_order|"
          )
        ) {

          const parts =
            id.split("|");

          const product =
            `${parts[1]}|${parts[2]}`;

          const payment =
            parts[3];

          await confirmOrder(
            interaction,
            product,
            payment
          );

          return;
        }

        /*
        ---------------------------------------------------
        ANULOWANIE KLIENTA
        ---------------------------------------------------
        */

        if (
          id ===
          "cancel_order"
        ) {

          await interaction.update({

            content:
              "❌ Zamówienie zostało anulowane.",

            embeds: [],

            components: []

          });

          return;
        }

      }

      /*
      =====================================================
      MODAL ANKIETY
      =====================================================
      */

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "questionnaire_modal|"
        )
      ) {

        await handleQuestionnaireSubmit(
          interaction
        );

        return;
      }

      /*
      =====================================================
      MODAL POMOCY
      =====================================================
      */

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

        const embed =
          new EmbedBuilder()

            .setColor(
              0xa45cff
            )

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

        await interaction.reply({

          content:
            "✅ Twoja wiadomość została wysłana do obsługi.",

          ephemeral:
            true

        });

        if (
          interaction.channel &&
          interaction.channel.isTextBased()
        ) {

          await interaction.channel.send({

            embeds: [
              embed
            ]

          });

        }

        return;
      }

    } catch (error) {

      console.error(
        "❌ Błąd interactionCreate:",
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

            ephemeral:
              true

          });

        }

      } catch (replyError) {

        console.error(
          "❌ Nie można odpowiedzieć:",
          replyError
        );

      }

    }

  }
);

/*
=========================================================
 PRODUKTY
=========================================================
*/

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

      .addOptions([

        {

          label:
            "Minecraft — KOSZT KONTA",

          description:
            "25 zł • Konto bez dostępu do maila",

          value:
            "Minecraft — KOSZT KONTA|25",

          emoji:
            "⛏️"

        },

        {

          label:
            "Minecraft — PEŁNY DOSTĘP",

          description:
            "35 zł • Konto + dostęp do maila",

          value:
            "Minecraft — PEŁNY DOSTĘP|35",

          emoji:
            "💎"

        },

        {

          label:
            "Discord — START",

          description:
            "20 zł • Podstawowa konfiguracja",

          value:
            "Discord — START|20",

          emoji:
            "⚙️"

        },

        {

          label:
            "Discord — PRO",

          description:
            "40 zł • Rozbudowana konfiguracja",

          value:
            "Discord — PRO|40",

          emoji:
            "🤖"

        },

        {

          label:
            "Discord — FULL",

          description:
            "60 zł • Pełna konfiguracja",

          value:
            "Discord — FULL|60",

          emoji:
            "🛡️"

        },

        {

          label:
            "Inne gry",

          description:
            "Zapytaj o dostępne produkty",

          value:
            "Inne gry|0",

          emoji:
            "🎮"

        }

      ]);

  await interaction.update({

    embeds: [

      new EmbedBuilder()

        .setColor(
          0x55ff91
        )

        .setTitle(
          "📦 Wybierz produkt"
        )

        .setDescription(
          "Wybierz produkt, który chcesz zamówić."
        )

    ],

    components: [

      new ActionRowBuilder()
        .addComponents(
          menu
        )

    ]

  });

}

/*
=========================================================
 PŁATNOŚĆ
=========================================================
*/

async function showPaymentMenu(
  interaction,
  product
) {

  const parts =
    product.split("|");

  const name =
    parts[0];

  const price =
    Number(parts[1]);

  /*
  -------------------------------------------------------
  INNE GRY
  -------------------------------------------------------
  */

  if (
    price === 0
  ) {

    await interaction.update({

      embeds: [

        new EmbedBuilder()

          .setColor(
            0xa45cff
          )

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

  /*
  -------------------------------------------------------
  MENU PŁATNOŚCI
  -------------------------------------------------------
  */

  const menu =
    new StringSelectMenuBuilder()

      .setCustomId(
        "payment_select"
      )

      .setPlaceholder(
        "💳 Wybierz metodę płatności..."
      )

      .addOptions([

        {

          label:
            "BLIK",

          description:
            `${price} zł`,

          value:
            `${name}|${price}|BLIK`,

          emoji:
            "💵"

        },

        {

          label:
            "PaySafeCard",

          description:
            `${(
              price * 1.10
            ).toFixed(2)} zł (+10%)`,

          value:
            `${name}|${price}|PaySafeCard`,

          emoji:
            "🎫"

        }

      ]);

  await interaction.update({

    embeds: [

      new EmbedBuilder()

        .setColor(
          0x55ff91
        )

        .setTitle(
          "💳 Wybierz metodę płatności"
        )

        .setDescription(

          `📦 **Produkt:** ${name}\n` +

          `💰 **Cena:** ${price.toFixed(2)} zł\n\n` +

          `💵 **BLIK** — ${price.toFixed(2)} zł\n` +

          `🎫 **PaySafeCard** — ${(price * 1.10).toFixed(2)} zł (+10%)\n\n` +

          "ℹ️ Dane do płatności poda Ci osobiście obsługa."

        )

    ],

    components: [

      new ActionRowBuilder()
        .addComponents(
          menu
        )

    ]

  });

}

/*
=========================================================
 PODSUMOWANIE
=========================================================
*/

async function showSummary(
  interaction,
  product,
  payment
) {

  const parts =
    product.split("|");

  const name =
    parts[0];

  const price =
    Number(parts[1]);

  const finalPrice =
    payment === "PaySafeCard"
      ? price * 1.10
      : price;

  const confirmButton =
    new ButtonBuilder()

      .setCustomId(
        `confirm_order|${name}|${price}|${payment}`
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

  await interaction.update({

    embeds: [

      new EmbedBuilder()

        .setColor(
          0x55ff91
        )

        .setTitle(
          "🧾 Podsumowanie zamówienia"
        )

        .setDescription(

          `📦 **Produkt:** ${name}\n` +

          `💰 **Kwota:** ${finalPrice.toFixed(2)} zł\n` +

          `💳 **Płatność:** ${payment}\n\n` +

          "Czy wszystko się zgadza?\n\n" +

          "ℹ️ Po potwierdzeniu bot utworzy dla Ciebie prywatny kanał zamówienia."

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

/*
=========================================================
 POTWIERDZENIE
=========================================================
*/

async function confirmOrder(
  interaction,
  product,
  payment
) {

  if (
    !interaction.guild
  ) {

    return;

  }

  const parts =
    product.split("|");

  const name =
    parts[0];

  const price =
    Number(parts[1]);

  const finalPrice =
    payment === "PaySafeCard"
      ? price * 1.10
      : price;

  const orderId =
    "DC-" +
    Date.now();

  /*
  -------------------------------------------------------
  TWORZYMY PRYWATNY KANAŁ
  -------------------------------------------------------
  */

  const orderChannel =
    await createPrivateOrderChannel({

      guild:
        interaction.guild,

      user:
        interaction.user,

      orderId,

      product:
        name,

      payment,

      price:
        finalPrice

    });

  /*
  -------------------------------------------------------
  JEŚLI NIE UDAŁO SIĘ UTWORZYĆ KANAŁU
  -------------------------------------------------------
  */

  if (
    !orderChannel
  ) {

    await interaction.reply({

      content:

        "❌ Nie udało się utworzyć prywatnego kanału zamówienia.\n\n" +

        "Sprawdź, czy bot ma uprawnienia **Manage Channels**.",

      ephemeral:
        true

    });

    return;
  }

  /*
  -------------------------------------------------------
  ODPOWIEDŹ W STARYM TICKecie
  -------------------------------------------------------
  */

  await interaction.update({

    embeds: [

      new EmbedBuilder()

        .setColor(
          0x55ff91
        )

        .setTitle(
          "✅ Zamówienie utworzone!"
        )

        .setDescription(

          `Twoje zamówienie **${orderId}** zostało utworzone.\n\n` +

          `📦 **Produkt:** ${name}\n` +

          `💰 **Kwota:** ${finalPrice.toFixed(2)} zł\n` +

          `💳 **Płatność:** ${payment}\n\n` +

          `🔒 Twój prywatny kanał: ${orderChannel}\n\n` +

          "📝 Sprawdź wiadomości prywatne — bot wysłał Ci ankietę do uzupełnienia."

        )

    ],

    components: []

  });

}

/*
=========================================================
 ANKIETA — MODAL
=========================================================
*/

async function showQuestionnaireModal(
  interaction
) {

  const orderId =
    interaction.customId
      .split("|")[1];

  const modal =
    new ModalBuilder()

      .setCustomId(
        `questionnaire_modal|${orderId}`
      )

      .setTitle(
        "📝 Ankieta zamówienia"
      );

  const name =
    new TextInputBuilder()

      .setCustomId(
        "customer_name"
      )

      .setLabel(
        "Jak mamy się do Ciebie zwracać?"
      )

      .setPlaceholder(
        "Np. Kamil"
      )

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(
        true
      )

      .setMaxLength(
        100
      );

  const contact =
    new TextInputBuilder()

      .setCustomId(
        "customer_contact"
      )

      .setLabel(
        "Kontakt"
      )

      .setPlaceholder(
        "Np. Discord / e-mail"
      )

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(
        true
      )

      .setMaxLength(
        200
      );

  const details =
    new TextInputBuilder()

      .setCustomId(
        "customer_details"
      )

      .setLabel(
        "Dodatkowe informacje"
      )

      .setPlaceholder(
        "Napisz tutaj wszystko, co obsługa powinna wiedzieć..."
      )

      .setStyle(
        TextInputStyle.Paragraph
      )

      .setRequired(
        false
      )

      .setMaxLength(
        1000
      );

  modal.addComponents(

    new ActionRowBuilder()
      .addComponents(
        name
      ),

    new ActionRowBuilder()
      .addComponents(
        contact
      ),

    new ActionRowBuilder()
      .addComponents(
        details
      )

  );

  await interaction.showModal(
    modal
  );

}

/*
=========================================================
 ODEBRANIE ANKIETY
=========================================================
*/

async function handleQuestionnaireSubmit(
  interaction
) {

  const orderId =
    interaction.customId
      .split("|")[1];

  const customerName =
    interaction.fields
      .getTextInputValue(
        "customer_name"
      );

  const contact =
    interaction.fields
      .getTextInputValue(
        "customer_contact"
      );

  const details =
    interaction.fields
      .getTextInputValue(
        "customer_details"
      ) ||
      "Brak dodatkowych informacji.";

  /*
  -------------------------------------------------------
  SZUKAMY KANAŁU PO TOPIC
  -------------------------------------------------------
  */

  const guilds =
    discordClient.guilds.cache;

  let orderChannel =
    null;

  for (
    const guild of guilds.values()
  ) {

    const found =
      guild.channels.cache.find(
        channel =>
          channel.type ===
            ChannelType.GuildText &&
          channel.topic &&
          channel.topic.includes(
            `Zamówienie ${orderId}`
          )
      );

    if (found) {

      orderChannel =
        found;

      break;

    }

  }

  /*
  -------------------------------------------------------
  DM POTWIERDZENIE
  -------------------------------------------------------
  */

  await interaction.reply({

    content:

      "✅ Ankieta została wysłana do obsługi.",

    ephemeral:
      true

  });

  /*
  -------------------------------------------------------
  JEŚLI ZNALEZIONO KANAŁ
  -------------------------------------------------------
  */

  if (
    orderChannel
  ) {

    const embed =
      new EmbedBuilder()

        .setColor(
          0xa45cff
        )

        .setTitle(
          `📝 ANKIETA — ${orderId}`
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
              "📛 Nazwa",

            value:
              customerName.slice(
                0,
                1024
              )
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
              "💬 Dodatkowe informacje",

            value:
              details.slice(
                0,
                1024
              )
          }

        )

        .setFooter({

          text:
            "KupGraj • Dane z ankiety"

        })

        .setTimestamp();

    await orderChannel.send({

      embeds: [
        embed
      ]

    });

  }

}

/*
=========================================================
 REALIZUJ
=========================================================
*/

async function handleRealize(
  interaction
) {

  if (
    !isStaff(interaction)
  ) {

    await interaction.reply({

      content:
        "❌ Nie masz uprawnień do realizacji zamówień.",

      ephemeral:
        true

    });

    return;
  }

  const orderId =
    interaction.customId
      .split("|")[1] ||
      "brak";

  const originalEmbed =
    interaction.message
      .embeds[0];

  const updatedEmbed =
    EmbedBuilder
      .from(
        originalEmbed
      )

      .setColor(
        0xffc107
      )

      .setTitle(
        `🟡 REALIZACJA — ${orderId}`
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
      interaction.message
        .components

  });

}

/*
=========================================================
 ANULUJ
=========================================================
*/

async function handleAdminCancel(
  interaction
) {

  if (
    !isStaff(interaction)
  ) {

    await interaction.reply({

      content:
        "❌ Nie masz uprawnień do anulowania zamówienia.",

      ephemeral:
        true

    });

    return;
  }

  const orderId =
    interaction.customId
      .split("|")[1] ||
      "brak";

  const originalEmbed =
    interaction.message
      .embeds[0];

  const updatedEmbed =
    EmbedBuilder
      .from(
        originalEmbed
      )

      .setColor(
        0xff4444
      )

      .setTitle(
        `❌ ANULOWANE — ${orderId}`
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

/*
=========================================================
 ZATWIERDŹ
=========================================================
*/

async function handleApprove(
  interaction
) {

  if (
    !isServerOwner(interaction)
  ) {

    await interaction.reply({

      content:
        "❌ Tylko właściciel serwera może zatwierdzać zamówienia.",

      ephemeral:
        true

    });

    return;
  }

  const orderId =
    interaction.customId
      .split("|")[1] ||
      "brak";

  const originalEmbed =
    interaction.message
      .embeds[0];

  const approvedEmbed =
    EmbedBuilder
      .from(
        originalEmbed
      )

      .setColor(
        0x55ff91
      )

      .setTitle(
        `✅ ZATWIERDZONE — ${orderId}`
      )

      .addFields({

        name:
          "👑 Zatwierdził",

        value:
          `<@${interaction.user.id}>`

      });

  await interaction.update({

    embeds: [
      approvedEmbed
    ],

    components: []

  });

  /*
  -------------------------------------------------------
  LOG
  -------------------------------------------------------
  */

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

            .setColor(
              0x55ff91
            )

            .setTitle(
              `📋 Zatwierdzono ${orderId}`
            )

            .addFields(

              {
                name:
                  "👑 Zatwierdził",

                value:
                  `<@${interaction.user.id}>`
              },

              {
                name:
                  "📨 Kanał",

                value:
                  `<#${interaction.channelId}>`
              }

            )

            .setTimestamp()

        ]

      });

    }

  }

}

/*
=========================================================
 ZAMKNIĘCIE KANAŁU
=========================================================
*/

async function handleCloseChannel(
  interaction
) {

  /*
  -------------------------------------------------------
  STAFF MOŻE ZAMKNĄĆ
  -------------------------------------------------------
  */

  const canClose =
    isStaff(interaction) ||
    interaction.channel
      ?.permissionsFor(
        interaction.user
      )
      ?.has(
        PermissionsBitField.Flags.ManageChannels
      );

  if (
    !canClose
  ) {

    await interaction.reply({

      content:
        "❌ Nie masz uprawnień do zamknięcia tego kanału.",

      ephemeral:
        true

    });

    return;
  }

  await interaction.reply({

    content:
      "🔒 Kanał zostanie zamknięty za 5 sekund.",

    ephemeral:
      true

  });

  setTimeout(
    async () => {

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

    },
    5000
  );

}

/*
=========================================================
 MODAL POMOCY
=========================================================
*/

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
        "Opisz dokładnie swój problem..."
      )

      .setStyle(
        TextInputStyle.Paragraph
      )

      .setRequired(
        true
      )

      .setMaxLength(
        1000
      );

  modal.addComponents(

    new ActionRowBuilder()
      .addComponents(
        problem
      )

  );

  await interaction.showModal(
    modal
  );

}

/*
=========================================================
 LOGOWANIE BOTA
=========================================================
*/

if (
  DISCORD_TOKEN
) {

  discordClient
    .login(
      DISCORD_TOKEN
    )

    .catch(
      error => {

        console.error(
          "❌ Nie udało się zalogować bota:",
          error
        );

      }
    );

} else {

  console.warn(
    "⚠️ Brak DISCORD_TOKEN — bot nie został uruchomiony."
  );

}

/*
=========================================================
 START SERWERA
=========================================================
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🌐 Sklep działa na porcie ${PORT}`
    );

  }
);
