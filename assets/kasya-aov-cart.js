(function () {
  const selectors = {
    root: '[data-kasya-aov-cart]',
    close: '[data-kasya-aov-cart-close]',
    items: '[data-kasya-aov-cart-items]',
    count: '[data-kasya-aov-cart-count]',
    footerCount: '[data-kasya-aov-cart-footer-count]',
    subtotal: '[data-kasya-aov-cart-subtotal]',
    subtotalWrap: '[data-kasya-aov-cart-subtotal-wrap]',
    recommendations: '[data-kasya-aov-cart-recommendations]',
    emptyState: '[data-kasya-aov-cart-empty-state]',
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
    discountCents: 300000,
    previewDiscountCents: 45000
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

  const parseMoneyToCents = (value) => {
    const normalized = String(value || '').replace(/[^0-9.]/g, '');
    const amount = Number.parseFloat(normalized);

    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  };

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

  async function changeKasyaAovCartLine(identifier, quantity) {
    const body = typeof identifier === 'string'
      ? { id: identifier, quantity }
      : { line: identifier, quantity };
    const response = await fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
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
      this.isUpdating = false;
      this.timerId = null;
      this.onClick = this.onClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onCartUpdated = this.onCartUpdated.bind(this);
    }

    connectedCallback() {
      this.addEventListener('click', this.onClick);
      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('afterUpdateQuantity', this.onCartUpdated);
      const initialCart = { item_count: Number(this.querySelector(selectors.count)?.textContent.replace(/\D/g, '')) || 0, items: [] };
      this.renderLayoutState(initialCart);
      this.syncTimerWithCart(initialCart);
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
        this.renderItems(this.cart);
        this.syncTimerWithCart(this.cart);

        if (this.renderLayoutState(this.cart)) {
          return;
        }

        this.renderOfferProgress(this.cart);
        this.renderRecommendations(this.cart);
      } catch (error) {
        console.warn(error);
      }
    }

    async updateQuantity(identifier, quantity) {
      if (this.isUpdating || !identifier && identifier !== 0) return;

      try {
        this.setUpdating(true);
        await changeKasyaAovCartLine(identifier, quantity);
        await this.refresh();
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to update cart item.', error);
      } finally {
        this.setUpdating(false);
      }
    }

    renderSummary(cart) {
      const visualItemCount = this.getDisplayItems(cart).length;
      const itemLabel = `${visualItemCount} item${visualItemCount === 1 ? '' : 's'}`;
      const count = this.querySelector(selectors.count);
      const footerCount = this.querySelector(selectors.footerCount);
      const subtotal = this.getCartDisplaySubtotal(cart);

      if (count) count.textContent = `(${visualItemCount})`;
      if (footerCount) footerCount.textContent = itemLabel;
      this.renderSubtotal(subtotal);
    }

    renderSubtotal(subtotal) {
      const subtotalWrap = this.querySelector(selectors.subtotalWrap);

      if (!subtotalWrap) {
        const subtotalElement = this.querySelector(selectors.subtotal);
        if (subtotalElement) subtotalElement.textContent = formatMoney(subtotal);
        return;
      }

      if (subtotal >= offers.discountCents) {
        const finalSubtotal = Math.max(subtotal - offers.previewDiscountCents, 0);

        subtotalWrap.innerHTML = `
          <div class="kasya-aov-cart__subtotal-row">
            <span>Subtotal</span>
            <strong>${formatMoney(subtotal)}</strong>
          </div>
          <div class="kasya-aov-cart__subtotal-row kasya-aov-cart__subtotal-row--savings">
            <span>Save ₱450</span>
            <strong>-${formatMoney(offers.previewDiscountCents)}</strong>
          </div>
          <div class="kasya-aov-cart__subtotal-row kasya-aov-cart__subtotal-row--final">
            <span>Final</span>
            <strong data-kasya-aov-cart-subtotal>${formatMoney(finalSubtotal)}</strong>
          </div>
        `;
        return;
      }

      subtotalWrap.innerHTML = `
        <div class="kasya-aov-cart__subtotal-row">
          <span>Subtotal (<span data-kasya-aov-cart-footer-count></span>)</span>
          <strong data-kasya-aov-cart-subtotal>${formatMoney(subtotal)}</strong>
        </div>
      `;

      const footerCount = this.querySelector(selectors.footerCount);
      if (footerCount && this.cart) {
        const visualItemCount = this.getDisplayItems(this.cart).length;
        footerCount.textContent = `${visualItemCount} item${visualItemCount === 1 ? '' : 's'}`;
      }
    }

    renderOfferProgress(cart) {
      const subtotal = this.getCartDisplaySubtotal(cart);
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
        container.innerHTML = '';
        return;
      }

      container.innerHTML = this.getDisplayItems(cart).map((item) => {
        if (item.type === 'jane-set') {
          return this.renderJaneSetItem(item);
        }

        return this.renderItem(item.item, item.line);
      }).join('');
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
              <button type="button" class="kasya-aov-cart__item-remove" data-kasya-aov-cart-remove data-kasya-remove-line data-line="${line}" data-key="${this.escapeHtml(item.key)}" data-line-key="${this.escapeHtml(item.key)}" aria-label="Remove ${this.escapeHtml(item.product_title)}">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            ${variantMarkup}
            ${skuMarkup}
            <div class="kasya-aov-cart__item-bottomline">
              <div class="kasya-aov-cart__quantity" aria-label="Quantity controls for ${this.escapeHtml(item.product_title)}">
                <button type="button" class="kasya-aov-cart__quantity-button" data-kasya-aov-cart-decrease data-line="${line}" data-key="${this.escapeHtml(item.key)}" data-line-key="${this.escapeHtml(item.key)}" aria-label="Decrease quantity for ${this.escapeHtml(item.product_title)}">-</button>
                <span class="kasya-aov-cart__quantity-value" data-kasya-aov-cart-quantity>${item.quantity}</span>
                <button type="button" class="kasya-aov-cart__quantity-button" data-kasya-aov-cart-increase data-line="${line}" data-key="${this.escapeHtml(item.key)}" data-line-key="${this.escapeHtml(item.key)}" aria-label="Increase quantity for ${this.escapeHtml(item.product_title)}">+</button>
              </div>
              <div class="kasya-aov-cart__item-price">${formatMoney(item.final_line_price)}</div>
            </div>
          </div>
        </article>
      `;
    }

    renderJaneSetItem(set) {
      const image = set.parent?.properties?._set_parent_image || set.parent?.image || set.top?.properties?._set_parent_image || set.top?.image || set.pants?.image;
      const imageMarkup = image
        ? `<img src="${image}" alt="Jane Set" loading="lazy" width="110" height="132" class="kasya-aov-cart__item-image">`
        : '<span class="kasya-aov-cart__item-image kasya-aov-cart__item-image--placeholder"></span>';
      const details = [set.top, set.pants].filter(Boolean).map((item) => {
        const label = item.properties?._set_component_label || item.product_title;
        const size = item.properties?._set_component_size || item.properties?._top_size || item.properties?._pants_size || '';
        const variant = size || (item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title.replaceAll(' / ', ' | ') : '');
        const skuValue = item.properties?._set_component_sku || item.sku || '';
        const sku = skuValue ? ` SKU: ${skuValue}` : '';

        return `<p class="kasya-aov-cart__item-variant">${this.escapeHtml(label)}${variant ? `: ${this.escapeHtml(variant)}` : ''}${this.escapeHtml(sku)}</p>`;
      }).join('');
      const quantity = this.getJaneSetQuantity(set);
      const price = this.getJaneSetDisplayPrice(set);
      const keys = (set.items || []).map((item) => item.key).filter(Boolean).join(',');
      const setColor = this.getJaneSetColor(set);

      return `
        <article class="kasya-aov-cart__item kasya-aov-cart__item--jane-set" data-kasya-aov-cart-jane-set data-set-id="${this.escapeHtml(set.setId)}" data-set-group-id="${this.escapeHtml(set.setId)}" data-keys="${this.escapeHtml(keys)}" data-line-keys="${this.escapeHtml(keys)}">
          <div class="kasya-aov-cart__item-media">
            ${imageMarkup}
          </div>
          <div class="kasya-aov-cart__item-content">
            <div class="kasya-aov-cart__item-topline">
              <div>
                <p class="kasya-aov-cart__item-kicker">Set</p>
                <span class="kasya-aov-cart__item-title">${this.escapeHtml(setColor)} Jane Set</span>
              </div>
              <button type="button" class="kasya-aov-cart__item-remove" data-kasya-aov-cart-remove-set data-kasya-aov-remove-set data-set-id="${this.escapeHtml(set.setId)}" data-set-group-id="${this.escapeHtml(set.setId)}" data-keys="${this.escapeHtml(keys)}" data-line-keys="${this.escapeHtml(keys)}" aria-label="Remove Jane Set">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            ${details}
            <div class="kasya-aov-cart__item-bottomline">
              <div class="kasya-aov-cart__quantity kasya-aov-cart__quantity--locked" aria-label="Jane Set quantity">
                <span class="kasya-aov-cart__quantity-value">${quantity}</span>
              </div>
              <div class="kasya-aov-cart__item-price">${formatMoney(price)}</div>
            </div>
          </div>
        </article>
      `;
    }

    getDisplayItems(cart) {
      const renderedSetIds = new Set();
      const displayItems = [];

      cart.items.forEach((item, index) => {
        const setId = item.properties?._set_id;
        const isJaneSet = setId && item.properties?._set_name === 'Jane Set';

        if (!isJaneSet) {
          displayItems.push({ type: 'item', item, line: index + 1 });
          return;
        }

        if (renderedSetIds.has(setId)) return;
        renderedSetIds.add(setId);

        const setItems = cart.items.filter((candidate) => {
          return candidate.properties?._set_id === setId && candidate.properties?._set_name === 'Jane Set';
        });

        displayItems.push({
          type: 'jane-set',
          setId,
          parent: setItems.find((candidate) => candidate.properties?._set_role === 'Parent'),
          top: setItems.find((candidate) => candidate.properties?._set_role === 'Top'),
          pants: setItems.find((candidate) => candidate.properties?._set_role === 'Pants'),
          items: setItems
        });
      });

      return displayItems;
    }

    getJaneSetQuantity(set) {
      return Math.max(set.parent?.quantity || 0, set.top?.quantity || 0, set.pants?.quantity || 0, 1);
    }

    getJaneSetColor(set) {
      return set.parent?.properties?._set_color ||
        set.top?.properties?._set_color ||
        set.pants?.properties?._set_color ||
        'Jane';
    }

    getJaneSetDisplayPrice(set) {
      const displayPrice = [
        set.parent?.properties?._set_display_price,
        set.top?.properties?._set_display_price,
        set.pants?.properties?._set_display_price
      ].map(parseMoneyToCents).find((price) => price > 0);

      if (displayPrice) {
        return displayPrice * this.getJaneSetQuantity(set);
      }

      if (set.parent?.final_line_price && set.parent.final_line_price > 100) {
        return set.parent.final_line_price;
      }

      return (set.items || []).reduce((sum, item) => sum + (item.final_line_price || 0), 0);
    }

    getJaneSetActualPrice(set) {
      return (set.items || []).reduce((sum, item) => sum + (item.final_line_price || 0), 0);
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

    renderLayoutState(cart) {
      const isEmpty = typeof cart.item_count === 'number'
        ? cart.item_count === 0
        : !cart.items || cart.items.length === 0;

      this.classList.toggle('kasya-aov-cart--empty', isEmpty);

      const emptyState = this.querySelector(selectors.emptyState);
      if (emptyState) {
        emptyState.toggleAttribute('hidden', !isEmpty);
      }

      return isEmpty;
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

    getCartDisplaySubtotal(cart) {
      let subtotal = typeof cart.items_subtotal_price === 'number' ? cart.items_subtotal_price : cart.total_price || 0;

      this.getDisplayItems(cart).forEach((item) => {
        if (item.type !== 'jane-set') return;

        subtotal = subtotal - this.getJaneSetActualPrice(item) + this.getJaneSetDisplayPrice(item);
      });

      return Math.max(subtotal, 0);
    }

    onCartUpdated(event) {
      if (event.detail && event.detail.cartData) {
        this.cart = event.detail.cartData;
        this.renderSummary(this.cart);
        this.renderItems(this.cart);
        this.syncTimerWithCart(this.cart);

        if (this.renderLayoutState(this.cart)) {
          return;
        }

        this.renderOfferProgress(this.cart);
        this.renderRecommendations(this.cart);
      }
    }

    onClick(event) {
      if (event.target.closest(selectors.close)) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }

      const removeButton = event.target.closest('[data-kasya-aov-cart-remove]');
      if (removeButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this.updateQuantity(this.getLineIdentifier(removeButton), 0);
        return;
      }

      const removeSetButton = event.target.closest('[data-kasya-aov-cart-remove-set], [data-kasya-aov-remove-set]');
      if (removeSetButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this.removeJaneSetByGroup(
          removeSetButton.dataset.setId || removeSetButton.dataset.setGroupId,
          (removeSetButton.dataset.keys || removeSetButton.dataset.lineKeys || '').split(',').filter(Boolean)
        );
        return;
      }

      const decreaseButton = event.target.closest('[data-kasya-aov-cart-decrease]');
      if (decreaseButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const lineElement = decreaseButton.closest('[data-kasya-aov-cart-item]');
        const quantity = Number(lineElement.querySelector('[data-kasya-aov-cart-quantity]').textContent);
        this.updateQuantity(this.getLineIdentifier(decreaseButton), Math.max(quantity - 1, 0));
        return;
      }

      const increaseButton = event.target.closest('[data-kasya-aov-cart-increase]');
      if (increaseButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const lineElement = increaseButton.closest('[data-kasya-aov-cart-item]');
        const quantity = Number(lineElement.querySelector('[data-kasya-aov-cart-quantity]').textContent);
        this.updateQuantity(this.getLineIdentifier(increaseButton), quantity + 1);
      }
    }

    onKeydown(event) {
      if (event.key === 'Escape' && this.classList.contains('kasya-aov-cart--open')) {
        this.close();
      }
    }

    async removeItemsByKey(keys, options = {}) {
      if ((!options.keepUpdatingState && this.isUpdating) || !keys.length) return;

      try {
        if (!options.keepUpdatingState) this.setUpdating(true);
        const response = await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            updates: keys.reduce((updates, key) => {
              updates[key] = 0;
              return updates;
            }, {})
          })
        });

        if (!response.ok) {
          throw new Error('Unable to remove Jane Set.');
        }

        await this.refresh();
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to remove Jane Set.', error);
      } finally {
        if (!options.keepUpdatingState) this.setUpdating(false);
      }
    }

    async removeJaneSetByGroup(setId, renderedKeys = []) {
      if (this.isUpdating || !setId) {
        console.warn('[Kasya AOV Cart] Missing Jane Set group id; removal skipped.');
        return;
      }

      try {
        this.setUpdating(true);
        const latestCart = await fetchKasyaAovCart();
        const setKeys = (latestCart.items || [])
          .filter((item) => {
            return item.properties?._set_id === setId &&
              item.properties?._set_name === 'Jane Set' &&
              ['Parent', 'Top', 'Pants'].includes(item.properties?._set_role);
          })
          .map((item) => item.key)
          .filter(Boolean);

        if (!setKeys.length) {
          console.warn('[Kasya AOV Cart] No matching Jane Set keys found; removal skipped.', { setId });
          return;
        }

        const renderedKeySet = new Set(renderedKeys.filter(Boolean));
        if (renderedKeySet.size && setKeys.some((key) => !renderedKeySet.has(key))) {
          console.warn('[Kasya AOV Cart] Jane Set keys changed since render; using latest verified cart keys.', { setId, setKeys });
        }

        await this.removeItemsByKey(setKeys, { keepUpdatingState: true });
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to remove Jane Set group.', error);
      } finally {
        this.setUpdating(false);
      }
    }

    getLineIdentifier(control) {
      const key = control.dataset.key || control.dataset.lineKey || control.closest('[data-kasya-aov-cart-item]')?.dataset.key;
      if (key) return key;

      const line = Number(control.dataset.line || control.closest('[data-kasya-aov-cart-item]')?.dataset.line);
      return Number.isFinite(line) ? line : null;
    }

    setUpdating(isUpdating) {
      this.isUpdating = isUpdating;
      this.classList.toggle('kasya-aov-cart--loading', isUpdating);
      this.querySelectorAll('button').forEach((button) => {
        button.disabled = isUpdating;
        button.setAttribute('aria-disabled', String(isUpdating));
      });
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
