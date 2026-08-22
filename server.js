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
  PermissionFlagsBits,
  ChannelType
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
KATEGORIA, W KTÓREJ BOT TWORZY KANAŁY ZAMÓWIEŃ
=========================================================
*/

const ORDER_TICKET_CATEGORY_ID =
  process.env.ORDER_TICKET_CATEGORY_ID ||
  "1540700638541914162";

/*
=========================================================
EXPRESS / STRONA
=========================================================
*/

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/*
=========================================================
DISCORD BOT
=========================================================
*/

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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

async function getChannel(channelId) {
  if (!channelId) {
    return null;
  }

  return await discordClient.channels
    .fetch(channelId)
    .catch(() => null);
}

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

/*
=========================================================
TWORZENIE PRYWATNEGO KANAŁU ZAMÓWIENIA
=========================================================
*/

async function createOrderTicket({
  guild,
  user,
  orderId,
  productName,
  payment,
  finalPrice
}) {

  const category =
    await guild.channels
      .fetch(ORDER_TICKET_CATEGORY_ID)
      .catch(() => null);

  if (!category) {
    throw new Error(
      "Nie znaleziono kategorii zamówień: " +
      ORDER_TICKET_CATEGORY_ID
    );
  }

  const channel =
    await guild.channels.create({
      name:
        `zamowienie-${user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9ąćęłńóśźż-]/gi, "-")
          .slice(0, 70),

      type:
        ChannelType.GuildText,

      parent:
        category.id,

      topic:
        `ORDER_ID=${orderId};USER_ID=${user.id}`,

      permissionOverwrites: [

        /*
        ================================
        @everyone — BRAK DOSTĘPU
        ================================
        */

        {
          id:
            guild.roles.everyone.id,

          deny: [
            PermissionFlagsBits.ViewChannel
          ]
        },

        /*
        ================================
        KUPUJĄCY — DOSTĘP
        ================================
        */

        {
          id:
            user.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },

        /*
        ================================
        BOT — PEŁNE UPRAWNIENIA
        ================================
        */

        {
          id:
            discordClient.user.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.EmbedLinks
          ]
        }

      ]
    });

  /*
  ========================================================
  WIADOMOŚĆ POWITALNA / TABELA ZAMÓWIENIA
  ========================================================
  */

  const orderEmbed =
    new EmbedBuilder()
      .setColor(0x55ff91)
      .setTitle(
        `🛒 Zamówienie ${orderId}`
      )
      .setDescription(
        `Witaj <@${user.id}>! 👋\n\n` +
        `Twoje zamówienie zostało utworzone.\n` +
        `Obsługa zajmie się nim w tym kanale.`
      )
      .addFields(

        {
          name: "👤 Klient",
          value:
            `<@${user.id}>`
        },

        {
          name: "📦 Produkt",
          value:
            productName
        },

        {
          name: "💳 Płatność",
          value:
            payment
        },

        {
          name: "💰 Kwota",
          value:
            `${finalPrice.toFixed(2)} zł`
        },

        {
          name: "🆔 ID zamówienia",
          value:
            orderId
        },

        {
          name: "📌 Status",
          value:
            "🟡 Oczekuje na obsługę"
        }

      )
      .setFooter({
        text:
          "KupGraj • Obsługa zamówień"
      })
      .setTimestamp();

  /*
  ========================================================
  PRZYCISKI
  ========================================================
  */

  const buttons =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `realize|${orderId}`
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
            `cancel_admin|${orderId}`
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
            `approve|${orderId}`
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
            `close_ticket|${orderId}`
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
      buttons
    ]

  });

  /*
  ========================================================
  DODATKOWA WIADOMOŚĆ Z DANYMI
  ========================================================
  */

  await channel.send({

    embeds: [

      new EmbedBuilder()
        .setColor(0xa45cff)
        .setTitle(
          "📋 Szczegóły zamówienia"
        )
        .setDescription(
          "Poniżej znajduje się pełne podsumowanie zamówienia."
        )
        .addFields(

          {
            name: "📦 Produkt",
            value:
              productName
          },

          {
            name: "💳 Metoda płatności",
            value:
              payment
          },

          {
            name: "💰 Do zapłaty",
            value:
              `${finalPrice.toFixed(2)} zł`
          },

          {
            name: "⏳ Status",
            value:
              "Oczekiwanie na obsługę"
          }

        )
        .setTimestamp()

    ]

  });

  return channel;
}

/*
=========================================================
ZAMÓWIENIA ZE STRONY
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
        "ORD-" + Date.now();

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
        `👤 **Klient:** ${customer.name}\n` +
        `📞 **Kontakt:** ${customer.contact}\n` +
        `💬 **Wiadomość:** ${customer.message || "Brak"}\n\n` +
        `📦 **Produkty:**\n${products}\n\n` +
        `💰 **Suma:** ${totalPrice.toFixed(2)} zł`;

      /*
      ======================================================
      WEBHOOK
      ======================================================
      */

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

              body:
                JSON.stringify({
                  content:
                    message
                })
            }
          );

        } catch (webhookError) {

          console.error(
            "❌ Błąd webhooka:",
            webhookError
          );

        }

      }

      /*
      ======================================================
      KANAŁ LOGÓW ZAMÓWIEŃ
      ======================================================
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

          const orderEmbed =
            new EmbedBuilder()
              .setColor(0x55ff91)
              .setTitle(
                `🛒 Nowe zamówienie ${orderId}`
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
              .setTimestamp();

          await channel.send({

            embeds: [
              orderEmbed
            ]

          });

        }

      }

      console.log(
        "📦 Otrzymano zamówienie:",
        req.body
      );

      return res.json({

        success:
          true,

        orderId

      });

    } catch (error) {

      console.error(
        "❌ Błąd zamówienia:",
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
      `📨 Kanał logów zamówień: ${
        ORDERS_CHANNEL_ID ||
        "BRAK"
      }`
    );

    console.log(
      `📁 Kategoria ticketów zamówień: ${
        ORDER_TICKET_CATEGORY_ID
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
      ) return;

      if (
        !message.guild
      ) return;

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
      ) return;

      if (
        menuCooldown.has(
          message.channel.id
        )
      ) return;

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
      ====================================================
      MENU GŁÓWNE
      ====================================================
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
      ====================================================
      WYBÓR PRODUKTU
      ====================================================
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
      ====================================================
      WYBÓR PŁATNOŚCI
      ====================================================
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
      ====================================================
      PRZYCISKI
      ====================================================
      */

      if (
        interaction.isButton()
      ) {

        const id =
          interaction.customId;

        /*
        ================================================
        POTWIERDZENIE
        ================================================
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
        ================================================
        ANULOWANIE PRZEZ KLIENTA
        ================================================
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

        /*
        ================================================
        REALIZUJ
        ================================================
        */

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

        /*
        ================================================
        ANULUJ
        ================================================
        */

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

        /*
        ================================================
        ZATWIERDŹ
        ================================================
        */

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

        /*
        ================================================
        ZAMKNIJ KANAŁ
        ================================================
        */

        if (
          id.startsWith(
            "close_ticket|"
          )
        ) {

          await handleCloseTicket(
            interaction
          );

          return;
        }

      }

      /*
      ====================================================
      FORMULARZ POMOCY
      ====================================================
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

        } else if (
          interaction.deferred
        ) {

          await interaction.editReply({

            content:
              "❌ Wystąpił błąd. Spróbuj ponownie."

          });

        }

      } catch (replyError) {

        console.error(
          "❌ Nie można wysłać odpowiedzi błędu:",
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
  ========================================================
  INNE GRY
  ========================================================
  */

  if (
    price === 0
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

  /*
  ========================================================
  MENU PŁATNOŚCI
  ========================================================
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
        .setColor(0x55ff91)
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
        .setColor(0x55ff91)
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
POTWIERDZENIE ZAMÓWIENIA
=========================================================
*/

async function confirmOrder(
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

  const orderId =
    "DC-" + Date.now();

  /*
  ========================================================
  ODPOWIEDŹ DLA KUPUJĄCEGO
  ========================================================
  */

  await interaction.deferUpdate();

  /*
  ========================================================
  TWORZENIE PRYWATNEGO KANAŁU
  ========================================================
  */

  let orderChannel = null;

  try {

    orderChannel =
      await createOrderTicket({

        guild:
          interaction.guild,

        user:
          interaction.user,

        orderId:
          orderId,

        productName:
          name,

        payment:
          payment,

        finalPrice:
          finalPrice

      });

  } catch (error) {

    console.error(
      "❌ Nie udało się utworzyć kanału zamówienia:",
      error
    );

    await interaction.editReply({

      content:
        "❌ Nie udało się utworzyć prywatnego kanału zamówienia.\n\n" +
        "Sprawdź, czy bot ma **Manage Channels / Zarządzanie kanałami**.",

      embeds: [],

      components: []

    });

    return;
  }

  /*
  ========================================================
  WIADOMOŚĆ W STARYM TICKecie
  ========================================================
  */

  await interaction.editReply({

    content:
      `✅ Zamówienie zostało utworzone!\n\n` +
      `🔒 Twój prywatny kanał zamówienia: ${orderChannel}`,

    embeds: [

      new EmbedBuilder()
        .setColor(0x55ff91)
        .setTitle(
          "✅ Zamówienie przyjęte!"
        )
        .setDescription(

          `Twoje zamówienie **${orderId}** zostało przekazane do obsługi.\n\n` +

          `📦 **Produkt:** ${name}\n` +
          `💰 **Kwota:** ${finalPrice.toFixed(2)} zł\n` +
          `💳 **Płatność:** ${payment}\n\n` +

          `🔒 **Kanał zamówienia:** ${orderChannel}`

        )
        .setFooter({
          text:
            "KupGraj • Dziękujemy za zamówienie"
        })
        .setTimestamp()

    ],

    components: []

  });

  /*
  ========================================================
  LOG
  ========================================================
  */

  console.log(
    `🛒 Utworzono kanał ${orderChannel.name} dla ${interaction.user.tag}`
  );

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

  const embed =
    interaction.message.embeds[0];

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
        "❌ Nie masz uprawnień do anulowania zamówień.",

      ephemeral:
        true

    });

    return;
  }

  const orderId =
    interaction.customId
      .split("|")[1] ||
    "brak";

  const embed =
    interaction.message.embeds[0];

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
    interaction.message.embeds[0];

  const approvedEmbed =
    EmbedBuilder
      .from(originalEmbed)
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
      approvedEmbed
    ],

    components: []

  });

  /*
  ========================================================
  LOG ZATWIERDZENIA
  ========================================================
  */

  if (
    ORDERS_LOG_CHANNEL_ID &&
    ORDERS_LOG_CHANNEL_ID !==
      interaction.channelId
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
              `📋 Zatwierdzono zamówienie ${orderId}`
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

async function handleCloseTicket(
  interaction
) {

  const channel =
    interaction.channel;

  if (
    !channel
  ) {

    return;

  }

  /*
  ========================================================
  SPRAWDZAMY WŁAŚCICIELA Z TOPIC
  ========================================================
  */

  const topic =
    channel.topic || "";

  const userMatch =
    topic.match(
      /USER_ID=(\d+)/
    );

  const ticketOwnerId =
    userMatch
      ? userMatch[1]
      : null;

  const canClose =
    isStaff(interaction) ||
    (
      ticketOwnerId &&
      ticketOwnerId ===
        interaction.user.id
    );

  if (
    !canClose
  ) {

    await interaction.reply({

      content:
        "❌ Nie możesz zamknąć tego kanału.",

      ephemeral:
        true

    });

    return;

  }

  await interaction.reply({

    content:
      "🔒 Kanał zostanie zamknięty za 3 sekundy..."

  });

  setTimeout(
    async () => {

      await channel.delete(
        "Zamknięcie kanału zamówienia"
      ).catch(
        error =>
          console.error(
            "❌ Nie udało się usunąć kanału:",
            error
          )
      );

    },
    3000
  );

}

/*
=========================================================
POMOC — MODAL
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
    "⚠️ Brak DISCORD_TOKEN — bot Discord nie został uruchomiony."
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
