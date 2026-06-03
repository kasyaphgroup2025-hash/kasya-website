if (!customElements.get('cart-discount-component')) {
  customElements.define('cart-discount-component', class CartDiscount extends HTMLElement {
    constructor() {
      super();
      this.form = this.querySelector('form');
      this.onSubmitHandler = this.applyDiscount.bind(this);
      this.form.addEventListener('submit', this.onSubmitHandler);
      this.submitButton = this.querySelector('[type="submit"]');
      this.cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification') || document.querySelector('cart-items');
      this.codesTag = this.querySelector('.cart-discount__codes');
    }

    connectedCallback() {
      this.initRequireRefs();
    }

    disconnectedCallback() {
      this.form.removeEventListener('submit', this.onSubmitHandler);
    }

    initRequireRefs() {
      this.cartDiscountError = document.getElementById('cartDiscountError');
      this.cartDiscountErrorDiscountCode = document.getElementById('cartDiscountErrorDiscountCode');
      this.cartDiscountErrorShipping = document.getElementById('cartDiscountErrorShipping');
    }

    /** @type {AbortController | null} */
    #activeFetch = null;

    #createAbortController() {
      if (this.#activeFetch) {
        this.#activeFetch.abort();
      }

      const abortController = new AbortController();
      this.#activeFetch = abortController;
      return abortController;
    }

    /**
     * Handles updates to the cart note.
     * @param {SubmitEvent} event - The submit event on our form.
     */
    applyDiscount = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const discountCode = form.querySelector('input[name="discount"]');
      if (!(discountCode instanceof HTMLInputElement) || typeof this.dataset.sectionId !== 'string') return;

      const discountCodeValue = discountCode.value;

      const abortController = this.#createAbortController();

      try {
        const existingDiscounts = this.#existingDiscounts();
        if (existingDiscounts.includes(discountCodeValue)) return;

        this.cartDiscountError.classList.add('hidden');
        this.cartDiscountErrorDiscountCode.classList.add('hidden');
        this.cartDiscountErrorShipping.classList.add('hidden');

        const config = fetchConfig('json');
        config.body = JSON.stringify({
          discount: [...existingDiscounts, discountCodeValue].join(','),
          sections: this.cart.getSectionsToRender().map((section) => section.id),
          sections_url: window.location.pathname
        });

        this.submitButton.classList.add('loading');
        this.submitButton.querySelector('.loading-overlay__spinner').classList.remove('hidden');

        const response = await fetch(routes.cart_update_url, {
          ...config,
          signal: abortController.signal,
        });

        const data = await response.json();

        if (
          data.discount_codes.find((/** @type {{ code: string; applicable: boolean; }} */ discount) => {
            return discount.code === discountCodeValue && discount.applicable === false;
          })
        ) {
          discountCode.value = '';
          this.#handleDiscountError('discount_code');
          return;
        }

        const section = this.#parseSection(data);
        const discountCodes = section?.querySelectorAll('.cart-discount__pill') || [];
        if (section) {
          const codes = Array.from(discountCodes)
            .map((element) => (element instanceof HTMLLIElement ? element.dataset.discountCode : null))
            .filter(Boolean);
          // Before morphing, we need to check if the shipping discount is applicable in the UI
          // we check the liquid logic compared to the cart payload to assess whether we leveraged
          // a valid shipping discount code.
          if (
            codes.length === existingDiscounts.length &&
            codes.every((/** @type {string} */ code) => existingDiscounts.includes(code)) &&
            data.discount_codes.find((/** @type {{ code: string; applicable: boolean; }} */ discount) => {
              return discount.code === discountCodeValue && discount.applicable === true;
            })
          ) {
            this.#handleDiscountError('shipping');
            discountCode.value = '';
            return;
          }
        }

        this.#completeApiCalling(data, section);
      } catch (error) {
        // console.log(error);
      } finally {
        this.#activeFetch = null;
        this.submitButton.classList.remove('loading');
        this.submitButton.querySelector('.loading-overlay__spinner').classList.add('hidden');
      }
    };

    /**
     * Calling an cart update api to remove a discount from the cart.
     * 
     */
    removeDiscount = async (discountCode) => {
      const existingDiscounts = this.#existingDiscounts();
      const index = existingDiscounts.indexOf(discountCode);
      if (index === -1) return;

      existingDiscounts.splice(index, 1);

      const abortController = this.#createAbortController();

      try {
        const config = fetchConfig('json');
        config.body = JSON.stringify({
          discount: existingDiscounts.join(','),
          sections: this.cart.getSectionsToRender().map((section) => section.id),
          sections_url: window.location.pathname
        });

        const response = await fetch(routes.cart_update_url, {
          ...config,
          signal: abortController.signal,
        });

        const data = await response.json();
        const section = this.#parseSection(data);
        
        this.#completeApiCalling(data, section);
        
      } catch (error) {
        // console.log(error);
        this.querySelectorAll('cart-discount-remove').forEach(e => e.disableLoading());
      } finally {
        this.#activeFetch = null;
      }
    };

    /**
     * Handles the discount error.
     *
     * @param {'discount_code' | 'shipping'} type - The type of discount error.
     */
    #handleDiscountError(type) {
      const target = type === 'discount_code' ? this.cartDiscountErrorDiscountCode : this.cartDiscountErrorShipping;
      this.cartDiscountError.classList.remove('hidden');
      target.classList.remove('hidden');
    }

    /**
     * Returns an array of existing discount codes.
     * @returns {string[]}
     */
    #existingDiscounts() {
      /** @type {string[]} */
      const discountCodes = [];
      const discountPills = this.querySelectorAll('.cart-discount__pill');
      for (const pill of discountPills) {
        if (pill instanceof HTMLLIElement && typeof pill.dataset.discountCode === 'string') {
          discountCodes.push(pill.dataset.discountCode);
        }
      }

      return discountCodes;
    }

    /**
     * Get section DOM HTML from the response
     * 
     * @param {object} data 
     */
    #parseSection(data) {
      const newHtml = data.sections[this.dataset.sectionId];
      const parsedHtml = new DOMParser().parseFromString(newHtml, 'text/html');
      return parsedHtml.getElementById(`shopify-section-${this.dataset.sectionId}`);
    }

    /**
     * Update the cart drawer, cart page, discount codes, and dispatch the afterDiscountUpdated event
     * 
     * @param {object} data 
     * @param {HTMLElement} section
     */
    #completeApiCalling(data, section) {
      this.cart.renderContents(data);
      if(section) {
        this.codesTag.innerHTML = section.querySelector('.cart-discount__codes').innerHTML;
      }
      document.dispatchEvent(new CustomEvent('afterDiscountUpdate', {detail: {
        data: data,
        id: this.id
      }}));
    }
  });
}

if (!customElements.get('cart-discount-remove')) {
  customElements.define('cart-discount-remove', class CartDiscountRemove extends HTMLElement {
    constructor() {
      super();

      this.button = this.querySelector('button');
      this.onButtonClickHandler = this.onClickButton.bind(this);
      this.button.addEventListener('click', this.onButtonClickHandler);
    }

    disconnectedCallback() {
      this.button.removeEventListener('click', this.onButtonClickHandler);
    }

    /**
     * Handles removing a discount from the cart.
     * @param {MouseEvent | KeyboardEvent} event - The mouse or keyboard event in our pill.
     */
    onClickButton(event) {
      event.preventDefault();
      event.stopPropagation();
      if (
        (event instanceof KeyboardEvent && event.key !== 'Enter') ||
        !(event instanceof MouseEvent) ||
        !(event.currentTarget instanceof HTMLElement)
      ) {
        return;
      }

      const pill = event.currentTarget.closest('.cart-discount__pill');
      if (!(pill instanceof HTMLLIElement)) return;
      const discountCode = pill.dataset.discountCode;
      if (!discountCode) return;

      this.enableLoading();
      this.closest('cart-discount-component').removeDiscount(discountCode);
    }

    enableLoading() {
      this.button.setAttribute('disabled', 'disabled');
      this.button.classList.add('loading');
      this.button.querySelector('.icon-close').classList.add('hidden');
      this.button.querySelector('.cart-discount__pill-remove__loading').classList.remove('hidden');
    }

    disableLoading() {
      this.button.removeAttribute('disabled');
      this.button.classList.remove('loading');
      this.button.querySelector('.icon-close').classList.remove('hidden');
      this.button.querySelector('.cart-discount__pill-remove__loading').classList.add('hidden');
    }
  });
}