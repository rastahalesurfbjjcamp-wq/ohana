// Clube Rasta Hale na loja: coroa no cabeçalho, aviso pequeno e altura da página do clube. Carregado pela Shopify (ScriptTag).
(function(){
  if (window.__rhClub) return; window.__rhClub = 1;
  var st = document.createElement('style');
  st.textContent = '.rh-club{position:relative;display:inline-flex;align-items:center} .rh-club .rh-ic{display:inline-flex!important;align-items:center;justify-content:center;width:40px;height:40px;color:inherit;position:relative} .rh-club .rh-ic svg{width:21px;height:21px} .rh-club .rh-ic i{position:absolute;top:8px;right:7px;width:6px;height:6px;border-radius:50%;background:#f2c200;box-shadow:0 0 0 2px #fff} .rh-club .rh-tip{position:absolute!important;top:calc(100% + 2px);right:-6px;left:auto;transform:translateY(-4px);opacity:0;pointer-events:none;display:block!important;width:auto!important;height:auto!important;background:#111!important;color:#fff!important;font:600 11px/1 -apple-system,system-ui,sans-serif!important;letter-spacing:0!important;text-transform:none!important;white-space:nowrap;padding:7px 9px!important;border-radius:7px;transition:opacity .3s,transform .3s;z-index:50;text-decoration:none!important;box-shadow:0 4px 14px rgba(0,0,0,.18)} .rh-club .rh-tip:before{content:"";position:absolute;top:-4px;right:22px;border:4px solid transparent;border-top:0;border-bottom-color:#111} .rh-club .rh-tip b{color:#f2c200} .rh-club .rh-tip.on{opacity:1;transform:none;pointer-events:auto} @media (max-width:749px){ header .header__columns.rh-has-club{grid-template-columns:44px 44px 1fr 132px!important} header .header__columns.rh-has-club header-actions{grid-column:4!important;justify-self:end} }';
  (document.head || document.documentElement).appendChild(st);
})();
// Link de referência do atleta: ?ref=CODIGO vira cookie de 1 dia; o carrinho recebe o cupom e a marca rh_ref, que vai para o pedido.
(function () {
  var DAYS = 1, K = 'rh_ref';
  function read() { var m = document.cookie.match(/(?:^|; )rh_ref=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }
  var q = null;
  try { q = new URLSearchParams(location.search).get('ref'); } catch (e) {}
  if (q && /^[A-Za-z0-9_-]{2,40}$/.test(q)) document.cookie = K + '=' + encodeURIComponent(q.toUpperCase()) + '; max-age=' + DAYS * 86400 + '; path=/; SameSite=Lax';
  var code = read();
  if (!code || !window.fetch) return;
  var busy = false;
  function sync() {
    if (busy) return; busy = true;
    window.__rhFetch('/cart.js', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (cart) {
      if (!cart || !cart.item_count) return;
      var body = {};
      if ((cart.attributes || {})[K] !== code) body.attributes = { rh_ref: code };
      // garante o cupom do atleta; mantém cupom válido que o cliente colocou e tira cupom velho que não vale mais
      var dc = cart.discount_codes || [], has = false, keep = [];
      for (var i = 0; i < dc.length; i++) { var cc = String(dc[i].code).toUpperCase(); if (cc === code) has = true; else if (dc[i].applicable) keep.push(dc[i].code); }
      if (!has || keep.length !== dc.length - 1) body.discount = [code].concat(keep).join(',');
      if (!body.attributes && !body.discount) return;
      return window.__rhFetch('/cart/update.js', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }).catch(function () {}).then(function () { busy = false; });
  }
  // depois de adicionar ou mudar item no carrinho, confere de novo
  window.__rhFetch = window.__rhFetch || window.fetch.bind(window);
  window.fetch = function (u) {
    var p = window.__rhFetch.apply(window, arguments);
    var url = typeof u === 'string' ? u : (u && u.url) || '';
    if (/\/cart\/(add|change)/.test(url)) p.then(function () { setTimeout(sync, 300); }).catch(function () {});
    return p;
  };
  sync();
})();
(function () {
    var p = location.pathname;
    // página do clube: a assinatura do Hub fica embutida e a altura acompanha o conteúdo
    window.addEventListener('message', function (e) {
      if (e.origin !== 'https://rastahale.tech' || !e.data || !e.data.rhClubHeight) return;
      var f = document.getElementById('rh-club-frame');
      if (f) f.style.height = e.data.rhClubHeight + 'px';
    });
    if (/^\/(cart|checkouts?|pages\/clube)/.test(p)) return;
    var LINK = '/pages/clube';
    var CROWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/></svg>';
    function add() {
      if (document.querySelector('.rh-club')) return true;
      var ha = document.querySelector('header-actions');
      if (!ha) return false;
      var ab = ha.querySelector('.account-button') || ha.firstElementChild;
      var w = document.createElement('div');
      w.className = 'rh-club';
      w.innerHTML = '<a class="rh-ic" href="' + LINK + '" aria-label="Clube Rasta Hale">' + CROWN + '<i></i></a><a class="rh-tip" href="' + LINK + '">Assine o clube e ganhe <b>10%</b></a>';
      ha.insertBefore(w, ab);
      var cols = ha.closest('.header__columns');
      if (cols) cols.classList.add('rh-has-club');
      // aviso: depois de 10s, some em 6s, no máximo a cada 3 dias
      var KEY = 'rh_club_tip', last = 0;
      try { last = +localStorage.getItem(KEY) || 0; } catch (e) {}
      if (Date.now() - last > 3 * 864e5) {
        setTimeout(function () {
          var t = w.querySelector('.rh-tip');
          t.classList.add('on');
          try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
          setTimeout(function () { t.classList.remove('on'); }, 6000);
        }, 10000);
      }
      return true;
    }
    if (!add()) document.addEventListener('DOMContentLoaded', add);
  })();
