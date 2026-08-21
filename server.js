const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/webhook", (req, res) => {
  console.log("Otrzymano zamówienie:", req.body);
  res.json({ success: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sklep działa na porcie ${PORT}`);
});
