# Kupujemy — strona + bot

## Struktura
- `website/` — nowa strona sklepu
- `bot/` — bot Discord + API do przyjmowania zamówień
- `render.yaml` — przykładowa konfiguracja Render

## Ważne
Token Discord NIE jest zapisany w projekcie. Na Render ustaw:
- `DISCORD_TOKEN`
- `ORDER_API_KEY`

`ORDER_API_KEY` musi być taki sam po stronie API i strony, jeśli zdecydujemy się na dodatkową autoryzację żądań.

## Strona
W `website/script.js` ustaw:
`BOT_API_URL` na publiczny adres usługi Render, np. `https://kupujemy-bot.onrender.com`.

## Discord
Bot szuka kanału zawierającego w nazwie `zamówienia`, więc obsłuży:
`⌊📨⌉zamówienia`

## Aktualny przepływ
Strona → koszyk → formularz → API bota → Discord → `⌊📨⌉zamówienia`

Przyciski w zamówieniu:
- REALIZUJ
- ANULUJ
- ZATWIERDŹ
