if (!customElements.get('sticky-cart')) {
  customElements.define('sticky-cart', 
    class StickyCart extends HTMLElement
    {
      constructor() {
        super();
      }

      connectedCallback() {
        this.currentScrollTop = 0;
        this.form = document.getElementById(this.dataset.form);
        this.formButtons = this.form?.querySelector('.product-form__buttons');
        this.primaryQuantityInput = this.form?.querySelector('.quantity__input');
        this.quantityInput = this.querySelector('.quantity__input');
        if(this.dataset.stickyType == 'on_scroll_up') {
          this.onScrollHandler = this.onScrollType1.bind(this);
        } else {
          this.onScrollHandler = this.onScrollType2.bind(this);
        }
        
        this.variantButtonMobile = this.querySelector('.stick-cart__variant-select-mobile-button');
        if(this.formButtons) {
          window.addEventListener('scroll', this.onScrollHandler, false);
        }

        if(this.primaryQuantityInput) {
          this.onPrimaryQuanityInputChangeHandler = this.onPrimaryQuanityInputChange.bind(this);
          this.primaryQuantityInput.addEventListener('change', this.onPrimaryQuanityInputChangeHandler);
        }

        this.onVariantChangeHandler = this.onVariantChange.bind(this);
        document.addEventListener('afterVariantChanged', this.onVariantChangeHandler);
        if(this.variantButtonMobile) {
          this.onClickVariantButtonMobileHandler = this.onClickVariantButtonMobile.bind(this);
          this.variantButtonMobile.addEventListener('click', this.onClickVariantButtonMobileHandler);
        }

        this.onFocusInHandler = this.onFocusIn.bind(this);
        this.onFocusOutHandler = this.onFocusOut.bind(this);

        this.addEventListener('focusin', this.onFocusInHandler);
        this.addEventListener('focusout', this.onFocusOutHandler);
      }

      disconnectedCallback() {
        if(this.formButtons) {
          window.removeEventListener('scroll', this.onScrollHandler);
        }
        if(this.primaryQuantityInput) {
          this.primaryQuantityInput.removeEventListener('change', this.onPrimaryQuanityInputChangeHandler);
        }
        if(this.variantButtonMobile) {
          this.variantButtonMobile.removeEventListener('click', this.onClickVariantButtonMobileHandler);
        }
        this.removeEventListener('focusin', this.onFocusInHandler);
        this.removeEventListener('focusout', this.onFocusOutHandler);
        document.removeEventListener('afterVariantChanged', this.onVariantChangeHandler);
      }

      open() {
        this.classList.add('open');
        document.body.classList.add('open-sticky-cart');
      }

      hide() {
        this.classList.remove('open');
        document.body.classList.remove('open-sticky-cart');
      }

      onFocusIn() {
        this.classList.add('working');
        this.open();
      }

      onFocusOut() {
        this.classList.remove('working');
        if(this.formButtons.getBoundingClientRect().top >= 0) {
          this.classList.remove('open');
        }
      }

      /**
       * Only visible when scrolling up 
       */
      onScrollType1(event) {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if(!this.classList.contains('working')) {
          if (scrollTop > this.currentScrollTop) {
            // Scrolling down
            this.hide();
          } else {
            // Scrolling up
            this.toggleBasedOnFormButtons();
          }
        }

        this.currentScrollTop = scrollTop;
      }

      /**
       * Always visible
       */
      onScrollType2(event) {
        this.toggleBasedOnFormButtons();
      }

      toggleBasedOnFormButtons() {
        if(this.formButtons.getBoundingClientRect().top >= 0) {
          this.hide();
        } else {
          this.open();
        }
      }

      onPrimaryQuanityInputChange() {
        this.quantityInput.value = this.primaryQuantityInput.value;
      }

      onVariantChange(event) {
        if(event.detail.sectionId !== this.dataset.section) return;
        // Update variant title on mobile
        if(this.variantButtonMobile) {
          this.variantButtonMobile.querySelector('span').textContent = event.detail.variant.title;
        }
      }

      onClickVariantButtonMobile(event) {
        const target = event.currentTarget;
        const variantPicker = document.getElementById(target.dataset.variantPickerElement);
        if(variantPicker) {
          variantPicker.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
          this.hide();
          this.classList.remove('working');
        }
      }
    }
  );
}