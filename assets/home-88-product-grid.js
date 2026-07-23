(() => {
  if (customElements.get('home-88-product-grid')) return;

  const normalize = (value) => String(value || '').trim().toLowerCase();

  class Home88ProductGrid extends HTMLElement {
    connectedCallback() {
      if (this.controller) return;

      this.controller = new AbortController();
      this.modal = this.querySelector('[data-quick-shop-modal]');
      this.panel = this.querySelector('[data-modal-panel]');
      this.form = this.querySelector('[data-quick-shop-form]');
      this.optionsNode = this.querySelector('[data-modal-options]');
      this.titleNode = this.querySelector('[data-modal-title]');
      this.priceNode = this.querySelector('[data-modal-price]');
      this.comparePriceNode = this.querySelector('[data-modal-compare-price]');
      this.imageNode = this.querySelector('[data-modal-image]');
      this.statusNode = this.querySelector('[data-modal-status]');
      this.submitButton = this.querySelector('[data-modal-submit]');
      this.activeCard = null;
      this.activeTrigger = null;
      this.product = null;
      this.mappings = [];
      this.selectedVariant = null;
      this.submitting = false;

      const options = { signal: this.controller.signal };
      this.addEventListener('click', this.onClick, options);
      this.addEventListener('change', this.onChange, options);
      this.form?.addEventListener('submit', this.onSubmit, options);
      document.addEventListener('keydown', this.onKeyDown, options);
      document.addEventListener('shopify:block:select', this.onBlockSelect, options);
      document.addEventListener('shopify:block:deselect', this.onBlockDeselect, options);
    }

    disconnectedCallback() {
      this.closeModal(false);
      this.controller?.abort();
      this.controller = null;
    }

    parseJson(card, selector) {
      const node = card.querySelector(selector);
      if (!node) return null;
      try {
        return JSON.parse(node.textContent);
      } catch (error) {
        console.warn('[Home 8.8 Quick Shop] Invalid product data.', error);
        return null;
      }
    }

    getMappings(card) {
      return (this.parseJson(card, '[data-color-mappings]') || []).filter(Boolean);
    }

    getActiveMapping(card) {
      const swatch = card.querySelector('[data-card-swatch][aria-pressed="true"]');
      const index = Number(swatch?.dataset.colorIndex || 1);
      return this.getMappings(card).find((mapping) => Number(mapping.index) === index) || null;
    }

    setCardColor(card, mapping, swatch = null) {
      if (!mapping) return;

      card.querySelectorAll('[data-card-swatch]').forEach((button) => {
        const active = swatch ? button === swatch : Number(button.dataset.colorIndex) === Number(mapping.index);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      const image = card.querySelector('.home-88-products__image');
      const title = card.querySelector('.home-88-products__title')?.textContent?.trim() || 'Product';
      if (image && mapping.src) {
        image.src = mapping.src;
        image.removeAttribute('srcset');
        image.removeAttribute('sizes');
        image.alt = mapping.alt || `${title} – ${mapping.label || mapping.optionValue || 'color'}`;
      }
    }

    onClick = (event) => {
      const swatch = event.target.closest('[data-card-swatch]');
      if (swatch && this.contains(swatch)) {
        const card = swatch.closest('[data-product-card]');
        const mapping = this.getMappings(card).find((item) => Number(item.index) === Number(swatch.dataset.colorIndex));
        this.setCardColor(card, mapping, swatch);
        return;
      }

      const openButton = event.target.closest('[data-quick-shop-open]');
      if (openButton && this.contains(openButton) && !openButton.disabled) {
        this.openModal(openButton.closest('[data-product-card]'), openButton);
        return;
      }

      if (event.target.closest('[data-modal-close]')) this.closeModal();
    };

    onChange = (event) => {
      const select = event.target.closest('[data-option-position]');
      if (!select || !this.optionsNode?.contains(select)) return;

      if (this.isColorOption(select.dataset.optionName)) {
        const mapping = this.findMapping(select.value);
        if (mapping && this.activeCard) this.setCardColor(this.activeCard, mapping);
      }
      this.updateSelection();
    };

    onKeyDown = (event) => {
      if (!this.modal || this.modal.hidden) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeModal();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = this.getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        this.panel?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    onBlockSelect = (event) => {
      const blockId = event.detail?.blockId;
      if (!blockId) return;
      const card = this.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    onBlockDeselect = (event) => {
      if (event.detail?.blockId && this.activeCard?.dataset.blockId === event.detail.blockId) {
        this.closeModal(false);
      }
    };

    getFocusable() {
      if (!this.panel) return [];
      return Array.from(this.panel.querySelectorAll('button:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hidden && element.getClientRects().length > 0);
    }

    isColorOption(name) {
      const key = normalize(name);
      return key.includes('color') || key.includes('colour');
    }

    findMapping(value) {
      const key = normalize(value);
      if (!key) return null;
      return this.mappings.find((mapping) => normalize(mapping.optionValue) === key)
        || this.mappings.find((mapping) => normalize(mapping.label) === key)
        || null;
    }

    normalizeOptionValues(values) {
      return (values || []).map((value) => {
        if (typeof value === 'string') return value;
        return value?.name || value?.value || String(value || '');
      }).filter(Boolean);
    }

    openModal(card, trigger) {
      const product = this.parseJson(card, '[data-product-json]');
      if (!product || !this.modal || !this.form) return;

      this.activeCard = card;
      this.activeTrigger = trigger;
      this.product = product;
      this.mappings = this.getMappings(card);
      this.selectedVariant = null;
      this.submitting = false;
      this.titleNode.textContent = product.displayTitle || product.title;
      this.optionsNode.innerHTML = '';
      this.statusNode.textContent = '';
      this.submitButton.disabled = true;
      this.submitButton.textContent = 'Add to Cart';

      const activeMapping = this.getActiveMapping(card);
      product.options.forEach((option, optionIndex) => {
        const position = Number(option.position || optionIndex + 1);
        const field = document.createElement('div');
        field.className = 'home-88-products__modal-field';

        const label = document.createElement('label');
        const selectId = `Home88Option-${this.dataset.sectionId}-${card.dataset.blockId}-${position}`;
        label.htmlFor = selectId;
        label.textContent = option.name;

        const select = document.createElement('select');
        select.id = selectId;
        select.dataset.optionPosition = String(position);
        select.dataset.optionName = option.name;
        select.innerHTML = `<option value="">Choose ${this.escapeHtml(option.name)}</option>`;

        this.normalizeOptionValues(option.values).forEach((value) => {
          const optionNode = document.createElement('option');
          optionNode.value = value;
          optionNode.textContent = value;
          select.appendChild(optionNode);
        });

        if (this.isColorOption(option.name) && activeMapping?.optionValue) {
          const exactValue = Array.from(select.options).find((item) => item.value === activeMapping.optionValue);
          if (exactValue) select.value = exactValue.value;
        }

        field.append(label, select);
        this.optionsNode.appendChild(field);
      });

      this.renderImage(activeMapping?.src || product.featuredImage?.src, activeMapping?.label || activeMapping?.optionValue);
      this.renderPrice(product);
      this.modal.hidden = false;
      document.documentElement.classList.add('home-88-quick-shop-open');
      this.updateSelection();
      requestAnimationFrame(() => this.getFocusable()[0]?.focus() || this.panel?.focus());
    }

    closeModal(restoreFocus = true) {
      if (!this.modal || this.modal.hidden) return;
      this.modal.hidden = true;
      document.documentElement.classList.remove('home-88-quick-shop-open');
      if (restoreFocus) this.activeTrigger?.focus();
      this.activeCard = null;
      this.product = null;
      this.mappings = [];
      this.selectedVariant = null;
      this.submitting = false;
    }

    escapeHtml(value) {
      const node = document.createElement('span');
      node.textContent = String(value || '');
      return node.innerHTML;
    }

    getSelects() {
      return Array.from(this.optionsNode.querySelectorAll('[data-option-position]'));
    }

    getSelections() {
      return this.getSelects().map((select) => select.value);
    }

    variantMatches(variant, selections, ignoredIndex = -1) {
      return selections.every((value, index) => index === ignoredIndex || !value || variant.options[index] === value);
    }

    updateOptionAvailability() {
      const selects = this.getSelects();
      const selections = this.getSelections();
      selects.forEach((select, index) => {
        Array.from(select.options).forEach((option) => {
          if (!option.value) return;
          const candidate = [...selections];
          candidate[index] = option.value;
          option.disabled = !this.product.variants.some((variant) => variant.available && this.variantMatches(variant, candidate));
        });
      });
    }

    updateSelection() {
      if (!this.product) return;
      this.updateOptionAvailability();
      const selections = this.getSelections();
      const complete = selections.length === this.product.options.length && selections.every(Boolean);
      this.selectedVariant = complete
        ? this.product.variants.find((variant) => variant.options.every((value, index) => value === selections[index])) || null
        : null;

      const available = Boolean(this.selectedVariant?.available);
      this.submitButton.disabled = !available || this.submitting;
      this.submitButton.textContent = this.selectedVariant && !available ? 'Sold Out' : 'Add to Cart';

      if (!complete) {
        this.statusNode.textContent = 'Please choose all options.';
      } else if (!this.selectedVariant || !available) {
        this.statusNode.textContent = 'This combination is unavailable.';
      } else {
        this.statusNode.textContent = '';
      }

      const colorSelect = this.getSelects().find((select) => this.isColorOption(select.dataset.optionName));
      const color = colorSelect?.value || '';
      const mapping = this.findMapping(color);
      const image = this.selectedVariant?.featuredImage?.src || mapping?.src || this.product.featuredImage?.src;
      this.renderImage(image, color || mapping?.label);
      this.renderPrice(this.selectedVariant || this.product);
    }

    renderImage(src, color) {
      if (!this.imageNode) return;
      if (src) {
        this.imageNode.src = src;
        this.imageNode.hidden = false;
      } else {
        this.imageNode.removeAttribute('src');
        this.imageNode.hidden = true;
      }
      const title = this.product?.displayTitle || this.product?.title || 'Product';
      this.imageNode.alt = color ? `${title} – ${color}` : title;
    }

    renderPrice(variant) {
      if (!variant) return;
      this.priceNode.textContent = variant.priceFormatted || '';
      const showCompare = Number(variant.compareAtPrice || 0) > Number(variant.price || 0);
      this.comparePriceNode.hidden = !showCompare;
      this.comparePriceNode.textContent = showCompare ? variant.compareAtPriceFormatted : '';
    }

    updateCartIcon(response) {
      const html = response?.sections?.['cart-icon-bubble'];
      const current = document.getElementById('cart-icon-bubble');
      if (!html || !current) return;
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const updated = parsed.getElementById('cart-icon-bubble');
      if (updated) current.innerHTML = updated.innerHTML;
    }

    async addToCart(variantId) {
      const cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification') || document.querySelector('cart-items');
      const formData = new FormData();
      formData.append('id', String(variantId));
      formData.append('quantity', '1');

      if (cart && typeof cart.getSectionsToRender === 'function') {
        formData.append('sections', cart.getSectionsToRender().map((section) => section.id).join(','));
        formData.append('sections_url', window.location.pathname);
      }
      if (cart && typeof cart.setActiveElement === 'function') cart.setActiveElement(this.activeTrigger);

      const config = typeof window.fetchConfig === 'function'
        ? window.fetchConfig('javascript')
        : { method: 'POST', headers: { Accept: 'application/json' } };
      config.headers = config.headers || {};
      config.headers.Accept = 'application/json';
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete config.headers['Content-Type'];
      config.body = formData;

      const response = await fetch(window.routes?.cart_add_url || '/cart/add.js', config);
      const result = await response.json();
      if (!response.ok || result.status) throw new Error(result.description || result.message || 'Unable to add this item to the cart.');

      this.updateCartIcon(result);
      this.closeModal();

      let openedAovCart = false;
      if (window.KasyaAovCart && typeof window.KasyaAovCart.open === 'function') {
        try {
          window.KasyaAovCart.open();
          openedAovCart = true;
        } catch (error) {
          console.warn('[Home 8.8 Quick Shop] Kasya AOV Cart handoff failed.', error);
        }
      }

      if (!openedAovCart && cart && typeof cart.renderContents === 'function') {
        cart.classList?.remove('is-empty');
        cart.renderContents(result);
      } else if (!openedAovCart && (!cart || typeof cart.renderContents !== 'function')) {
        window.location.assign(window.routes?.cart_url || '/cart');
      }

      document.dispatchEvent(new CustomEvent('afterCartChanged', {
        detail: { productVariantId: variantId, source: 'home-88-quick-shop', cartData: result }
      }));
    }

    onSubmit = async (event) => {
      event.preventDefault();
      if (this.submitting || !this.selectedVariant?.available) return;

      this.submitting = true;
      this.submitButton.disabled = true;
      this.submitButton.textContent = 'Adding…';
      this.statusNode.textContent = '';

      try {
        await this.addToCart(this.selectedVariant.id);
      } catch (error) {
        this.submitting = false;
        this.statusNode.textContent = error.message || 'Unable to add this item to the cart. Please try again.';
        this.updateSelection();
      }
    };
  }

  customElements.define('home-88-product-grid', Home88ProductGrid);
})();
