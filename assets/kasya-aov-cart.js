(function () {
  const selectors = {
    root: '[data-kasya-aov-cart]',
    close: '[data-kasya-aov-cart-close]',
    items: '[data-kasya-aov-cart-items]',
    count: '[data-kasya-aov-cart-count]',
    footerCount: '[data-kasya-aov-cart-footer-count]',
    subtotal: '[data-kasya-aov-cart-subtotal]',
    recommendations: '[data-kasya-aov-cart-recommendations]',
    timerText: '[data-kasya-aov-cart-timer-text]',
    progressCopy: '[data-kasya-aov-cart-progress-copy]',
    progress: '[data-kasya-aov-cart-progress]'
  };

  const reservation = {
    duration: 180,
    storageKey: 'kasyaAovCartReservation',
    endedText: 'Your reservation has ended. Please proceed before items sell out.',
    emptyText: 'Add an item to start your reservation timer.'
  };

  const offers = {
    freeShippingCents: 200000,
    discountCents: 300000
  };

  const formatMoney = (cents) => {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      return window.Shopify.formatMoney(cents, window.moneyFormat);
    }

    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: window.currencyMain || 'PHP'
    }).format((cents || 0) / 100);
  };

  const formatMoneyClean = (cents) => formatMoney(cents).replace(/\.00\b/, '');

  const formatTimer = (seconds) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const remainder = (safeSeconds % 60).toString().padStart(2, '0');

    return `${minutes}:${remainder}`;
  };

  async function fetchKasyaAovCart() {
    const response = await fetch('/cart.js', {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Unable to fetch cart.');
    }

    return response.json();
  }

  async function changeKasyaAovCartLine(line, quantity) {
    const response = await fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ line, quantity })
    });

    if (!response.ok) {
      throw new Error('Unable to update cart line.');
    }

    return response.json();
  }

  async function addKasyaAovCartItem(variantId, quantity = 1, properties = {}) {
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: variantId,
        quantity,
        properties
      })
    });

    if (!response.ok) {
      throw new Error('Unable to add item to cart.');
    }

    return response.json();
  }

  function getKasyaAovRecommendations(cart) {
    /*
      Phase 2 placeholder:
      - If cart contains pants, recommend tops.
      - If cart contains tops, recommend bottoms.
      - If cart contains Jane Set, recommend non-Jane products only.
      - Exclude individual Jane Blouse and Jane Pants from recommendation output.
      Product IDs are intentionally not hard-coded in Phase 1.
    */
    return [];
  }

  class KasyaAovCart extends HTMLElement {
    constructor() {
      super();
      this.cart = null;
      this.timerId = null;
      this.onClick = this.onClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onCartUpdated = this.onCartUpdated.bind(this);
    }

    connectedCallback() {
      this.addEventListener('click', this.onClick);
      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('afterUpdateQuantity', this.onCartUpdated);
      this.syncTimerWithCart({ item_count: Number(this.querySelector(selectors.count)?.textContent.replace(/\D/g, '')) || 0 });
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('afterUpdateQuantity', this.onCartUpdated);
      this.stopTimer();
    }

    open() {
      this.setAttribute('aria-hidden', 'false');
      this.classList.add('kasya-aov-cart--open');
      document.documentElement.classList.add('kasya-aov-cart-is-open');
      this.refresh();
    }

    close() {
      this.setAttribute('aria-hidden', 'true');
      this.classList.remove('kasya-aov-cart--open');
      document.documentElement.classList.remove('kasya-aov-cart-is-open');
    }

    async refresh() {
      try {
        this.cart = await fetchKasyaAovCart();
        this.renderSummary(this.cart);
        this.renderOfferProgress(this.cart);
        this.renderItems(this.cart);
        this.renderRecommendations(this.cart);
        this.syncTimerWithCart(this.cart);
      } catch (error) {
        console.warn(error);
      }
    }

    async updateQuantity(line, quantity) {
      try {
        this.classList.add('kasya-aov-cart--loading');
        this.cart = await changeKasyaAovCartLine(line, quantity);
        this.renderSummary(this.cart);
        this.renderOfferProgress(this.cart);
        this.renderItems(this.cart);
        this.renderRecommendations(this.cart);
        this.syncTimerWithCart(this.cart);
      } catch (error) {
        console.warn(error);
      } finally {
        this.classList.remove('kasya-aov-cart--loading');
      }
    }

    renderSummary(cart) {
      const itemLabel = `${cart.item_count} item${cart.item_count === 1 ? '' : 's'}`;
      const count = this.querySelector(selectors.count);
      const footerCount = this.querySelector(selectors.footerCount);
      const subtotal = this.querySelector(selectors.subtotal);

      if (count) count.textContent = `(${cart.item_count})`;
      if (footerCount) footerCount.textContent = itemLabel;
      if (subtotal) subtotal.textContent = formatMoney(cart.total_price);
    }

    renderOfferProgress(cart) {
      const subtotal = this.getCartSubtotal(cart);
      const copy = this.querySelector(selectors.progressCopy);
      const progress = this.querySelector(selectors.progress);
      const progressPercent = Math.min((subtotal / offers.discountCents) * 100, 100);

      if (copy) {
        if (subtotal < offers.freeShippingCents) {
          copy.textContent = `You are ${formatMoneyClean(offers.freeShippingCents - subtotal)} away from getting FREE SHIPPING`;
        } else if (subtotal < offers.discountCents) {
          copy.textContent = `You unlocked FREE SHIPPING — ${formatMoneyClean(offers.discountCents - subtotal)} away from ₱450 OFF`;
        } else {
          copy.textContent = 'You unlocked FREE SHIPPING and ₱450 OFF';
        }
      }

      if (progress) {
        progress.style.width = `${progressPercent}%`;
      }
    }

    renderItems(cart) {
      const container = this.querySelector(selectors.items);

      if (!container) {
        return;
      }

      if (!cart.items.length) {
        container.innerHTML = `
          <div class="kasya-aov-cart__empty" data-kasya-aov-cart-empty>
            <p>Your cart is waiting for something beautiful.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = cart.items.map((item, index) => this.renderItem(item, index + 1)).join('');
    }

    renderItem(item, line) {
      const imageMarkup = item.image
        ? `<img src="${item.image}" alt="${this.escapeHtml(item.product_title)}" loading="lazy" width="110" height="132" class="kasya-aov-cart__item-image">`
        : '<span class="kasya-aov-cart__item-image kasya-aov-cart__item-image--placeholder"></span>';
      const variantMarkup = item.variant_title && item.variant_title !== 'Default Title'
        ? `<p class="kasya-aov-cart__item-variant">${this.escapeHtml(item.variant_title.replaceAll(' / ', ' | '))}</p>`
        : '';
      const skuMarkup = item.sku
        ? `<p class="kasya-aov-cart__item-sku">SKU: ${this.escapeHtml(item.sku)}</p>`
        : '';

      return `
        <article class="kasya-aov-cart__item" data-kasya-aov-cart-item data-line="${line}" data-key="${this.escapeHtml(item.key)}">
          <a class="kasya-aov-cart__item-media" href="${item.url}" tabindex="-1" aria-hidden="true">
            ${imageMarkup}
          </a>
          <div class="kasya-aov-cart__item-content">
            <div class="kasya-aov-cart__item-topline">
              <a class="kasya-aov-cart__item-title" href="${item.url}">${this.escapeHtml(item.product_title)}</a>
              <button type="button" class="kasya-aov-cart__item-remove" data-kasya-aov-cart-remove data-line="${line}" aria-label="Remove ${this.escapeHtml(item.product_title)}">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            ${variantMarkup}
            ${skuMarkup}
            <div class="kasya-aov-cart__item-bottomline">
              <div class="kasya-aov-cart__quantity" aria-label="Quantity controls for ${this.escapeHtml(item.product_title)}">
                <button type="button" class="kasya-aov-cart__quantity-button" data-kasya-aov-cart-decrease data-line="${line}" aria-label="Decrease quantity for ${this.escapeHtml(item.product_title)}">-</button>
                <span class="kasya-aov-cart__quantity-value" data-kasya-aov-cart-quantity>${item.quantity}</span>
                <button type="button" class="kasya-aov-cart__quantity-button" data-kasya-aov-cart-increase data-line="${line}" aria-label="Increase quantity for ${this.escapeHtml(item.product_title)}">+</button>
              </div>
              <div class="kasya-aov-cart__item-price">${formatMoney(item.final_line_price)}</div>
            </div>
          </div>
        </article>
      `;
    }

    renderRecommendations(cart) {
      const recommendations = getKasyaAovRecommendations(cart);
      const container = this.querySelector(selectors.recommendations);

      if (!container || recommendations.length === 0) {
        return;
      }

      container.innerHTML = recommendations.map((product) => `
        <article class="kasya-aov-cart__recommendation-card">
          <img class="kasya-aov-cart__recommendation-image" src="${product.image}" alt="${product.title}">
          <div class="kasya-aov-cart__recommendation-info">
            <h4>${product.title}</h4>
            ${product.price ? `<p class="kasya-aov-cart__recommendation-price">${product.price}</p>` : ''}
          </div>
        </article>
      `).join('');
    }

    syncTimerWithCart(cart) {
      const itemCount = cart.item_count || 0;
      const storedState = this.getTimerState();
      const now = Date.now();
      const previousCount = storedState.itemCount || 0;
      const shouldReset = itemCount > 0 && (!storedState.expiresAt || itemCount > previousCount);

      if (itemCount === 0) {
        this.clearTimerState();
        this.stopTimer();
        this.renderTimerText(reservation.emptyText);
        return;
      }

      if (shouldReset) {
        this.setTimerState({
          itemCount,
          expiresAt: now + reservation.duration * 1000
        });
      } else {
        this.setTimerState({
          itemCount,
          expiresAt: storedState.expiresAt
        });
      }

      this.startTimer();
    }

    startTimer() {
      this.stopTimer();
      this.tickTimer();
      this.timerId = window.setInterval(() => this.tickTimer(), 1000);
    }

    stopTimer() {
      if (this.timerId) {
        window.clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    tickTimer() {
      const state = this.getTimerState();
      const remainingSeconds = Math.ceil(((state.expiresAt || 0) - Date.now()) / 1000);

      if (!state.expiresAt || remainingSeconds <= 0) {
        this.stopTimer();
        this.renderTimerText(reservation.endedText);
        return;
      }

      this.renderTimerText(`Your products are reserved for ${formatTimer(remainingSeconds)} minutes!`);
    }

    renderTimerText(text) {
      const timerText = this.querySelector(selectors.timerText);

      if (timerText) {
        timerText.textContent = text;
      }
    }

    getTimerState() {
      try {
        return JSON.parse(window.sessionStorage.getItem(reservation.storageKey)) || {};
      } catch (error) {
        return {};
      }
    }

    setTimerState(state) {
      try {
        window.sessionStorage.setItem(reservation.storageKey, JSON.stringify(state));
      } catch (error) {
        console.warn(error);
      }
    }

    clearTimerState() {
      try {
        window.sessionStorage.removeItem(reservation.storageKey);
      } catch (error) {
        console.warn(error);
      }
    }

    getCartSubtotal(cart) {
      return typeof cart.items_subtotal_price === 'number' ? cart.items_subtotal_price : cart.total_price || 0;
    }

    onCartUpdated(event) {
      if (event.detail && event.detail.cartData) {
        this.cart = event.detail.cartData;
        this.renderSummary(this.cart);
        this.renderOfferProgress(this.cart);
        this.renderItems(this.cart);
        this.renderRecommendations(this.cart);
        this.syncTimerWithCart(this.cart);
      }
    }

    onClick(event) {
      if (event.target.closest(selectors.close)) {
        this.close();
        return;
      }

      const removeButton = event.target.closest('[data-kasya-aov-cart-remove]');
      if (removeButton) {
        this.updateQuantity(Number(removeButton.dataset.line), 0);
        return;
      }

      const decreaseButton = event.target.closest('[data-kasya-aov-cart-decrease]');
      if (decreaseButton) {
        const lineElement = decreaseButton.closest('[data-kasya-aov-cart-item]');
        const quantity = Number(lineElement.querySelector('[data-kasya-aov-cart-quantity]').textContent);
        this.updateQuantity(Number(decreaseButton.dataset.line), Math.max(quantity - 1, 0));
        return;
      }

      const increaseButton = event.target.closest('[data-kasya-aov-cart-increase]');
      if (increaseButton) {
        const lineElement = increaseButton.closest('[data-kasya-aov-cart-item]');
        const quantity = Number(lineElement.querySelector('[data-kasya-aov-cart-quantity]').textContent);
        this.updateQuantity(Number(increaseButton.dataset.line), quantity + 1);
      }
    }

    onKeydown(event) {
      if (event.key === 'Escape' && this.classList.contains('kasya-aov-cart--open')) {
        this.close();
      }
    }

    escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]);
    }
  }

  if (!customElements.get('kasya-aov-cart')) {
    customElements.define('kasya-aov-cart', KasyaAovCart);
  }

  window.KasyaAovCart = {
    open() {
      document.querySelector(selectors.root)?.open();
    },
    close() {
      document.querySelector(selectors.root)?.close();
    },
    refresh() {
      return document.querySelector(selectors.root)?.refresh();
    },
    fetchCart: fetchKasyaAovCart,
    changeLine: changeKasyaAovCartLine,
    addItem: addKasyaAovCartItem,
    getRecommendations: getKasyaAovRecommendations
  };
})();
