class CartNotification extends HTMLElement {
  constructor() {
    super();
    this.dialog = this.closest('.cart-notification-modal');
    this.continueButton = this.querySelector('.cart-notification__continue');
  }

  connectedCallback() {
    this.onClickContinueHandler = this.onClickContinue.bind(this);
    this.continueButton.addEventListener('click', this.onClickContinueHandler);
  }

  disconnectedCallback() {
    this.continueButton.removeEventListener('click', this.onClickContinueHandler);
  }

  renderContents(parsedState) {
    this.cartItemKey = parsedState.key;
    this.getSectionsToRender().forEach((section) => {
      const sectionTag = document.getElementById(section.id);
      if(sectionTag) {
        sectionTag.innerHTML = getInnerHtmlFromText(
          parsedState.sections[section.id],
          section.selector
        );
      }
    });

    this.open();
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-notification-product',
        selector: `[id="cart-notification-product-${this.cartItemKey}"]`
      },
      {
        id: 'cart-icon-bubble',
        selector: '.shopify-section'
      }
    ];
  }

  open() {
    this.dialog.show(this.activeElement);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

  onClickContinue() {
    this.dialog.hide();
  }
}

customElements.define('cart-notification', CartNotification);