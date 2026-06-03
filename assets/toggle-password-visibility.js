if(!customElements.get('toggle-password-visibility')) {
  customElements.define('toggle-password-visibility', class TogglePasswordVisibility extends HTMLElement {
    constructor() {
      super();
      if(!this.dataset.ignore) {
        this.passwordField = this.querySelector('input');
        this.button = this.querySelector('button');
      }
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

    onButtonClick() {
      const passwordFieldType = this.passwordField.getAttribute('type');
      if (passwordFieldType === 'password') {
        this.passwordField.setAttribute('type', 'text');
        this.button.ariaLabel = window.accessibilityStrings.passwordVisibilityHide;
      } else {
        this.passwordField.setAttribute('type', 'password');
        this.button.ariaLabel = window.accessibilityStrings.passwordVisibilityShow;
      }
      this.passwordField.focus();
    }
  });
}