if(!customElements.get('gift-wrapping-content')) {
  customElements.define('gift-wrapping-content', class GiftWrappingContent extends HTMLElement {
    constructor() {
      super();

      this.noteKey = this.dataset.noteKey;
      this.checkbox = this.querySelector('.gift-wrapping-content__checkbox');
      this.addButton = this.querySelector('.gift-wrapping-content__add-button');
      if(this.checkbox) {
        this.productForm = this.querySelector('product-form');
        this.onCheckboxChangeHandler = this.onCheckboxChange.bind(this);
        this.checkbox.addEventListener('change', this.onCheckboxChangeHandler);
      }
      
      this.cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification') || document.querySelector('cart-items');

      this.noteInput = this.querySelector('textarea');
      if(this.noteInput) {
        if(!this.dataset.lineItemsKey && this.noteInput.value) {
          this.removeNote();
        }
        this.onNoteChangeHandler = debounce(this.onNoteChange.bind(this), 300);
        this.noteInput.addEventListener('change', this.onNoteChangeHandler);
      }
      if(this.dataset.removeGiftWrapping) {
        return this.removeGiftWrappingFromCart();
      }
    }

    disconnectedCallback() {
      if(this.checkbox) {
        this.checkbox.removeEventListener('change', this.onCheckboxChangeHandler);
      }
      if(this.noteInput) {
        this.noteInput.removeEventListener('change', this.onNoteChangeHandler);
      }
    }

    onCheckboxChange(e) {
      if(e.isTrusted) {
        if(e.target.checked) {
          this.addGiftWrappingToCart();
        } else {
          this.removeGiftWrappingFromCart();
        }
      }
    }

    onNoteChange(event) {
      this.updateNote(event.target.value);
    }

    updateNote(value) {
      const body = JSON.stringify({ attributes: {
        [this.noteKey]: value
      }});
      fetch(`${routes.cart_update_url}`, {...fetchConfig(), ...{ body }});
    }

    removeNote() {
      this.updateNote('');
    }

    addGiftWrappingToCart() {
      if(this.productForm) {
        // The gift wrapping product has only default variant
        this.productForm.form.dispatchEvent(new Event('submit'));
      }
    }

    removeGiftWrappingFromCart() {
      const keys = this.dataset.lineItemsKey;
      if(keys) {
        let updates = {};
        keys.split(',').forEach((key) => {
          updates[key] = 0;
        });
        const sections = this.cart.getSectionsToRender().map((section) => section.id);
        const body = JSON.stringify({
          updates: updates,
          sections: sections,
          sections_url: window.location.pathname,
          attributes: {
            [this.noteKey]: ""
          }
        });
        this.addButton?.classList.add('loading');
        fetch(`${routes.cart_update_url}`, {...fetchConfig(), ...{ body }})
        .then((response) => {
          return response.text();
        })
        .then((state) => {
          const parsedState = JSON.parse(state);
          this.cart.renderContents(parsedState, null, null);
          if(parsedState.item_count === 0) {
            if(this.cart.nodeName == 'CART-DRAWER') {
              this.cart.classList.add('is-empty');
            } else if (this.cart.nodeName == 'CART-ITEMS') {
              this.cart.closest('.cart-page').classList.add('is-empty');
            }
          }
          document.dispatchEvent(new CustomEvent('afterUpdateQuantity', {detail: {
            source: 'gift-wrapping',
            cartData: parsedState
          }}));
          // errors.classList.add('hidden');
        }).catch((e) => {
         this.addButton?.classList.add('loading');
        });
      }
    }
  });
}

if(!customElements.get('gift-wrapping-updater')) {
  customElements.define('gift-wrapping-updater', class GiftWrappingContent extends HTMLElement {
    constructor() {
      super();

      this.onCartChangeHandler = this.onCartChange.bind(this);
      document.addEventListener('afterCartChanged', this.onCartChangeHandler);
      document.addEventListener('afterUpdateQuantity', this.onCartChangeHandler);
    }

    disconnectedCallback() {
      document.removeEventListener('afterCartChanged', this.onCartChangeHandler);
      document.removeEventListener('afterUpdateQuantity', this.onCartChangeHandler);
    }

    onCartChange() {
      const sections = ["gift-wrapping-bubble","gift-wrapping-content"];
      if(this.dataset.isDrawer) {
        sections.push('gift-wrapping-bubble-number');
      }
      const sectionsStr = sections.join(',');
      fetch(window.location.pathname + `?sections=${sectionsStr}`)
      .then(res => res.json())
      .then(res => {
        const bubbleHtml = getInnerHtmlFromText(res['gift-wrapping-bubble'], '.gift-wrapping-bubble');
        document.querySelector('.gift-wrapping-bubble').innerHTML = bubbleHtml;
        this.innerHTML = getInnerHtmlFromText(res['gift-wrapping-content'], '.shopify-section');
        if(this.dataset.isDrawer) {
          const bubbleNumberHtml = getInnerHtmlFromText(res['gift-wrapping-bubble-number'], '.gift-wrapping-bubble-number');
          document.querySelector('.gift-wrapping-bubble-number').innerHTML = bubbleNumberHtml;
        }
      });
    }
  });
}