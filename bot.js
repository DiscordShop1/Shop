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
app.use(cors({ origin: true }));
app.use(express.json({ limit: "100kb" }));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PORT = process.env.PORT || 3000;
const ORDER_CHANNEL_NAME = "zamówienia";

function findOrdersChannel(guild) {
  return guild.channels.cache.find(
    channel => channel.isTextBased() && channel.name.includes(ORDER_CHANNEL_NAME)
  );
}

app.get("/", (req,res) => res.json({ok:true, service:"Kupujemy Bot API"}));
app.get("/health", (req,res) => res.json({ok:true, discord:client.isReady()}));

app.post("/api/order", async (req,res) => {
  try {
    if (process.env.ORDER_API_KEY && req.headers["x-order-key"] !== process.env.ORDER_API_KEY) {
      return res.status(401).json({error:"Nieprawidłowy klucz API."});
    }
    if (!client.isReady()) return res.status(503).json({error:"Bot Discord nie jest jeszcze gotowy."});

    const { discord, payment, extra, items, total, baseTotal, surcharge } = req.body || {};
    if (!discord || !payment || !Array.isArray(items) || !items.length) {
      return res.status(400).json({error:"Brak wymaganych danych zamówienia."});
    }
    if (!["BLIK","Paysafecard"].includes(payment)) {
      return res.status(400).json({error:"Nieprawidłowa metoda płatności."});
    }

    const guild = client.guilds.cache.first();
    if (!guild) return res.status(503).json({error:"Bot nie znajduje serwera Discord."});

    const channel = findOrdersChannel(guild);
    if (!channel) return res.status(404).json({error:`Nie znaleziono kanału ${ORDER_CHANNEL_NAME}.`});

    const productLines = items.map(i => `• ${i.quantity}× ${i.name} — ${i.price} zł`).join("\n");
    const category = items.some(i => i.name.startsWith("Minecraft")) ? "Minecraft Premium" :
                     items.some(i => i.name.startsWith("Konfiguracja Discord")) ? "Konfiguracja Discord" :
                     "Inne gry";

    const embed = new EmbedBuilder()
      .setTitle("🛒 NOWE ZAMÓWIENIE — KUPUJEMY")
      .setColor(0x57F287)
      .addFields(
        {name:"📦 Kategoria",value:category,inline:true},
        {name:"🛍️ Produkty",value:productLines.slice(0,1024),inline:false},
        {name:"💰 Kwota bazowa",value:`${Number(baseTotal || total).toFixed(2).replace(".00","")} zł`,inline:true},
        {name:"💳 Płatność",value:payment,inline:true},
        {name:"💵 Do zapłaty",value:`${Number(total).toFixed(2).replace(".00","")} zł`,inline:true},
        {name:"👤 Discord",value:String(discord).slice(0,1024),inline:true},
        {name:"📝 Dodatkowe informacje",value:String(extra || "Brak").slice(0,1024),inline:false}
      )
      .setFooter({text:`Kupujemy • ${new Date().toLocaleString("pl-PL")}`})
      .setTimestamp();

    if (payment === "Paysafecard") {
      embed.addFields({name:"➕ Dopłata Paysafecard",value:`+10% = ${Number(surcharge || 0).toFixed(2).replace(".00","")} zł`,inline:true});
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("order_realize").setLabel("REALIZUJ").setEmoji("🟢").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("order_cancel").setLabel("ANULUJ").setEmoji("🔴").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("order_accept").setLabel("ZATWIERDŹ").setEmoji("✅").setStyle(ButtonStyle.Primary)
    );

    await channel.send({content:"📨 **NOWE ZAMÓWIENIE!**",embeds:[embed],components:[row]});
    res.json({ok:true});
  } catch (err) {
    console.error(err);
    res.status(500).json({error:"Wystąpił błąd podczas wysyłania zamówienia."});
  }
});

client.once("ready", () => {
  console.log(`✅ Bot uruchomiony jako ${client.user.tag}`);
  console.log(`🌐 API działa na porcie ${PORT}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!["order_realize","order_cancel","order_accept"].includes(interaction.customId)) return;

  const labels = {
    order_realize: "🟢 Zamówienie oznaczone jako REALIZOWANE.",
    order_cancel: "🔴 Zamówienie ANULOWANE.",
    order_accept: "✅ Zamówienie ZATWIERDZONE."
  };

  await interaction.reply({content:`${labels[interaction.customId]}\n👤 Obsługa: ${interaction.user}`, ephemeral:false});
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content === "!test") {
    await message.reply("✅ Kupujemy-BOT działa poprawnie!");
  }
});

app.listen(PORT, () => console.log(`🌐 HTTP API nasłuchuje na porcie ${PORT}`));
client.login(process.env.DISCORD_TOKEN);
