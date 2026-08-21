<!doctype html>
<html lang="pl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Twój Sklep • Premium</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css"></head><body>
<header><a class="brand">✦ TWÓJ<span>SKLEP</span></a><nav><a href="#oferta">Oferta</a><a href="#dlaczego">Dlaczego my?</a><a href="#faq">FAQ</a></nav><button id="openCart">🛒 Koszyk <b id="count">0</b></button></header>
<main>
<section class="hero"><div><small>● OFICJALNY SKLEP</small><h1>Wybierz. Zamów.<strong>Ciesz się.</strong></h1><p>Premium produkty Minecraft, konfiguracje Discord i usługi wykonane z dbałością o szczegóły.</p><a class="btn" href="#oferta">Zobacz ofertę →</a></div><div class="banner"><b>TWÓJ BANER</b><span>Tu wstawimy Twój baner</span><i>💎 MC PREMIUM</i><em>⚙️ DISCORD</em></div></section>
<section id="oferta"><small>● NASZA OFERTA</small><h2>Co oferujemy?</h2><div id="filters"></div><div id="products" class="products"></div></section>
<section id="dlaczego"><small>● DLACZEGO MY?</small><h2>Prosto, szybko i profesjonalnie.</h2><div class="benefits"><article>⚡<h3>Szybka realizacja</h3><p>Po zamówieniu otrzymujesz informacje na Discordzie.</p></article><article>🛡️<h3>Bezpieczne zamówienie</h3><p>Dane trafiają bezpośrednio do naszego systemu.</p></article><article>💬<h3>Kontakt na Discordzie</h3><p>Łatwy kontakt w sprawie każdego zamówienia.</p></article></div></section>
<section id="faq"><small>● FAQ</small><h2>Najczęstsze pytania</h2><details><summary>Jak złożyć zamówienie?</summary><p>Dodaj produkty do koszyka, uzupełnij dane i wyślij formularz.</p></details><details><summary>Gdzie trafia zamówienie?</summary><p>Na skonfigurowany kanał Discord przez webhook.</p></details></section>
</main><footer>✦ TWÓJSKLEP <span>© 2026</span></footer>

<aside id="drawer"><div class="drawerHead"><h2>Koszyk</h2><button id="closeCart">×</button></div><div id="cart"></div><div class="sum"><b>Razem</b><strong id="total">0,00 zł</strong><button class="btn" id="checkout">Złóż zamówienie →</button></div></aside>
<div id="modal"><div class="modalCard"><button id="closeModal">×</button><small>● FINALIZACJA</small><h2>Złóż zamówienie</h2><form id="form"><input name="name" required placeholder="Imię / nazwa"><input name="contact" required placeholder="Discord / kontakt"><textarea name="message" placeholder="Wiadomość"></textarea><button class="btn">Wyślij zamówienie 🚀</button></form><p id="result"></p></div></div>
<script src="/app.js"></script></body></html>
