const products=[
{id:"mc1",cat:"MC PREMIUM",name:"Minecraft Premium",price:29.99,icon:"💎",desc:"Premiumowa usługa / pakiet Minecraft."},
{id:"mc2",cat:"MC PREMIUM",name:"Ranga Minecraft",price:19.99,icon:"⛏️",desc:"Ranga z dodatkowymi przywilejami."},
{id:"mc3",cat:"MC PREMIUM",name:"Pakiet Diamentowy",price:49.99,icon:"🟦",desc:"Rozbudowany pakiet dla gracza."},
{id:"dc1",cat:"DISCORD",name:"Konfiguracja Discorda",price:39.99,icon:"⚙️",desc:"Konfiguracja serwera, kanałów i uprawnień."},
{id:"dc2",cat:"DISCORD",name:"Bot Discord",price:59.99,icon:"🤖",desc:"Wdrożenie i konfiguracja robota Discord."},
{id:"dc3",cat:"DISCORD",name:"Setup Premium",price:89.99,icon:"🛡️",desc:"Kompleksowy estetyczny setup serwera."}];
let cat="WSZYSTKO",cart=JSON.parse(localStorage.cart||"[]");
const filters=document.querySelector("#filters"),productsEl=document.querySelector("#products"),drawer=document.querySelector("#drawer");
["WSZYSTKO",...new Set(products.map(x=>x.cat))].forEach(x=>{let b=document.createElement("button");b.className="filter"+(x===cat?" active":"");b.textContent=x;b.onclick=()=>{cat=x;document.querySelectorAll(".filter").forEach(y=>y.classList.remove("active"));b.classList.add("active");render()};filters.appendChild(b)});
function render(){productsEl.innerHTML=products.filter(x=>cat==="WSZYSTKO"||x.cat===cat).map(x=>`<article class="product"><div class="icon">${x.icon}</div><small>${x.cat}</small><h3>${x.name}</h3><p>${x.desc}</p><div class="bottom"><span class="price">${x.price.toFixed(2).replace(".",",")} zł</span><button onclick="add('${x.id}')">Dodaj do koszyka</button></div></article>`).join("");renderCart()}
function add(id){let x=cart.find(y=>y.id===id);x?x.q++:cart.push({...products.find(y=>y.id===id),q:1});save();drawer.classList.add("open")}
function save(){localStorage.cart=JSON.stringify(cart);renderCart()}
function renderCart(){document.querySelector("#count").textContent=cart.reduce((s,x)=>s+x.q,0);let total=cart.reduce((s,x)=>s+x.price*x.q,0);document.querySelector("#total").textContent=total.toFixed(2).replace(".",",")+" zł";document.querySelector("#cart").innerHTML=cart.length?cart.map(x=>`<div class="cartRow"><div>${x.icon} <b>${x.name}</b><br><small>${(x.price*x.q).toFixed(2)} zł</small></div><div class="qty"><button onclick="qty('${x.id}',-1)">−</button>${x.q}<button onclick="qty('${x.id}',1)">+</button></div></div>`).join(""):`<p style="color:#aaa6b4;text-align:center;padding:40px">Koszyk jest pusty 🛒</p>`}
function qty(id,d){let x=cart.find(y=>y.id===id);if(!x)return;x.q+=d;if(x.q<=0)cart=cart.filter(y=>y.id!==id);save()}
document.querySelector("#openCart").onclick=()=>drawer.classList.add("open");document.querySelector("#closeCart").onclick=()=>drawer.classList.remove("open");
document.querySelector("#checkout").onclick=()=>{if(!cart.length)return alert("Dodaj produkt do koszyka.");document.querySelector("#modal").style.display="grid";drawer.classList.remove("open")};
document.querySelector("#closeModal").onclick=()=>document.querySelector("#modal").style.display="none";
document.querySelector("#form").onsubmit=async e=>{e.preventDefault();let f=new FormData(e.target),total=cart.reduce((s,x)=>s+x.price*x.q,0),r=document.querySelector("#result");r.textContent="Wysyłanie...";try{let q=await fetch("/api/order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer:{name:f.get("name"),contact:f.get("contact"),message:f.get("message")},cart:cart.map(x=>({name:x.name,price:x.price,quantity:x.q})),total})});let d=await q.json();if(!q.ok)throw Error(d.error);r.textContent="✅ Zamówienie "+d.orderId+" zostało wysłane na Discorda!";cart=[];save();e.target.reset()}catch(err){r.textContent="❌ "+err.message}};
render();
