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
KATEGORIA DLA PRYWATNYCH KANAŁÓW ZAMÓWIEŃ
=========================================================
*/

const ORDER_CATEGORY_ID =
  "1540700638541914162";

/*
=========================================================
EXPRESS / STRONA
=========================================================
*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
  partials: [Partials.Channel]
});

/*
=========================================================
POMOCNICZE
=========================================================
*/

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

  return interaction.member?.permissions?.has(
    PermissionsBitField.Flags.ManageGuild
  );
}

async function getChannel(channelId) {
  if (!channelId) return null;

  return await discordClient.channels
    .fetch(channelId)
    .catch(() => null);
}

/*
=========================================================
TWORZENIE PRYWATNEGO KANAŁU ZAMÓWIENIA
=========================================================
*/

async function createPrivateOrderChannel(
  guild,
  user,
  orderId,
  productName,
  payment,
  finalPrice
) {

  try {

    const category =
      await guild.channels
        .fetch(ORDER_CATEGORY_ID)
        .catch(() => null);

    if (!category) {

      console.error(
        "❌ Nie znaleziono kategorii:",
        ORDER_CATEGORY_ID
      );

      return null;
    }

    const channelName =
      `zamowienie-${user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9ąćęłńóśźż-]/gi, "-")
        .slice(0, 80);

    /*
    =====================================================
    UPRAWNIENIA
    =====================================================
    */

    const permissionOverwrites = [

      {
        id: guild.roles.everyone.id,

        deny: [
          PermissionsBitField.Flags.ViewChannel
        ]
      },

      {
        id: user.id,

        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      },

      {
        id: discordClient.user.id,

        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.EmbedLinks
        ]
      }

    ];

    /*
    =====================================================
    TWORZENIE KANAŁU
    =====================================================
    */

    const channel =
      await guild.channels.create({

        name: channelName,

        type: ChannelType.GuildText,

        parent: ORDER_CATEGORY_ID,

        permissionOverwrites

      });

    console.log(
      `✅ Utworzono prywatny kanał ${channel.name}`
    );

    /*
    =====================================================
    TABELA ZAMÓWIENIA
    =====================================================
    */

    const orderEmbed =
      new EmbedBuilder()

        .setColor(0x55ff91)

        .setTitle(
          `🛒 ZAMÓWIENIE ${orderId}`
        )

        .setDescription(
          "### 📋 Szczegóły zamówienia\n" +
          "Poniżej znajdują się informacje dotyczące Twojego zamówienia."
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
              String(productName)
          },

          {
            name: "💳 Metoda płatności",
            value:
              String(payment)
          },

          {
            name: "💰 Kwota",
            value:
              `**${Number(finalPrice).toFixed(2)} zł**`
          },

          {
            name: "🆔 ID zamówienia",
            value:
              `\`${orderId}\``
          }

        )

        .setFooter({
          text:
            "KupGraj • Obsługa zamówień"
        })

        .setTimestamp();

    /*
    =====================================================
    PRZYCISKI
    =====================================================
    */

    const row =
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
            )

        );

    /*
    =====================================================
    WIADOMOŚĆ W NOWYM KANALE
    =====================================================
    */

    await channel.send({

      content:
        `<@${user.id}> 🛒 **Twoje zamówienie zostało utworzone!**`,

      embeds: [
        orderEmbed
      ],

      components: [
        row
      ]

    });

    /*
    =====================================================
    DODATKOWA WIADOMOŚĆ DLA KLIENTA
    =====================================================
    */

    await channel.send({

      content:
        "👋 **Witaj w swoim kanale zamówienia!**\n\n" +
        "💳 Dane do płatności poda Ci osobiście obsługa.\n" +
        "⏳ Poczekaj na wiadomość od obsługi.\n\n" +
        "⚠️ Nie zamykaj kanału przed zakończeniem realizacji."

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
ZAMÓWIENIA ZE STRONY
=========================================================
*/

app.post("/api/order", async (req, res) => {

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
            `${(price * quantity).toFixed(2)} zł`
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
    =====================================================
    WEBHOOK
    =====================================================
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

            body: JSON.stringify({
              content: message
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
    =====================================================
    KANAŁ ZAMÓWIEŃ
    =====================================================
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
                  ).slice(0, 1024)
              },

              {
                name:
                  "📞 Kontakt",

                value:
                  String(
                    customer.contact ||
                    "Brak"
                  ).slice(0, 1024)
              },

              {
                name:
                  "📦 Produkty",

                value:
                  String(
                    products ||
                    "Brak"
                  ).slice(0, 1024)
              },

              {
                name:
                  "💰 Suma",

                value:
                  `${totalPrice.toFixed(2)} zł`
              },

              {
                name:
                  "💬 Wiadomość",

                value:
                  String(
                    customer.message ||
                    "Brak"
                  ).slice(0, 1024)
              }

            )

            .setTimestamp();

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `realize_web|${orderId}`
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
                  `cancel_web|${orderId}`
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
                  `approve_web|${orderId}`
                )
                .setLabel(
                  "Zatwierdź"
                )
                .setEmoji(
                  "✅"
                )
                .setStyle(
                  ButtonStyle.Primary
                )

            );

        await channel.send({

          embeds: [
            orderEmbed
          ],

          components: [
            row
          ]

        });

      }

    }

    console.log(
      "📦 Otrzymano zamówienie:",
      req.body
    );

    return res.json({

      success: true,

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

});

/*
=========================================================
GOTOWOŚĆ BOTA
=========================================================
*/

discordClient.once(
  "ready",
  () => {

    console.log(
      `🤖 Bot zalogowany jako ${discordClient.user.tag}`
    );

    console.log(
      `📨 Kanał zamówień: ${
        ORDERS_CHANNEL_ID ||
        "BRAK"
      }`
    );

    console.log(
      `📁 Kategoria zamówień: ${
        ORDER_CATEGORY_ID
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

      if (message.author.bot)
        return;

      if (!message.guild)
        return;

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

      if (!isOrderMessage)
        return;

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
      ===================================================
      MENU GŁÓWNE
      ===================================================
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
      ===================================================
      WYBÓR PRODUKTU
      ===================================================
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
      ===================================================
      WYBÓR PŁATNOŚCI
      ===================================================
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
      ===================================================
      PRZYCISKI
      ===================================================
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
          ) ||
          id.startsWith(
            "realize_web|"
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
          ) ||
          id.startsWith(
            "cancel_web|"
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
          ) ||
          id.startsWith(
            "approve_web|"
          )
        ) {

          await handleApprove(
            interaction
          );

          return;

        }

      }

      /*
      ===================================================
      FORMULARZ POMOCY
      ===================================================
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

          ephemeral: true

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

            ephemeral: true

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
  =======================================================
  INNE GRY
  =======================================================
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
  =======================================================
  MENU PŁATNOŚCI
  =======================================================
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

          "ℹ️ Po potwierdzeniu obsługa poda Ci dane do płatności."

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
  =======================================================
  NAJPIERW TWORZYMY PRYWATNY KANAŁ
  =======================================================
  */

  const privateChannel =
    await createPrivateOrderChannel(

      interaction.guild,

      interaction.user,

      orderId,

      name,

      payment,

      finalPrice

    );

  /*
  =======================================================
  ZAMÓWIENIE DO KANAŁU ZAMÓWIEŃ
  =======================================================
  */

  const orderEmbed =
    new EmbedBuilder()

      .setColor(0x55ff91)

      .setTitle(
        `🛒 NOWE ZAMÓWIENIE ${orderId}`
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
            name
        },

        {
          name:
            "💳 Płatność",

          value:
            payment
        },

        {
          name:
            "💰 Kwota",

          value:
            `${finalPrice.toFixed(2)} zł`
        },

        {
          name:
            "🆔 ID użytkownika",

          value:
            interaction.user.id
        },

        {
          name:
            "📁 Kanał zamówienia",

          value:
            privateChannel
              ? `<#${privateChannel.id}>`
              : "Nie utworzono"
        }

      )

      .setFooter({
        text:
          "KupGraj • Nowe zamówienie"
      })

      .setTimestamp();

  /*
  =======================================================
  PRZYCISKI DLA OBSŁUGI
  =======================================================
  */

  const row =
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
          )

      );

  /*
  =======================================================
  WYSŁANIE DO GŁÓWNEGO KANAŁU ZAMÓWIEŃ
  =======================================================
  */

  if (
    ORDERS_CHANNEL_ID
  ) {

    const ordersChannel =
      await getChannel(
        ORDERS_CHANNEL_ID
      );

    if (
      ordersChannel &&
      ordersChannel.isTextBased()
    ) {

      await ordersChannel.send({

        embeds: [
          orderEmbed
        ],

        components: [
          row
        ]

      });

    }

  }

  /*
  =======================================================
  ODPOWIEDŹ W STARYM TICKecie
  =======================================================
  */

  await interaction.update({

    embeds: [

      new EmbedBuilder()

        .setColor(0x55ff91)

        .setTitle(
          "✅ Zamówienie przyjęte!"
        )

        .setDescription(

          `Twoje zamówienie **${orderId}** zostało przyjęte.\n\n` +

          `📦 **Produkt:** ${name}\n` +

          `💰 **Kwota:** ${finalPrice.toFixed(2)} zł\n` +

          `💳 **Płatność:** ${payment}\n\n` +

          (
            privateChannel
              ? `📁 **Twój kanał zamówienia:** <#${privateChannel.id}>\n\n`
              : ""
          ) +

          "👨‍💼 **Obsługa poda Ci dane do płatności osobiście.**\n\n" +

          "⏳ Poczekaj na wiadomość od obsługi."

        )

        .setFooter({
          text:
            "KupGraj • Dziękujemy za zamówienie"
        })

        .setTimestamp()

    ],

    components: []

  });

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

  console.log(
    `🟡 Zamówienie ${orderId} jest realizowane przez ${interaction.user.tag}`
  );

}

/*
=========================================================
ANULUJ ZAMÓWIENIE
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

  console.log(
    `❌ Zamówienie ${orderId} anulowane przez ${interaction.user.tag}`
  );

}

/*
=========================================================
ZATWIERDŹ ZAMÓWIENIE
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

      ephemeral: true

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

  console.log(
    `✅ Zamówienie ${orderId} zatwierdzone przez właściciela ${interaction.user.tag}`
  );

  /*
  =====================================================
  LOG ZATWIERDZENIA
  =====================================================
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
