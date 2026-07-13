class CartRemoveButton extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class JaneSetRemoveButton extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', (event) => {
      event.preventDefault();
      this.removeSet();
    });
  }

  connectedCallback() {
    if (this.dataset.incomplete !== 'true') return;

    window.janeSetOrphansRemoving = window.janeSetOrphansRemoving || new Set();
    const removalId = [this.dataset.topKey, this.dataset.pantsKey].filter(Boolean).join('|');
    if (!removalId || window.janeSetOrphansRemoving.has(removalId)) return;

    window.janeSetOrphansRemoving.add(removalId);
    window.setTimeout(() => this.removeSet(), 0);
  }

  removeSet() {
    const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
    if (!cartItems || typeof cartItems.removeSet !== 'function') return;

    this.querySelector('button')?.setAttribute('disabled', 'disabled');
    cartItems.removeSet([this.dataset.topKey, this.dataset.pantsKey]);
  }
}

customElements.define('jane-set-remove-button', JaneSetRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();

    this.lineItemStatusElement = document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    this.debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300).bind(this);

    this.addEventListener('change', this.debouncedOnChange);
  }
  
  disconnectedCallback() {
    this.removeEventListener('change', this.debouncedOnChange);
  }

  onChange(event) {
    this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'), event.target.dataset.quantityVariantId);
  }

  getSectionsToRender() {
    return [
      {
        section: 'main-cart-items',
        id: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        section: 'cart-icon-bubble',
        id: 'cart-icon-bubble',
        selector: '.shopify-section'
      },
      {
        section: 'cart-live-region-text',
        id: 'cart-live-region-text',
        selector: '.shopify-section'
      },
      {
        section: 'main-cart-footer',
        id: document.getElementById('main-cart-items').dataset.id,
        selector: '.cart__footer__js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, name, variantId) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.id),
      sections_url: window.location.pathname
    });

    const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
    fetch(`${routes.cart_change_url}`, {...fetchConfig(), ...{ body }})
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
        let message = '';
        if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
          if (typeof updatedValue === 'undefined') {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
          }
        }
        this.updateLiveRegions(line, message);

        const lineItem =  document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        this.renderContents(parsedState, lineItem, name);
        document.dispatchEvent(new CustomEvent('afterUpdateQuantity', {detail: {
          source: 'cart-items',
          cartData: parsedState,
          variantId: variantId
        }}));
        errors.classList.add('hidden');
      }).catch((e) => {
        errors.classList.remove('hidden');
        errors.querySelector('span').textContent = window.cartStrings.error;
      }).finally(() => {
        this.querySelectorAll('.loading-overlay').forEach((overlay) => overlay.classList.add('hidden'));
        this.disableLoading();
      });
  }

  removeSet(keys) {
    const lineKeys = keys.filter(Boolean);
    if (!lineKeys.length) return;

    this.classList.add('cart__items--disabled');
    this.lineItemStatusElement.setAttribute('aria-hidden', false);

    const updates = lineKeys.reduce((result, key) => {
      result[key] = 0;
      return result;
    }, {});
    const body = JSON.stringify({
      updates,
      sections: this.getSectionsToRender().map((section) => section.id),
      sections_url: window.location.pathname
    });
    const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');

    fetch(`${routes.cart_update_url}`, {...fetchConfig(), ...{ body }})
      .then((response) => response.json())
      .then((parsedState) => {
        if (parsedState.errors) throw new Error(parsedState.errors);

        this.renderContents(parsedState);
        document.dispatchEvent(new CustomEvent('afterCartChanged', {detail: {
          source: 'jane-set-remove',
          cartData: parsedState
        }}));
        errors?.classList.add('hidden');
      })
      .catch((error) => {
        if (errors) {
          errors.classList.remove('hidden');
          const message = errors.querySelector('span');
          if (message) message.textContent = error.message || window.cartStrings.error;
        }
      })
      .finally(() => {
        this.lineItemStatusElement.setAttribute('aria-hidden', true);
        this.classList.remove('cart__items--disabled');
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError = document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if(lineItemError) {
      lineItemError.querySelector('.cart-item__error-text').innerHTML = message;
      lineItemError.classList.remove('hidden');
    }

    const lineItemError2 = document.getElementById(`Line-item-error-2-${line}`);
    if(lineItemError2) {
      lineItemError2.querySelector('.cart-item__error-text').innerHTML = message;
      lineItemError2.classList.remove('hidden');
    }

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus = document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  renderContents(parsedState, lineItem, name) {
    const cartDrawerWrapper = document.querySelector('cart-drawer');
    // const cartFooter = document.getElementById('main-cart-footer');
    const cartPage = document.getElementById('main-cart');
    if(cartPage) {
      cartPage.classList.toggle('is-empty', parsedState.item_count === 0);
      const cartPageBox = cartPage.getBoundingClientRect();
      if(!(cartPageBox.top < window.innerHeight && cartPageBox.bottom >= 0)) {
        // Scroll top to the cart page content
        cartPage.scrollIntoView({ behavior: "smooth" });
      }
    }

    // if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
    if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

    this.getSectionsToRender().forEach((section => {
      const sectionTag = document.getElementById(section.section);
      if(sectionTag) {
        const elementToReplace = sectionTag.querySelector(section.selector) || sectionTag;
        if(elementToReplace) {
          elementToReplace.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
        }
      }  
    }));

    if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
      cartDrawerWrapper ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`)) : lineItem.querySelector(`[name="${name}"]`).focus();
    } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
      trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'))
    } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
      trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'))
    }

    this.updateProductRecommendation();
  }

  updateProductRecommendation() {
    const recommendation = document.querySelector('main-cart-recommendations');
    if(recommendation) {
      recommendation.update();
    }
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');
    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading-overlay`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading-overlay`);
    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));
    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading() {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');
  }

  setActiveElement(element) {
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define('cart-note', class CartNote extends HTMLElement {
    constructor() {
      super();

      this.onChangeHandler = debounce(this.onChange.bind(this), 300);
      this.addEventListener('change', this.onChangeHandler);
    }

    disconnectedCallback() {
      this.removeEventListener('change', this.onChangeHandler);
    }

    onChange(event) {
      const body = JSON.stringify({ note: event.target.value });
      fetch(`${routes.cart_update_url}`, {...fetchConfig(), ...{ body }});
    }
  });
};
