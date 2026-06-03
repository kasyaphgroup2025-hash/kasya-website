if (!customElements.get('complementary-products')) {
	customElements.define('complementary-products', class ComplementaryProducts extends HTMLElement {
    constructor() {
      super();

      this.form = this.querySelector('form');
      this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
      this.cart = document.querySelector('cart-drawer');
      this.submitButton = this.querySelector('[type="submit"]');
      if (this.submitButton && document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

      if(this.querySelector('.complementary__actions')) {
        this.price = this.querySelector('.complementary__total__price');
        this.querySelectorAll('.select__select,input.complementary-variant-id[data-available="true"],.quantity__input').forEach(element => {
          element.addEventListener('change', this.onChangeHandler.bind(this));
        });
      }
    }

    onSubmitHandler(evt) {
      evt.preventDefault();
      if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

      this.handleErrorMessage();
      
      this.submitButton.setAttribute('aria-disabled', true);
      this.submitButton.classList.add('loading');
      this.querySelector('.loading-overlay__spinner').classList.remove('hidden');

      const config = fetchConfig('javascript');
      
      let formData = {};
      if (this.cart) {
        formData.sections = this.cart.getSectionsToRender().map((section) => section.id);
        formData.sections_url = window.location.pathname;
        this.cart.setActiveElement(document.activeElement);
      }
      
      /* Collection items */
      let items = [];
      this.querySelectorAll('.complementary__item').forEach((item) => {
        const quantityInput = item.querySelector('.quantity__input');
        if(parseInt(quantityInput.value) > 0) {
          items.push({
            id: item.querySelector('.complementary-variant-id').value,
            quantity: quantityInput.value
          });
        }
      });
      formData.items = items;
      config.body = JSON.stringify(formData);

      fetch(`${routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
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
          this.error = false;
          document.dispatchEvent(new CustomEvent('afterCartChanged'));
          this.cart.renderContents(response);
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

    onChangeHandler(evt) {
      if(evt.target.classList.contains('select__select')) {
        const currentItem = evt.target.closest('.complementary__item');
        const itemAttributeTag = evt.target.querySelector('option:checked');
        this.updatePrice(currentItem.querySelector('.price'), parseInt(itemAttributeTag.dataset.price), parseInt(itemAttributeTag.dataset.compareAtPrice), true);
        const imageTag = currentItem.querySelector('img');
        if(itemAttributeTag.dataset.featuredImage) {
          let srcset = '';
          const imageWidth = parseInt(itemAttributeTag.dataset.featuredImageWidth);
          const originImageSrc = itemAttributeTag.dataset.featuredImage;
          const widths = [275, 550, 710, 1420];
          widths.forEach(width => {
            if(imageWidth >= width) {
              srcset += `${originImageSrc}&width=${width} ${width}w,`;
            }
          });
          srcset += `${originImageSrc} ${imageWidth}w`;
          imageTag.srcset = srcset;
          imageTag.classList.add('use-variant-image');
        } else if(imageTag.classList.contains('use-variant-image')){
          imageTag.srcset = currentItem.dataset.featuredImage;
          imageTag.classList.remove('use-variant-image');
        }
      } 
      let totalPrice = 0, totalCompareAtPrice = 0, totalQuantity = 0;
      this.querySelectorAll('.complementary__item__info--variant').forEach(element => {
        const variantTag = element.querySelector('.complementary-variant-id');
        let attributeTag = variantTag;
        if(variantTag.classList.contains('select__select')) {
          attributeTag = variantTag.querySelector('option:checked');
        }
        if(attributeTag.dataset.available === 'true') {
          const input = element.querySelector('.quantity__input');
          const quantity = parseInt(input.value);
          totalQuantity += quantity;
          totalPrice += parseInt(attributeTag.dataset.price) * quantity;
          totalCompareAtPrice += parseInt(attributeTag.dataset.compareAtPrice) * quantity;
        }
      });
      if(this.price) {
        this.updatePrice(this.price, totalPrice, totalCompareAtPrice, true);
      }
      if(this.submitButton) {
        if(totalQuantity > 0) {
          this.submitButton.removeAttribute('disabled');
        } else {
          this.submitButton.setAttribute('disabled', 'disabled');
        }
      }
    }

    updatePrice(priceElement, price, compareAtPrice, noConvert) {
      priceElement.update(price, compareAtPrice, noConvert);
    }

    handleErrorMessage(errorMessage = false) {
      this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
      if (!this.errorMessageWrapper) return;
      this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

      this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

      if (errorMessage) {
        this.errorMessage.textContent = errorMessage;
      }
    }
  });
}