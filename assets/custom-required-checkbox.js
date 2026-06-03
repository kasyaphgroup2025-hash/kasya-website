if (!customElements.get('custom-required-checkbox')) {
  customElements.define('custom-required-checkbox', class CustomRequiredCheckbox extends HTMLElement {
    constructor() {
      super();

      this.checkbox = this.querySelector('input[type="checkbox"]');

      if(this.dataset.errorMessage) {
        this.checkbox.setCustomValidity(this.dataset.errorMessage);
      }

      this.onChangeHandler = this.onChange.bind(this);
      this.checkbox.addEventListener('change', this.onChangeHandler);
    }

    disconnectedCallback() {
      this.checkbox.removeEventListener('change', this.onChangeHandler);
    }

    onChange() {
      this.checkbox.setCustomValidity(this.checkbox.validity.valueMissing ? this.dataset.errorMessage : "");
    }
  });
}