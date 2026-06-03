if (!customElements.get('discount-code')) {
  customElements.define('discount-code', class DiscountCode extends HTMLElement {
    constructor() {
      super();
      this.button = this.querySelector('button');
    }

    connectedCallback() {
      if(this.button) {
        this.onButtonClickHandler = this.onButtonClick.bind(this);
        this.button.addEventListener('click', this.onButtonClickHandler);
      }
    }

    disconnectedCallback() {
      if(this.button) {
        this.button.removeEventListener('click', this.onButtonClickHandler);
      }
    }

    handleCopied() {
      pushSuccessMessage(this.dataset.message);
    }

    onButtonClick(evt) {
      if (navigator.clipboard?.writeText && window.isSecureContext && window.self === window.top) {
        navigator.clipboard.writeText(this.dataset.code).then(
          () => {
            /* clipboard successfully set */
            this.handleCopied();
          },
          (error) => {
            /* clipboard write failed */
            this.fallbackCopyTextToClipboard(this.dataset.code);
          },
        );
      } else {
        this.fallbackCopyTextToClipboard(this.dataset.code);
      }
    }

    fallbackCopyTextToClipboard(text) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed"; // avoid scrolling to bottom
      textarea.style.left = '-999px';
      textarea.style.opacity = 0;
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      let successful;
      try {
        successful = document.execCommand("copy");
        this.handleCopied();
      } catch (err) {
        console.log(err);
      }
    
      document.body.removeChild(textarea);
      return successful;
    }
  });
}