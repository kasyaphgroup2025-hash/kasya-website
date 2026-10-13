/* Payday Sale bundle builder (Kasya). Preview pricing only; Shopify's automatic discounts set the real price. */
(function () {
  if (customElements.get('payday-bundle')) return;

  var SWATCH_HEX = {
    'black': '#1f1f1f', 'choco brown': '#5a3b2a', 'navy blue': '#23304a', 'emerald green': '#1f5e4a',
    'army green': '#4b5320', 'red': '#a3262a', 'dark teal': '#1e4f55', 'gray': '#8a8a87', 'grey': '#8a8a87',
    'skintone': '#d9b99b', 'warm sand': '#cdb89a', 'dusty lilac': '#b6a2b8', 'warm taupe': '#9a8576'
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(cents) {
    var v = Math.round(cents) / 100;
    var whole = Math.round(cents) % 100 === 0;
    return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  }

  function publish(name, data) {
    try {
      if (window.Shopify && Shopify.analytics && typeof Shopify.analytics.publish === 'function') {
        Shopify.analytics.publish(name, data || {});
      }
    } catch (e) { /* analytics must never break the page */ }
  }

  class PaydayBundle extends HTMLElement {
    connectedCallback() {
      var cfgEl = this.querySelector('[data-payday-config]');
      if (!cfgEl) return;
      this.cfg = JSON.parse(cfgEl.textContent);
      this.root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';

      var names = (this.cfg.options || []).map(function (o) { return String(o).toLowerCase(); });
      this.colorIdx = names.findIndex(function (n) { return /colou?r/.test(n); });
      this.sizeIdx = names.findIndex(function (n) { return /size/.test(n); });
      if (this.colorIdx < 0) this.colorIdx = 1;
      if (this.sizeIdx < 0) this.sizeIdx = 0;

      var self = this;
      this.variants = this.cfg.variants.map(function (v) {
        return {
          id: v.id, price: v.price, available: v.available, image: v.image,
          color: v.options[self.colorIdx], size: v.options[self.sizeIdx],
          limited: v.managed === 'shopify' && v.policy === 'deny',
          qty: v.qty
        };
      });
      this.colors = [];
      this.sizes = [];
      this.variants.forEach(function (v) {
        if (self.colors.indexOf(v.color) === -1) self.colors.push(v.color);
        if (self.sizes.indexOf(v.size) === -1) self.sizes.push(v.size);
      });
      this.tiers = this.cfg.tiers.slice().sort(function (a, b) { return a.min - b.min; });
      this.price = this.variants.length ? this.variants[0].price : 0;

      var firstAvailable = this.variants.find(function (v) { return v.available; });
      this.state = {
        color: firstAvailable ? firstAvailable.color : this.colors[0],
        size: null,
        items: [],
        target: this.cfg.defaultTarget || 3
      };
      this.maxTierReached = 0;

      this.$ = function (sel) { return self.querySelector(sel); };
      this.buildStatic();
      this.bind();
      this.render();
      this.prefillFromCart();
      publish('payday_page_view', { product_id: this.cfg.productId });
    }

    /* ---------- helpers ---------- */
    variantFor(color, size) {
      return this.variants.find(function (v) { return v.color === color && v.size === size; });
    }
    variantById(id) {
      return this.variants.find(function (v) { return v.id === id; });
    }
    count() {
      return this.state.items.reduce(function (s, i) { return s + i.qty; }, 0);
    }
    qtyOf(id) {
      var it = this.state.items.find(function (i) { return i.id === id; });
      return it ? it.qty : 0;
    }
    pctFor(n) {
      var pct = 0;
      this.tiers.forEach(function (t) { if (n >= t.min) pct = t.pct; });
      return pct;
    }
    costFor(n) {
      return n * this.price * (1 - this.pctFor(n) / 100);
    }
    maxFor(v) {
      return v.limited ? Math.max(0, v.qty) : Infinity;
    }
    sizeParts(size) {
      var parts = String(size).trim().split(/\s+/);
      var short = parts.shift();
      var rest = parts.join(' ').replace(/^on\s+/i, '').replace(/^tag/i, 'Tag');
      return { short: short, detail: rest };
    }
    swatchStyle(color) {
      var hex = SWATCH_HEX[String(color).toLowerCase()];
      if (hex) return 'background:' + hex;
      var v = this.variants.find(function (x) { return x.color === color && x.image; });
      return v ? 'background:#ddd url(' + v.image + ') center/cover' : 'background:#ccc';
    }
    colorAvailable(color) {
      return this.variants.some(function (v) { return v.color === color && v.available; });
    }

    /* ---------- build ---------- */
    buildStatic() {
      var self = this;
      this.$('[data-tiers]').innerHTML = this.tiers.map(function (t, i) {
        var next = self.tiers[i + 1];
        var range = next ? (t.min + (next.min - 1 > t.min ? '–' + (next.min - 1) : '') + ' pairs') : (t.min + '+ pairs');
        if (t.min === 1 && next && next.min === 2) range = '1 pair';
        return '<button type="button" class="payday-tier" data-action="tier" data-target="' + t.min + '" aria-pressed="false"' +
          ' aria-label="' + range + ', ' + t.pct + '% off, ' + money(self.price * (1 - t.pct / 100)) + ' per pair' + (t.badge ? ', ' + esc(t.badge) : '') + '">' +
          (t.badge ? '<span class="payday-badge" aria-hidden="true">' + esc(t.badge) + '</span>' : '') +
          '<span class="payday-tier__range" aria-hidden="true">' + range + '</span>' +
          '<span class="payday-tier__off" aria-hidden="true">' + t.pct + '% off</span>' +
          '<span class="payday-tier__each" aria-hidden="true">' + money(self.price * (1 - t.pct / 100)) + '</span>' +
          '</button>';
      }).join('');

      this.$('[data-swatches]').innerHTML = this.colors.map(function (c) {
        var soldOut = !self.colorAvailable(c);
        return '<button type="button" class="payday-swatch' + (soldOut ? ' is-soldout' : '') + '" data-action="color" data-color="' + esc(c) + '" aria-label="' + esc(c) + (soldOut ? ', sold out' : '') + '" aria-pressed="false">' +
          '<i style="' + self.swatchStyle(c) + '"></i></button>';
      }).join('');

      this.$('[data-sizes]').innerHTML = this.sizes.map(function (s) {
        var p = self.sizeParts(s);
        return '<button type="button" class="payday-size" data-action="size" data-size="' + esc(s) + '" aria-pressed="false">' +
          '<span class="payday-size__short">' + esc(p.short) + '</span>' +
          (p.detail ? '<span class="payday-size__detail">' + esc(p.detail) + '</span>' : '') +
          '</button>';
      }).join('');

      this.$('[data-chart-rows]').innerHTML = '<table><thead><tr><th scope="col">Size</th><th scope="col">Label</th></tr></thead><tbody>' +
        this.sizes.map(function (s) {
          var p = self.sizeParts(s);
          return '<tr><td>' + esc(p.short) + '</td><td>' + esc(p.detail || s) + '</td></tr>';
        }).join('') + '</tbody></table>';

      var max = this.tiers[this.tiers.length - 1].min;
      this.$('[data-markers]').innerHTML = this.tiers.map(function (t) {
        return '<span class="payday-marker" data-marker="' + t.min + '" style="left:' + (t.min / max * 100) + '%"></span>';
      }).join('');
      this.$('[data-marker-labels]').innerHTML = this.tiers.map(function (t, i) {
        var last = i === self.tiers.length - 1;
        var pos = last ? 'right:0' : 'left:' + (t.min / max * 100) + '%;transform:translateX(-50%)';
        return '<span style="' + pos + '">' + t.min + (t.min === 1 ? ' pair, ' : ' pairs, ') + t.pct + '%</span>';
      }).join('');
    }

    bind() {
      var self = this;
      this.addEventListener('click', function (e) {
        var el = e.target.closest('[data-action]');
        if (!el || !self.contains(el)) return;
        var a = el.dataset.action;
        if (a === 'tier') self.state.target = Number(el.dataset.target);
        if (a === 'color') self.state.color = el.dataset.color;
        if (a === 'size') self.state.size = el.dataset.size;
        if (a === 'inc') self.setQty(Number(el.dataset.variant), self.qtyOf(Number(el.dataset.variant)) + 1);
        if (a === 'dec') self.setQty(Number(el.dataset.variant), self.qtyOf(Number(el.dataset.variant)) - 1);
        if (a === 'quick') {
          var qv = self.variantFor(el.dataset.color, self.state.size);
          if (qv) self.addVariant(qv);
        }
        self.clearError();
        self.render(el);
      });
      this.$('[data-add]').addEventListener('click', function () {
        var v = self.variantFor(self.state.color, self.state.size);
        if (v) self.addVariant(v);
        self.clearError();
        self.render();
      });
      this.$('[data-chart-toggle]').addEventListener('click', function (e) {
        var chart = self.$('[data-chart]');
        chart.hidden = !chart.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!chart.hidden));
      });
      this.$('[data-checkout]').addEventListener('click', function () { self.syncCart('checkout'); });
      this.$('[data-to-cart]').addEventListener('click', function () { self.syncCart('cart'); });

      var bar = this.$('[data-bar]');
      var pad = function () { document.body.style.paddingBottom = bar.offsetHeight + 'px'; };
      if (window.ResizeObserver) new ResizeObserver(pad).observe(bar);
      pad();
    }

    addVariant(v) {
      if (!v || !v.available) return;
      var item = this.state.items.find(function (i) { return i.id === v.id; });
      if (item) {
        if (item.qty >= this.maxFor(v)) return;
        item.qty += 1;
      } else {
        this.state.items.push({ id: v.id, qty: 1 });
      }
    }
    setQty(id, qty) {
      var v = this.variantById(id);
      var item = this.state.items.find(function (i) { return i.id === id; });
      if (!item || !v) return;
      if (qty <= 0) this.state.items = this.state.items.filter(function (i) { return i !== item; });
      else item.qty = Math.min(qty, this.maxFor(v));
    }

    /* ---------- render ---------- */
    render(focusSource) {
      var focusKey = null;
      if (focusSource && (focusSource.dataset.action === 'inc' || focusSource.dataset.action === 'dec')) {
        focusKey = focusSource.dataset.action + '|' + focusSource.dataset.variant;
      }
      this.renderSelector();
      this.renderTray();
      this.renderBar();
      if (focusKey) {
        var parts = focusKey.split('|');
        var again = this.querySelector('[data-action="' + parts[0] + '"][data-variant="' + parts[1] + '"]');
        if (again && !again.disabled) again.focus();
      }
    }

    renderSelector() {
      var self = this, s = this.state;
      this.querySelectorAll('.payday-tier').forEach(function (b) {
        b.setAttribute('aria-pressed', String(Number(b.dataset.target) === s.target));
      });
      this.querySelectorAll('[data-swatches] .payday-swatch').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.color === s.color));
      });
      this.querySelectorAll('.payday-size').forEach(function (b) {
        var v = self.variantFor(s.color, b.dataset.size);
        var ok = v && v.available;
        b.disabled = !ok;
        b.setAttribute('aria-pressed', String(b.dataset.size === s.size));
        b.setAttribute('aria-label', self.sizeParts(b.dataset.size).short + (ok ? '' : ', sold out in ' + s.color));
      });
      this.$('[data-color-name]').textContent = s.color;

      var withImg = this.variants.find(function (v) { return v.color === s.color && v.image; });
      var src = withImg ? withImg.image : this.cfg.fallbackImage;
      var photo = this.$('[data-photo]');
      if (src && photo.dataset.src !== src) {
        photo.dataset.src = src;
        photo.innerHTML = '<img src="' + src + '" alt="' + esc(s.color) + ' Wide-Leg Pants" loading="lazy">';
      }

      var stock = this.$('[data-stock]'), add = this.$('[data-add]');
      stock.classList.remove('is-warn');
      if (!s.size) {
        stock.textContent = this.colorAvailable(s.color) ? 'Select a size' : s.color + ' is sold out. Try another color.';
        if (!this.colorAvailable(s.color)) stock.classList.add('is-warn');
        add.disabled = true;
        add.textContent = 'Choose a size to add';
        return;
      }
      var v = this.variantFor(s.color, s.size);
      var short = this.sizeParts(s.size).short;
      if (!v || !v.available) {
        stock.textContent = s.color + ' is sold out in ' + short + '. Try another color or size.';
        stock.classList.add('is-warn');
        add.disabled = true;
        add.textContent = 'Sold out';
        return;
      }
      var left = this.maxFor(v) - this.qtyOf(v.id);
      if (left <= 0) {
        stock.textContent = 'You have all remaining ' + s.color + ' in ' + short + '.';
        stock.classList.add('is-warn');
        add.disabled = true;
        add.textContent = 'No more in stock';
        return;
      }
      if (v.limited && v.qty <= 5) {
        stock.textContent = 'Only ' + left + ' left in ' + s.color + ', ' + short;
        stock.classList.add('is-warn');
      } else {
        stock.textContent = 'In stock';
      }
      add.disabled = false;
      add.textContent = 'Add pair: ' + s.color + ', ' + short;
    }

    renderTray() {
      var self = this, s = this.state, n = this.count();
      var unit = this.price * (1 - this.pctFor(n) / 100);
      this.$('[data-tray-items]').innerHTML = s.items.map(function (i) {
        var v = self.variantById(i.id);
        var short = self.sizeParts(v.size).short;
        var atMax = i.qty >= self.maxFor(v);
        return '<div class="payday-item">' +
          '<span class="payday-dot" style="' + self.swatchStyle(v.color) + '"></span>' +
          '<div class="payday-item__info"><span class="payday-item__name">' + esc(v.color) + ', ' + esc(short) + '</span>' +
          '<span class="payday-item__unit">' + money(unit) + ' each</span></div>' +
          '<div class="payday-stepper">' +
          '<button type="button" data-action="dec" data-variant="' + v.id + '" aria-label="Remove one ' + esc(v.color) + ', ' + esc(short) + '">−</button>' +
          '<output>' + i.qty + '</output>' +
          '<button type="button" data-action="inc" data-variant="' + v.id + '" aria-label="Add one more ' + esc(v.color) + ', ' + esc(short) + '"' + (atMax ? ' disabled' : '') + '>+</button>' +
          '</div></div>';
      }).join('');

      var open = Math.max(0, s.target - n);
      this.$('[data-slots]').innerHTML = Array.from({ length: open }, function (_, k) {
        return '<div class="payday-slot">Pair ' + (n + k + 1) + ' of ' + s.target + ': choose a color and size</div>';
      }).join('');

      var quick = (s.size && n > 0) ? this.colors.filter(function (c) {
        var v = self.variantFor(c, s.size);
        return c !== s.color && v && v.available && self.qtyOf(v.id) < self.maxFor(v);
      }) : [];
      this.$('[data-quick]').hidden = quick.length === 0;
      if (s.size) this.$('[data-quick-label]').textContent = 'Add another color in ' + this.sizeParts(s.size).short;
      this.$('[data-quick-swatches]').innerHTML = quick.map(function (c) {
        return '<button type="button" class="payday-swatch" data-action="quick" data-color="' + esc(c) + '" aria-label="Add ' + esc(c) + ' in ' + esc(self.sizeParts(s.size).short) + '">' +
          '<i style="' + self.swatchStyle(c) + '"></i></button>';
      }).join('');
    }

    renderBar() {
      var self = this, n = this.count();
      var pct = this.pctFor(n), total = this.costFor(n), regular = n * this.price;
      var next = this.tiers.find(function (t) { return t.min > n; });
      var top = this.tiers[this.tiers.length - 1];
      var msg, nudge = false;

      if (n === 0) {
        var t2 = this.tiers[1] || this.tiers[0];
        msg = 'Pick ' + t2.min + ' pairs to save ' + t2.pct + '%';
      } else if (!next) {
        msg = 'Best price unlocked: ' + money(this.price * (1 - top.pct / 100)) + ' a pair';
      } else if (next.min - n === 1) {
        msg = 'Add 1 more pair for just ' + money(this.costFor(n + 1) - total) + ' and unlock ' + next.pct + '% off';
        nudge = true;
      } else {
        var need = next.min - n;
        var cur = this.tiers.filter(function (t) { return t.min <= n; }).pop();
        var extra = this.costFor(next.min) - total;
        msg = cur.pct + '% off applied. Add ' + need + ' more for ' + next.pct + '% off';
        if (Math.abs(extra - this.price) < 1) msg = cur.pct + '% off unlocked. Add ' + need + ' more pairs for the price of 1';
      }
      var barMsg = this.$('[data-bar-msg]');
      barMsg.textContent = msg;
      barMsg.classList.toggle('is-nudge', nudge);

      this.$('[data-fill]').style.width = (Math.min(n, top.min) / top.min * 100) + '%';
      this.querySelectorAll('.payday-marker').forEach(function (m) {
        m.classList.toggle('is-on', n >= Number(m.dataset.marker));
      });

      this.$('[data-bar-count]').textContent = n === 0 ? 'No pairs yet' : n + (n === 1 ? ' pair, ' : ' pairs, ') + pct + '% off';
      this.$('[data-bar-savings]').innerHTML = n === 0 ? '' :
        '<s>' + money(regular) + '</s> <span class="payday-saved">You save ' + money(regular - total) + '</span>';
      this.$('[data-bar-total]').textContent = n === 0 ? '' : money(total);
      this.$('[data-checkout]').disabled = n === 0;
      this.$('[data-to-cart]').hidden = n === 0;

      var ship = this.cfg.freeShippingMin, line = '';
      if (ship > 0) {
        line = n === 0 ? 'Free shipping on orders over ' + money(ship)
          : (total >= ship ? 'Free shipping unlocked' : money(ship - total) + ' away from free shipping');
      }
      this.$('[data-ship-line]').textContent = line;

      this.tiers.forEach(function (t) {
        if (n >= t.min && t.min > self.maxTierReached) {
          self.maxTierReached = t.min;
          publish('payday_bundle_tier_reached', { pairs: n, tier_min: t.min, tier_pct: t.pct });
        }
      });
    }

    /* ---------- cart ---------- */
    prefillFromCart() {
      var self = this;
      fetch(this.root + 'cart.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          var found = false;
          (cart.items || []).forEach(function (line) {
            if (line.product_id !== self.cfg.productId) return;
            var v = self.variantById(line.variant_id);
            if (!v) return;
            found = true;
            var existing = self.state.items.find(function (i) { return i.id === v.id; });
            if (existing) existing.qty += line.quantity;
            else self.state.items.push({ id: v.id, qty: line.quantity });
          });
          if (found) self.render();
        })
        .catch(function () { /* cart prefill is optional */ });
    }

    syncCart(dest) {
      var self = this, n = this.count();
      if (n === 0) return;
      var buttons = [this.$('[data-checkout]'), this.$('[data-to-cart]')];
      buttons.forEach(function (b) { b.disabled = true; });
      var expectedDiscount = n * this.price - this.costFor(n);
      publish('payday_checkout_click', { pairs: n, preview_total: Math.round(this.costFor(n)) / 100, destination: dest });

      fetch(this.root + 'cart.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          var updates = {};
          (cart.items || []).forEach(function (line) {
            if (line.product_id === self.cfg.productId) updates[line.variant_id] = 0;
          });
          self.state.items.forEach(function (i) { updates[i.id] = i.qty; });
          return fetch(self.root + 'cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ updates: updates })
          });
        })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (err) { throw new Error(err.description || err.message || 'Cart update failed'); });
          return r.json();
        })
        .then(function (cart) {
          var actual = 0;
          (cart.items || []).forEach(function (line) {
            if (line.product_id === self.cfg.productId) actual += (line.original_line_price - line.final_line_price);
          });
          if (Math.abs(actual - expectedDiscount) > n) {
            console.warn('[Payday] Preview discount ' + money(expectedDiscount) + ' differs from cart discount ' + money(actual) + '. Check the automatic discounts in Shopify admin.');
          }
          window.location.href = self.root + (dest === 'checkout' ? 'checkout' : 'cart');
        })
        .catch(function (err) {
          self.showError((err && err.message) ? err.message : 'Something went wrong. Please try again.');
          buttons.forEach(function (b) { b.disabled = false; });
          self.renderBar();
        });
    }

    showError(text) { this.$('[data-error]').textContent = text; }
    clearError() { this.$('[data-error]').textContent = ''; }
  }

  customElements.define('payday-bundle', PaydayBundle);
})();
