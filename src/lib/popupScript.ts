// Script que roda no site da loja. Desenha os popups dentro de um Shadow DOM (o tema não interfere),
// cuida dos gatilhos, da frequência e do cadastro. O mesmo script desenha a prévia do editor.
export const POPUP_SCRIPT = String.raw`(function(){
"use strict";
if (window.__rhPop) return; window.__rhPop = 1;
var me = document.currentScript;
var BASE = me && me.src ? me.src.replace(/\/api\/popups\/script\.js.*$/, "") : "";
var PREVIEW = !!window.RH_PREVIEW;
function ls(k, v){ try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch(e){ return null; } }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
function fmt(s){ return esc(s).replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/_([^_\n]+)_/g, "<i>$1</i>").replace(/\n/g, "<br>"); }
function hex(c, a){ c = (c || "#000").replace("#", ""); if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; var n = parseInt(c, 16); return "rgba(" + (n>>16&255) + "," + (n>>8&255) + "," + (n&255) + "," + a + ")"; }
function mobile(){ return PREVIEW ? (window.RH_PREVIEW.device === "celular") : window.matchMedia("(max-width: 640px)").matches; }
function pathOk(list, path){
  var items = String(list || "").split(",").map(function(x){ return x.trim(); }).filter(Boolean);
  return items.some(function(p){ var re = new RegExp("^" + p.replace(/[.+?^$()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"); return re.test(path) || path.indexOf(p) === 0 && p.length > 1; });
}
function maskPhone(v){
  var d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? "(" + d : "";
  if (d.length <= 6) return "(" + d.slice(0,2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
  return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
}
function utm(){ var o = {}; try { var q = new URLSearchParams(location.search); ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){ var v = q.get(k) || ls("rh_" + k); if (v) { o[k] = v; ls("rh_" + k, v); } }); } catch(e){} return o; }

var CSS = ""
+ ":host{all:initial}"
+ "*{box-sizing:border-box;margin:0;padding:0;font-family:inherit}"
+ ".rt{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:var(--tx)}"
+ ".ov{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:16px;animation:fd .25s ease}"
+ ".ov.lat{background:none!important;pointer-events:none;align-items:flex-end;justify-content:flex-end;padding:18px}"
+ ".ov.lat .bx{pointer-events:auto;max-width:360px}"
+ ".bx{position:relative;width:100%;max-width:720px;background:var(--bg);color:var(--tx);border-radius:var(--r);overflow:hidden;display:flex;box-shadow:0 30px 80px rgba(0,0,0,.45);animation:up .35s cubic-bezier(.2,.9,.3,1.2);max-height:calc(100vh - 32px)}"
+ ".bx.nimg{max-width:440px}"
+ ".bx.top{flex-direction:column;max-width:460px}"
+ ".bx.tela{max-width:none;width:100%;height:100%;max-height:none;border-radius:0;align-items:center;justify-content:center}"
+ ".bx.tela .ct{max-width:520px}"
+ ".im{flex:0 0 44%;background-size:cover;background-position:center;min-height:320px}"
+ ".bx.top .im{flex:0 0 auto;min-height:0;height:180px}"
+ ".ct{flex:1;padding:34px 30px 26px;display:flex;flex-direction:column;gap:12px;overflow:auto;text-align:center}"
+ "h2{font-size:25px;line-height:1.15;font-weight:800;letter-spacing:-.02em}"
+ ".tx{font-size:14.5px;line-height:1.5;opacity:.82}"
+ ".x{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;border-radius:50%;background:" + "rgba(127,127,127,.18);color:inherit;font-size:20px;line-height:32px;cursor:pointer;z-index:3}"
+ "form{display:flex;flex-direction:column;gap:9px;margin-top:4px}"
+ "input{width:100%;height:46px;border-radius:calc(var(--r)*.6);border:1.5px solid var(--ln);background:var(--fi);color:var(--tx);padding:0 14px;font-size:15px;outline:none}"
+ "input:focus{border-color:var(--ac)}"
+ "input::placeholder{color:var(--tx);opacity:.45}"
+ ".bt{height:48px;border:0;border-radius:calc(var(--r)*.6);background:var(--ac);color:var(--at);font-weight:800;font-size:15.5px;cursor:pointer;letter-spacing:.01em;transition:transform .12s,filter .12s;text-decoration:none;display:flex;align-items:center;justify-content:center;width:100%}"
+ ".bt:hover{filter:brightness(1.07)}.bt:active{transform:scale(.98)}.bt[disabled]{opacity:.6}"
+ ".ds{background:none;border:0;color:inherit;opacity:.55;font-size:12.5px;cursor:pointer;text-decoration:underline;margin-top:2px}"
+ ".cs{font-size:11.5px;opacity:.55;line-height:1.4}"
+ ".er{font-size:13px;color:#ff6b6b;min-height:0}"
+ ".cp{display:flex;align-items:center;justify-content:space-between;gap:10px;border:2px dashed var(--ac);border-radius:calc(var(--r)*.6);padding:12px 14px;font-size:20px;font-weight:800;letter-spacing:.06em}"
+ ".cp button{border:0;background:var(--ac);color:var(--at);border-radius:8px;padding:8px 12px;font-weight:700;font-size:12.5px;cursor:pointer;letter-spacing:0}"
+ ".cd{display:flex;gap:8px;justify-content:center}"
+ ".cd div{background:" + "rgba(127,127,127,.16);border-radius:10px;padding:8px 12px;min-width:64px}"
+ ".cd b{display:block;font-size:26px;font-variant-numeric:tabular-nums;color:var(--ac)}.cd small{font-size:10.5px;opacity:.6;text-transform:uppercase;letter-spacing:.08em}"
+ ".wh{position:relative;width:230px;height:230px;margin:2px auto 4px}"
+ ".wh svg{width:100%;height:100%;transition:transform 4.2s cubic-bezier(.12,.8,.18,1);filter:drop-shadow(0 8px 18px rgba(0,0,0,.35))}"
+ ".wh .pin{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:24px solid var(--ac);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));z-index:2}"
+ ".wh .hub{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px;border-radius:50%;background:var(--bg);border:4px solid var(--ac)}"
+ ".sc{position:relative;height:120px;border-radius:calc(var(--r)*.6);overflow:hidden;background:" + "rgba(127,127,127,.12);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:var(--ac);user-select:none}"
+ ".sc canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab}"
+ ".sch{font-size:12.5px;opacity:.6}"
+ ".bar{position:fixed;left:0;right:0;top:0;z-index:2147483600;background:var(--bg);color:var(--tx);display:flex;align-items:center;justify-content:center;gap:14px;padding:10px 46px 10px 16px;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.25);animation:dn .3s ease}"
+ ".bar b{font-weight:800}.bar .bt{height:34px;width:auto;padding:0 16px;font-size:13.5px}"
+ ".bar .x{top:50%;transform:translateY(-50%);width:28px;height:28px;line-height:28px;font-size:17px}"
+ ".wa{position:fixed;bottom:18px;z-index:2147483500;display:flex;align-items:center;gap:8px;background:#25d366;color:#fff;border-radius:30px;height:56px;min-width:56px;padding:0 16px;justify-content:center;box-shadow:0 10px 26px rgba(0,0,0,.28);text-decoration:none;font-weight:700;font-size:14.5px;animation:up .4s ease}"
+ ".wa svg{width:28px;height:28px;flex:none}"
+ "@keyframes fd{from{opacity:0}}@keyframes up{from{opacity:0;transform:translateY(24px) scale(.97)}}@keyframes dn{from{transform:translateY(-100%)}}"
+ "@media (max-width:640px){.bx{flex-direction:column;max-width:420px}.im{flex:0 0 auto;min-height:0;height:150px}.ct{padding:26px 20px 20px}h2{font-size:22px}.ov.lat{padding:10px}.ov.lat .bx{max-width:none}.bar{font-size:13px;gap:10px;flex-wrap:wrap}}";

var WA_ICON = '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.3c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.8-3.8-1.8-5.9C5 9.9 9.9 5.2 16 5.2S27 9.9 27 15.8s-4.9 10.5-11 10.5zm6-7.8c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.6-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.5c-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5.1 2.9 1.1 3.5.9 4.1.8.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4z"/></svg>';

function host(){
  var h = document.createElement("div");
  h.setAttribute("data-rh-popup", "");
  document.body.appendChild(h);
  var root = h.attachShadow ? h.attachShadow({ mode: "open" }) : h;
  var st = document.createElement("style"); st.textContent = CSS; root.appendChild(st);
  var wrap = document.createElement("div"); wrap.className = "rt"; root.appendChild(wrap);
  return { el: h, root: root, wrap: wrap };
}
function vars(el, c){
  var light = (function(h){ h = h.replace("#",""); if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; var n = parseInt(h,16); return ((n>>16&255)*299 + (n>>8&255)*587 + (n&255)*114)/1000 > 150; })(c.colors.bg || "#000");
  el.style.setProperty("--bg", c.colors.bg); el.style.setProperty("--tx", c.colors.text);
  el.style.setProperty("--ac", c.colors.accent); el.style.setProperty("--at", c.colors.accentText);
  el.style.setProperty("--r", (c.radius || 0) + "px");
  el.style.setProperty("--ln", light ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.16)");
  el.style.setProperty("--fi", light ? "rgba(0,0,0,.03)" : "rgba(255,255,255,.06)");
}

function wheelSvg(prizes, c){
  var n = Math.max(prizes.length, 1), R = 100, out = "";
  for (var i = 0; i < n; i++) {
    var a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
    var x0 = R + R * Math.cos(a0), y0 = R + R * Math.sin(a0), x1 = R + R * Math.cos(a1), y1 = R + R * Math.sin(a1);
    var fill = i % 2 ? c.colors.accent : hex(c.colors.text, .14);
    var tc = i % 2 ? c.colors.accentText : c.colors.text;
    var mid = (a0 + a1) / 2, tx = R + R * .62 * Math.cos(mid), ty = R + R * .62 * Math.sin(mid);
    out += '<path d="M' + R + ',' + R + ' L' + x0 + ',' + y0 + ' A' + R + ',' + R + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + x1 + ',' + y1 + ' Z" fill="' + fill + '" stroke="' + c.colors.bg + '" stroke-width="1.5"/>';
    out += '<text x="' + tx + '" y="' + ty + '" fill="' + tc + '" font-size="' + (n > 6 ? 9 : 11) + '" font-weight="800" text-anchor="middle" dominant-baseline="middle" transform="rotate(' + (mid * 180 / Math.PI + 90) + ' ' + tx + ' ' + ty + ')">' + esc(prizes[i] ? prizes[i].label : "") + '</text>';
  }
  return '<div class="wh"><div class="pin"></div><svg viewBox="0 0 200 200">' + out + '</svg><div class="hub"></div></div>';
}

function countdown(id, c, el){
  var key = "rh_cd_" + id, end = Number(ls(key) || 0);
  if (!end || end < Date.now() - 864e5) { end = Date.now() + (c.countdownMin || 15) * 60000; if (!PREVIEW) ls(key, String(end)); }
  function tick(){
    var s = Math.max(0, Math.round((end - Date.now()) / 1000));
    var m = Math.floor(s / 60), ss = s % 60;
    el.innerHTML = '<div><b>' + (m < 10 ? "0" : "") + m + '</b><small>min</small></div><div><b>' + (ss < 10 ? "0" : "") + ss + '</b><small>seg</small></div>';
    if (s > 0 && el.isConnected) setTimeout(tick, 1000);
  }
  tick();
}

function scratch(box, done){
  var cv = document.createElement("canvas"); box.appendChild(cv);
  var r = box.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = (r.width || 300) * dpr; cv.height = (r.height || 120) * dpr;
  var x = cv.getContext("2d"); x.scale(dpr, dpr);
  var g = x.createLinearGradient(0, 0, r.width, r.height); g.addColorStop(0, "#b9b9b9"); g.addColorStop(.5, "#e6e6e6"); g.addColorStop(1, "#a9a9a9");
  x.fillStyle = g; x.fillRect(0, 0, r.width || 300, r.height || 120);
  x.fillStyle = "#666"; x.font = "700 15px sans-serif"; x.textAlign = "center"; x.fillText("Raspe aqui", (r.width || 300) / 2, (r.height || 120) / 2 + 5);
  x.globalCompositeOperation = "destination-out";
  var down = false, finished = false, moves = 0;
  function at(e){ var b = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return [p.clientX - b.left, p.clientY - b.top]; }
  function draw(e){ if (!down || finished) return; e.preventDefault(); var p = at(e); x.beginPath(); x.arc(p[0], p[1], 22, 0, Math.PI * 2); x.fill(); if (++moves % 12 === 0) check(); }
  function check(){
    var d = x.getImageData(0, 0, cv.width, cv.height).data, clear = 0, tot = 0;
    for (var i = 3; i < d.length; i += 64) { tot++; if (d[i] === 0) clear++; }
    if (clear / tot > .5) { finished = true; cv.style.transition = "opacity .4s"; cv.style.opacity = "0"; setTimeout(function(){ cv.remove(); done(); }, 400); }
  }
  cv.addEventListener("pointerdown", function(e){ down = true; draw(e); });
  window.addEventListener("pointerup", function(){ down = false; });
  cv.addEventListener("pointermove", draw);
  cv.addEventListener("touchmove", draw, { passive: false });
}

// Desenha um popup. step: form | success. Em prévia, nada é gravado.
function render(p, opts){
  opts = opts || {};
  var c = p.cfg, H = opts.host || host();
  vars(H.wrap, c);
  H.wrap.innerHTML = "";
  var close = function(){ if (opts.onClose) opts.onClose(); if (!PREVIEW) H.el.remove(); };

  if (c.layout === "barra" && !opts.fromBar && opts.step !== "success") {
    var bar = document.createElement("div"); bar.className = "bar";
    bar.innerHTML = "<span><b>" + esc(c.title) + "</b>" + (c.text ? " · " + esc(c.text) : "") + '</span><button class="bt">' + esc(c.button) + '</button><button class="x" aria-label="Fechar">&times;</button>';
    bar.querySelector(".x").onclick = close;
    bar.querySelector(".bt").onclick = function(){ render(p, Object.assign({}, opts, { host: H, fromBar: true })); };
    H.wrap.appendChild(bar);
    return H;
  }
  var lay = c.layout === "barra" ? "centro" : c.layout;
  var ov = document.createElement("div"); ov.className = "ov" + (lay === "lateral" ? " lat" : "");
  ov.style.background = "rgba(0,0,0," + ((c.dim || 0) / 100) + ")";
  var img = c.image && c.imagePos !== "nenhuma" && lay !== "lateral" ? c.image : "";
  var bx = document.createElement("div"); bx.className = "bx" + (lay === "tela" ? " tela" : "") + (img ? (c.imagePos === "topo" ? " top" : "") : " nimg");
  bx.innerHTML = '<button class="x" aria-label="Fechar">&times;</button>' + (img ? '<div class="im" style="background-image:url(' + esc(img) + ')"></div>' : "") + '<div class="ct"></div>';
  ov.appendChild(bx); H.wrap.appendChild(ov);
  bx.querySelector(".x").onclick = close;
  if (lay !== "lateral") ov.addEventListener("click", function(e){ if (e.target === ov) close(); });
  var ct = bx.querySelector(".ct");

  function success(r){
    var s = c.success, coupon = r && r.coupon || s.coupon, label = r && r.label;
    ct.innerHTML = "<h2>" + esc(s.title) + "</h2>" + (label ? '<div class="tx" style="font-size:17px;opacity:1">Seu prêmio: <b>' + esc(label) + "</b></div>" : "") + (s.text ? '<div class="tx">' + fmt(s.text) + "</div>" : "")
      + (coupon ? '<div class="cp"><span>' + esc(coupon) + '</span><button type="button">Copiar</button></div>' : "")
      + (s.link ? '<a class="bt" href="' + esc(s.link) + '" target="_blank" rel="noopener">' + esc(s.button) + "</a>" : '<button class="bt" type="button">' + esc(s.button) + "</button>");
    var cb = ct.querySelector(".cp button"); if (cb) cb.onclick = function(){ try { navigator.clipboard.writeText(coupon); } catch(e){} cb.textContent = "Copiado"; };
    var b = ct.querySelector("button.bt"); if (b) b.onclick = close;
    if (!PREVIEW && coupon) try { sessionStorage.setItem("rh_coupon", coupon); } catch(e){}
  }

  if (opts.step === "success") { success(opts.result || (c.game ? { coupon: "PREMIO10", label: c.game.prizes[0] ? c.game.prizes[0].label : "" } : null)); return H; }

  var f = c.fields || {};
  ct.innerHTML = "<h2>" + esc(c.title) + "</h2>" + (c.text ? '<div class="tx">' + fmt(c.text) + "</div>" : "")
    + (c.countdownMin ? '<div class="cd"></div>' : "")
    + (c.game && c.game.type === "roleta" ? wheelSvg(c.game.prizes, c) : "")
    + '<form novalidate>'
    + (f.name ? '<input name="name" placeholder="Seu nome" autocomplete="given-name">' : "")
    + '<input name="phone" inputmode="tel" placeholder="Seu WhatsApp com DDD" autocomplete="tel" required>'
    + (f.email ? '<input name="email" type="email" placeholder="Seu e-mail" autocomplete="email">' : "")
    + (f.birthday ? '<input name="birthday" placeholder="Aniversário (dd/mm)" inputmode="numeric" maxlength="5">' : "")
    + '<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;height:1px;width:1px">'
    + '<div class="er"></div><button class="bt" type="submit">' + esc(c.button) + "</button>"
    + (c.consent ? '<div class="cs">' + esc(c.consent) + "</div>" : "")
    + "</form>" + (c.dismiss ? '<button class="ds" type="button">' + esc(c.dismiss) + "</button>" : "");
  if (c.countdownMin) countdown(p.id, c, ct.querySelector(".cd"));
  var ds = ct.querySelector(".ds"); if (ds) ds.onclick = close;
  var form = ct.querySelector("form"), ph = form.querySelector('[name="phone"]'), bd = form.querySelector('[name="birthday"]'), er = form.querySelector(".er");
  ph.addEventListener("input", function(){ ph.value = maskPhone(ph.value); });
  if (bd) bd.addEventListener("input", function(){ var d = bd.value.replace(/\D/g, "").slice(0, 4); bd.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; });
  form.onsubmit = function(e){
    e.preventDefault();
    var data = {}; Array.prototype.forEach.call(form.elements, function(i){ if (i.name) data[i.name] = i.value; });
    var digits = (data.phone || "").replace(/\D/g, "");
    if (digits.length < 10) { er.textContent = "Coloque seu WhatsApp com DDD."; return; }
    if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) { er.textContent = "Confira o e-mail."; return; }
    er.textContent = "";
    var btn = form.querySelector(".bt"); btn.disabled = true; btn.textContent = "Enviando...";
    var go = function(r){
      if (!r || !r.ok) { btn.disabled = false; btn.textContent = c.button; er.textContent = (r && r.error) || "Não deu certo, tente de novo."; return; }
      if (!PREVIEW) { ls("rh_pop_done_" + p.id, "1"); ls("rh_lead", "1"); }
      if (opts.onLead) opts.onLead();
      if (c.game && c.game.type === "roleta" && typeof r.prize === "number") {
        form.style.display = "none"; if (ds) ds.style.display = "none";
        var n = c.game.prizes.length, seg = 360 / n, target = 360 * 6 + (360 - (r.prize * seg + seg / 2));
        var svg = ct.querySelector(".wh svg"); svg.style.transform = "rotate(" + target + "deg)";
        setTimeout(function(){ success(r); }, 4400);
      } else if (c.game && c.game.type === "raspadinha") {
        form.style.display = "none"; if (ds) ds.style.display = "none";
        var box = document.createElement("div"); box.className = "sc"; box.textContent = r.label || "";
        var hint = document.createElement("div"); hint.className = "sch"; hint.textContent = "Raspe com o dedo ou o mouse";
        ct.appendChild(box); ct.appendChild(hint);
        setTimeout(function(){ scratch(box, function(){ setTimeout(function(){ success(r); }, 900); }); }, 30);
      } else success(r);
    };
    if (PREVIEW) {
      var pr = c.game && c.game.prizes.length ? Math.floor(Math.random() * c.game.prizes.length) : undefined;
      setTimeout(function(){ go({ ok: true, prize: pr, label: pr !== undefined ? c.game.prizes[pr].label : undefined, coupon: pr !== undefined ? (c.game.prizes[pr].code || "PREMIO") : c.success.coupon }); }, 500);
      return;
    }
    var body = Object.assign({ id: p.id }, utm(), data);
    fetch(BASE + "/api/popups/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function(x){ return x.json(); }).then(go).catch(function(){ go(null); });
  };
  return H;
}

function waButton(w){
  if (!w || !w.phone) return;
  var H = host();
  var a = document.createElement("a"); a.className = "wa";
  a.href = "https://wa.me/" + String(w.phone).replace(/\D/g, "") + (w.text ? "?text=" + encodeURIComponent(w.text) : "");
  a.target = "_blank"; a.rel = "noopener"; a.style[w.pos === "esquerda" ? "left" : "right"] = "18px";
  a.innerHTML = WA_ICON + (w.label ? "<span>" + esc(w.label) + "</span>" : "");
  a.setAttribute("aria-label", "Falar no WhatsApp");
  H.wrap.appendChild(a);
}

/* ---------- Prévia do editor ---------- */
if (PREVIEW) {
  var PH = null;
  var draw = function(d){ if (!PH) PH = host(); render({ id: "preview", cfg: d.cfg }, { host: PH, step: d.step }); };
  window.addEventListener("message", function(e){ if (e.data && e.data.rhPreview) { window.RH_PREVIEW = e.data.rhPreview; draw(e.data.rhPreview); } });
  if (document.body) draw(window.RH_PREVIEW); else document.addEventListener("DOMContentLoaded", function(){ draw(window.RH_PREVIEW); });
  return;
}

/* ---------- No site ---------- */
var shown = false;
function eligible(p){
  var c = p.cfg, a = c.audience || {}, t = c.trigger || {};
  if (a.device === "celular" && !mobile()) return false;
  if (a.device === "computador" && mobile()) return false;
  var path = location.pathname;
  if (a.include && !pathOk(a.include, path)) return false;
  if (a.exclude && pathOk(a.exclude, path)) return false;
  if (t.hideConverted !== false && (ls("rh_pop_done_" + p.id) || ls("rh_lead"))) return false;
  var last = Number(ls("rh_pop_" + p.id) || 0);
  if (last && Date.now() - last < (t.freqDays || 0) * 864e5) return false;
  return true;
}
function show(p){
  if (shown) return; shown = true;
  ls("rh_pop_" + p.id, String(Date.now()));
  try { fetch(BASE + "/api/popups/view?id=" + encodeURIComponent(p.id), { method: "POST", keepalive: true }); } catch(e){}
  render(p, {});
}
function arm(p){
  var t = p.cfg.trigger || {}, fire = function(){ show(p); };
  if (p.cfg.layout === "barra" || t.when === "imediato") return setTimeout(fire, 300);
  if (t.when === "segundos") return setTimeout(fire, (t.seconds || 5) * 1000);
  if (t.when === "rolagem") {
    var onS = function(){ var h = document.documentElement; if ((h.scrollTop + innerHeight) / h.scrollHeight * 100 >= (t.scrollPct || 40)) { removeEventListener("scroll", onS); fire(); } };
    return addEventListener("scroll", onS, { passive: true });
  }
  if (t.when === "inatividade") {
    var tm, reset = function(){ clearTimeout(tm); tm = setTimeout(fire, (t.seconds || 20) * 1000); };
    ["mousemove","keydown","scroll","touchstart"].forEach(function(ev){ addEventListener(ev, reset, { passive: true }); }); return reset();
  }
  if (t.when === "saida") {
    if (mobile()) {
      var lastY = scrollY, lastT = Date.now();
      setTimeout(function(){ addEventListener("scroll", function(){ var now = Date.now(), dy = lastY - scrollY, dt = now - lastT; if (dy > 120 && dt < 300) fire(); lastY = scrollY; lastT = now; }, { passive: true }); }, 8000);
      return setTimeout(fire, 45000);
    }
    return document.addEventListener("mouseout", function(e){ if (!e.relatedTarget && e.clientY <= 0) fire(); });
  }
  setTimeout(fire, 6000);
}
function start(){
  fetch(BASE + "/api/popups/active").then(function(r){ return r.json(); }).then(function(d){
    (d.popups || []).filter(eligible).forEach(arm);
    if (d.wa) waButton(d.wa);
  }).catch(function(){});
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();`;
