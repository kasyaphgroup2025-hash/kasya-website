if (!customElements.get('product-form')) {
  customElements.define('product-form', class ProductForm extends HTMLElement {
    constructor() {
      super();

      this.form = this.querySelector('form');
      this.form.querySelector('[name="id"]').disabled = false;
      this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
      this.cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification') || document.querySelector('cart-items');
      this.useSuccessMessage = this.cart && this.cart.tagName.toLowerCase() !== 'cart-notification' && window.showAddToCartMessage;
      this.submitButton = this.querySelector('[type="submit"]');
      this.submitButtonText = this.submitButton.querySelector('span');
      if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');
      this.hideErrors = this.dataset.hideErrors === 'true';
    }

    onSubmitHandler(evt) {
      evt.preventDefault();
      if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

      this.handleErrorMessage();
      this.submitButton.setAttribute('aria-disabled', true);
      this.submitButton.classList.add('loading');
      this.querySelector('.loading-overlay__spinner').classList.remove('hidden');

      const request = this.prepareRequestConfig();
      const formData = request.formData;

      fetch(`${routes.cart_add_url}`, request.config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status && response.status != 422) {
            document.dispatchEvent(new CustomEvent('afterAddCartError', {detail: {
              productVariantId: formData.get('id'),
              errors: response.errors || response.description,
              message: response.message
            }}));
            this.handleErrorMessage(response.description);
            const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
            if (!soldOutMessage) return;
            this.submitButton.setAttribute('aria-disabled', true);
            this.submitButton.querySelector('span').classList.add('hidden');
            soldOutMessage.classList.remove('hidden');
            this.error = true;
            return;
          } else if (!this.cart) {
            window.location = window.routes.cart_url;
            return;
          }
          if(!this.error) {
            if(response.status != 422) {
              this.error = false;
              if(this.useSuccessMessage) {
                pushSuccessMessage(window.cartStrings.success);
              }
              this.completeAddToCartAction(response, formData.get('id'));
            } else {
              this.handleErrorMessage(response.description);
              this.handle422Error(formData.get('id'));
            }
          }
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          this.submitButton.classList.remove('loading');
          if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
          if (!this.error) this.submitButton.removeAttribute('aria-disabled');
          this.querySelector('.loading-overlay__spinner').classList.add('hidden');
        });
    }

    prepareRequestConfig() {
      const config = fetchConfig('javascript');
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete config.headers['Content-Type'];

      const formData = new FormData(this.form);
      if (this.cart) {
        formData.append('sections', this.cart.getSectionsToRender().map((section) => section.id));
        formData.append('sections_url', window.location.pathname);
        this.cart.setActiveElement(document.activeElement);
      }
      config.body = formData;

      return {
        config: config,
        formData: formData
      };
    }

    handle422Error(variantId) {
      const sections = this.cart.getSectionsToRender().map((section) => section.id);
      const uniqueSections = sections.filter((item, index) => sections.indexOf(item) === index);
      fetch(`${window.location.pathname}?sections=${uniqueSections.join(",")}`)
        .then((response) => response.json())
        .then(response => {
          const finalResponse = {
            sections: response
          };
          this.completeAddToCartAction(finalResponse, variantId, { useKasyaAovCart: false });
        });
    }

    completeAddToCartAction(response, variantId, options = {}) {
      const quickAddDrawer = this.closest('quick-add-drawer');
      const shouldUseKasyaAovCart = options.useKasyaAovCart !== false && window.KasyaAovCart && typeof window.KasyaAovCart.open === 'function';
      const renderOriginalCart = () => {
        this.cart.renderContents(response);
      };
      const openKasyaAovCart = () => {
        if (!shouldUseKasyaAovCart) return false;

        try {
          this.updateCartIconBubble(response);
          window.KasyaAovCart.open();
          return true;
        } catch (error) {
          console.warn('[Kasya AOV Cart] Add-to-cart hook failed; falling back to original cart drawer.', error);
          return false;
        }
      };
      const completeCartOpen = () => {
        if (!openKasyaAovCart()) renderOriginalCart();
      };

      if (quickAddDrawer) {
        document.body.addEventListener('drawerClosed', () => {
          setTimeout(completeCartOpen);
        }, { once: true });
        quickAddDrawer.close();
      } else {
        completeCartOpen();
      }
      document.dispatchEvent(new CustomEvent('afterCartChanged', {detail: {
        productVariantId: variantId,
        source: 'product-form',
        cartData: response
      }}));
    }

    updateCartIconBubble(response) {
      const cartIconHtml = response?.sections?.['cart-icon-bubble'];
      const currentCartIcon = document.getElementById('cart-icon-bubble');
      if (!cartIconHtml || !currentCartIcon) return;

      const parsedHtml = new DOMParser().parseFromString(cartIconHtml, 'text/html');
      const updatedCartIcon = parsedHtml.getElementById('cart-icon-bubble') || parsedHtml.querySelector('#cart-icon-bubble');
      const updatedCartIconContent = updatedCartIcon || parsedHtml.querySelector('.shopify-section') || parsedHtml.body;
      if (updatedCartIconContent) currentCartIcon.innerHTML = updatedCartIconContent.innerHTML;
    }

    toggleSubmitButton(disable = true, text) {
      if (disable) {
        this.submitButton.setAttribute('disabled', 'disabled');
        if (text && this.submitButtonText) this.submitButtonText.textContent = text;
      } else {
        this.submitButton.removeAttribute('disabled');
        if(this.submitButtonText) {
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }
    }

    handleErrorMessage(errorMessage = false) {
      if (this.hideErrors) return;
      this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
      if(errorMessage && !this.errorMessageWrapper) {
        pushErrorMessage(errorMessage);
      }
      if (!this.errorMessageWrapper) return;
      this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

      this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

      if (errorMessage) {
        this.errorMessage.textContent = errorMessage;
      }
    }
  });
}
