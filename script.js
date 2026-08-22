const CONFIG = {
  // Po wdrożeniu ustaw tutaj publiczny adres API bota z Render, np. https://kupujemy-bot.onrender.com
  BOT_API_URL: "https://kupujemy.onrender.com"
};

const cart = [];
const cartCount = document.getElementById("cartCount");
const cartOverlay = document.getElementById("cartOverlay");
const orderOverlay = document.getElementById("orderOverlay");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const orderSummary = document.getElementById("orderSummary");
const formStatus = document.getElementById("formStatus");

function total() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}
function money(n) { return `${n.toFixed(2).replace(".00","")} zł`; }

function renderCart() {
  cartCount.textContent = cart.reduce((s,i)=>s+i.qty,0);
  if (!cart.length) {
    cartItems.innerHTML = '<div class="empty-cart">Koszyk jest pusty.</div>';
  } else {
    cartItems.innerHTML = cart.map((item,i)=>`
      <div class="cart-item">
        <div><strong>${item.name}</strong><br><small>${item.qty} × ${money(item.price)}</small></div>
        <button class="remove-item" data-index="${i}">Usuń</button>
      </div>`).join("");
  }
  cartTotal.textContent = money(total());
  document.querySelectorAll(".remove-item").forEach(btn=>{
    btn.onclick=()=>{ cart.splice(Number(btn.dataset.index),1); renderCart(); };
  });
}

document.querySelectorAll(".buy-btn:not(:disabled)").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const card = btn.closest(".product-card");
    const id = card.dataset.id;
    const existing = cart.find(x=>x.id===id);
    if(existing) existing.qty++;
    else cart.push({id,name:card.dataset.name,price:Number(card.dataset.price),qty:1});
    renderCart();
    cartOverlay.classList.add("open");
  });
});

document.getElementById("openCart").onclick=()=>cartOverlay.classList.add("open");
document.getElementById("closeCart").onclick=()=>cartOverlay.classList.remove("open");
cartOverlay.addEventListener("click",e=>{if(e.target===cartOverlay)cartOverlay.classList.remove("open")});

document.getElementById("checkoutBtn").onclick=()=>{
  if(!cart.length) return;
  cartOverlay.classList.remove("open");
  formStatus.innerHTML="";
  updateSummary();
  orderOverlay.classList.add("open");
};
document.getElementById("closeOrder").onclick=()=>orderOverlay.classList.remove("open");
orderOverlay.addEventListener("click",e=>{if(e.target===orderOverlay)orderOverlay.classList.remove("open")});

function updateSummary() {
  const payment = document.querySelector('select[name="payment"]').value;
  const surcharge = payment === "Paysafecard" ? total() * .10 : 0;
  const final = total()+surcharge;
  orderSummary.innerHTML = cart.map(i=>`${i.qty}× ${i.name} — ${money(i.price*i.qty)}`).join("<br>") +
    `<hr style="border:0;border-top:1px solid rgba(255,255,255,.08)">
     Suma: <strong>${money(total())}</strong><br>
     ${payment==="Paysafecard" ? `+10% Paysafecard: <strong>${money(surcharge)}</strong><br>`:""}
     Do zapłaty: <strong>${money(final)}</strong>`;
}
document.querySelector('select[name="payment"]').addEventListener("change",updateSummary);

document.getElementById("orderForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!cart.length) return;
  const data = new FormData(e.target);
  const payment = data.get("payment");
  const baseTotal = total();
  const surcharge = payment === "Paysafecard" ? baseTotal*.10 : 0;
  const payload = {
    discord: data.get("discord"),
    payment,
    extra: data.get("extra") || "Brak",
    items: cart.map(i=>({name:i.name,price:i.price,quantity:i.qty})),
    total: baseTotal+surcharge,
    baseTotal,
    surcharge
  };

  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled=true; btn.textContent="Wysyłanie...";
  formStatus.innerHTML="";

  try {
    if(!CONFIG.BOT_API_URL || CONFIG.BOT_API_URL.includes("TWOJ-BOT-NA-RENDER")) {
      throw new Error("Najpierw ustaw adres API bota z Render w pliku script.js.");
    }
    const res = await fetch(`${CONFIG.BOT_API_URL}/api/order`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const result = await res.json();
    if(!res.ok) throw new Error(result.error || "Nie udało się wysłać zamówienia.");
    formStatus.innerHTML='<div class="status-ok">✅ Zamówienie zostało wysłane do obsługi na Discordzie!</div>';
    cart.length=0; renderCart();
    e.target.reset(); updateSummary();
  } catch(err) {
    formStatus.innerHTML=`<div class="status-error">❌ ${err.message}</div>`;
  } finally {
    btn.disabled=false; btn.textContent="🚀 Wyślij zamówienie";
  }
});

// Filtry produktów
function setFilter(filter) {
  document.querySelectorAll(".product-card").forEach(card=>{
    const cat=card.dataset.category;
    card.style.display=(filter==="all" || cat===filter) ? "" : "none";
  });
  document.querySelectorAll(".filter").forEach(b=>b.classList.toggle("active",b.dataset.filter===filter));
  document.getElementById("sklep").scrollIntoView({behavior:"smooth",block:"start"});
}
document.querySelectorAll(".filter").forEach(btn=>btn.onclick=()=>setFilter(btn.dataset.filter));
document.querySelectorAll(".category-card").forEach(btn=>btn.onclick=()=>{
  const f=btn.dataset.filter;
  if(f==="other") { setFilter("other"); return; }
  setFilter(f);
});

// Scroll reveal
const observer=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add("visible")});
},{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));

// Cursor glow
document.addEventListener("pointermove",e=>{
  document.querySelector(".cursor-glow").style.left=e.clientX+"px";
  document.querySelector(".cursor-glow").style.top=e.clientY+"px";
});
renderCart();
