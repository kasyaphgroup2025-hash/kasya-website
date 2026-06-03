class CartDrawer extends DrawerFixed {
  constructor() {
    super();

    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink)
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    this.updateProductRecommendation();
    super.open(triggeredBy);
  }

  close(evt) {
    const currentFooterAction = this.querySelector('cart-drawer-footer-action.open');
    if(currentFooterAction) {
      currentFooterAction.closeActionContent();
    }
    if(!this.classList.contains('busy') || !evt.target.closest('cart-drawer-footer-action')) {
      super.close(evt);
    }    
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if(cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.querySelector('.drawer__inner').classList.contains('is-empty') && this.querySelector('.drawer__inner').classList.remove('is-empty');
    this.getSectionsToRender().forEach((section => {
      const sectionElement = section.selector ? document.querySelector(section.selector) : document.getElementById(section.id);
      if(sectionElement) {
        sectionElement.innerHTML =
          this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
      }
    }));

    setTimeout(() => {
      this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
      this.open();
    });
  }

  updateProductRecommendation() {
    this.productRecommendation = this.querySelector('cart-product-recommendations');
    if(this.productRecommendation) {
      const cartItemsWrapper = this.querySelector('.cart-drawer__items');
      cartItemsWrapper.classList.toggle('cart-drawer__items--large', cartItemsWrapper.querySelectorAll('.cart-item').length > 1);
      this.productRecommendation.update();
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '.cart-drawer__items'
      },
      {
        id: 'cart-drawer',
        selector: '.cart-drawer__footer--subtotal'
      },
      {
        id: 'cart-icon-bubble'
      }
    ];
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        section: 'CartDrawer',
        id: 'cart-drawer',
        selector: '.cart-drawer__items'
      },
      {
        section: 'CartDrawer',
        id: 'cart-drawer',
        selector: '.cart-drawer__footer--subtotal'
      },
      {
        section: 'cart-icon-bubble',
        id: 'cart-icon-bubble',
        selector: '.shopify-section'
      }
    ];
  }

  updateProductRecommendation() {
    const cartDrawerWrapper = document.querySelector('cart-drawer');
    if(cartDrawerWrapper) {
      cartDrawerWrapper.updateProductRecommendation();
    }
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);

class CartDrawerFooterAction extends HTMLElement {
  constructor() {
    super();
    this.openButton = this.querySelector('.cart-drawer__footer__action-label');
    this.content = this.querySelector('.cart-drawer__footer__action-content');
    this.closeButton = this.content.querySelector('.cart-drawer__footer__action-close');
    
    this.openButton.addEventListener('click', this.onClickFooterAction.bind(this));
    this.closeButton.addEventListener('click', this.closeActionContent.bind(this));

    this.cartDrawer = this.closest('.drawer__inner');
  }

  onClickFooterAction(event) {
    const isOpen = this.classList.contains('open');
    isOpen ? this.closeActionContent(event) : this.openActionContent(); 
  }

  openActionContent() {
    this.style.setProperty('--drawer-bottom-position', `${Math.floor(this.cartDrawer.scrollTop)}px`);
    this.classList.add('open');
    this.content.classList.add('appear')
    setTimeout(() => {this.content.classList.add('animate')}, 1);
    setTimeout(() => {this.content.querySelector('textarea,select').focus();}, 300);
    this.closest('cart-drawer').classList.add('busy');
  }

  closeActionContent() {
    this.classList.remove('open');
    this.content.classList.remove('animate');
    setTimeout(() => {
      this.content.classList.remove('appear');
      const cartDrawer = this.closest('cart-drawer');
      cartDrawer.classList.remove('busy');
      trapFocus(cartDrawer, this.openButton);
    }, 300);
  }
}

customElements.define('cart-drawer-footer-action', CartDrawerFooterAction);

class CartDrawerNote extends HTMLElement {
  constructor() {
    super();

    this.input = this.querySelector('textarea');
    this.button = this.querySelector('.button');
    
    this.button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const body = JSON.stringify({ note: this.input.value });
      fetch(`${routes.cart_update_url}`, {...fetchConfig(), ...{ body }});
      this.closest('cart-drawer-footer-action').closeActionContent();
    }, false);
  }
}

customElements.define('cart-drawer-note', CartDrawerNote);