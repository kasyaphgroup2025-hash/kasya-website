(function () {
  const selectors = {
    root: '[data-kasya-aov-cart]',
    close: '[data-kasya-aov-cart-close]',
    items: '[data-kasya-aov-cart-items]',
    count: '[data-kasya-aov-cart-count]',
    footerCount: '[data-kasya-aov-cart-footer-count]',
    subtotal: '[data-kasya-aov-cart-subtotal]',
    recommendations: '[data-kasya-aov-cart-recommendations]'
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
      this.onClick = this.onClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
    }

    connectedCallback() {
      this.addEventListener('click', this.onClick);
      document.addEventListener('keydown', this.onKeydown);
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      document.removeEventListener('keydown', this.onKeydown);
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
        this.renderItems(this.cart);
        this.renderRecommendations(this.cart);
      } catch (error) {
        console.warn(error);
      }
    }

    async updateQuantity(line, quantity) {
      try {
        this.classList.add('kasya-aov-cart--loading');
        this.cart = await changeKasyaAovCartLine(line, quantity);
        this.renderSummary(this.cart);
        this.renderItems(this.cart);
        this.renderRecommendations(this.cart);
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
          <h4>${product.title}</h4>
          <p>${product.price}</p>
        </article>
      `).join('');
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
