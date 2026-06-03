class EmailSignUpPopup extends ModalDialog
{
  constructor() {
    super();
    this.key = `email-signup-popup-${Shopify.shop.replace('.myshopify.com', '')}`;
    this.moved = true;
    this.showPopup();
  }

  disconnectedCallback() {
    if(this.onCheckboxHandler) {
      this.querySelector('.email-signup-popup__checkbox').removeEventListener('change', this.onCheckboxHandler);
    }
  }

  loadContent() {
    const delayTime = Math.max(parseInt(this.dataset.delayTime) - 500, 0);
    setTimeout(() => {
      fetch(window.Shopify.routes.root + `?section_id=${this.dataset.sectionId}&view=ajax`)
      .then((response) => response.text())
      .then((responseText) => {
        this.classList.add('loaded');
        const styles = getDomHtmlFromText(responseText, '.section-styles');
        document.body.appendChild(styles);
        setTimeout(() => {
          const content = getDomHtmlFromText(responseText, '.popup-modal__content-info');
          this.querySelector('.popup-modal__content').appendChild(content);
          this.openPopup();
          this.attachEvents();
          const checkbox = this.querySelector('.email-signup-popup__checkbox');
          if(checkbox && checkbox.checked) {
            BtStorageUtil.set(this.key, (new Date(new Date().setDate(new Date().getDate() + parseInt(this.dataset.expirationTime)))).toString());
          }
        }, 500);
      });
    }, delayTime);
  }

  showPopup() {
    let isTurnOff = false;
    const currentCookieValue = BtStorageUtil.get(this.key, false);
    if(currentCookieValue != null && currentCookieValue != '1') {
      var expirationTime = Date.parse(currentCookieValue);
      var now = (new Date()).getTime();
      if(expirationTime > now) {
        isTurnOff = true;
      }
    }
    if(!isTurnOff && !Shopify.designMode) {
      if(!this.classList.contains('loaded')) {
        this.loadContent();
      } else {
        this.openPopup();
        this.attachEvents();
      }
    }
  }

  openPopup() {
    this.show();
  }

  attachEvents() {
    this.onCheckboxHandler = this.onCheckboxChange.bind(this);
    this.querySelector('.email-signup-popup__checkbox').addEventListener('change', this.onCheckboxHandler);
  }

  onCheckboxChange(event) {
    if(event.target.checked) {
      BtStorageUtil.set(this.key, (new Date(new Date().setDate(new Date().getDate() + parseInt(this.dataset.expirationTime)))).toString());
    } else {
      BtStorageUtil.remove(this.key);
    }
  }
}

customElements.define('email-signup-popup', EmailSignUpPopup);