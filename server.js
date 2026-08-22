const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

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
        (item) =>
          `• ${item.name} × ${item.quantity} — ${(item.price * item.quantity).toFixed(2)} zł`
      )
      .join("\n");

    if (DISCORD_WEBHOOK_URL) {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content:
            `🛒 **NOWE ZAMÓWIENIE ${orderId}**\n\n` +
            `👤 **Klient:** ${customer.name}\n` +
            `📞 **Kontakt:** ${customer.contact}\n` +
            `💬 **Wiadomość:** ${customer.message || "Brak"}\n\n` +
            `📦 **Produkty:**\n${products}\n\n` +
            `💰 **Suma: ${Number(total).toFixed(2)} zł**`
        })
      });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sklep działa na porcie ${PORT}`);
});
