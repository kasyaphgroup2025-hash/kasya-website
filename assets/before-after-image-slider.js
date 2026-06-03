if (!customElements.get('before-after-image-slider')) {
  customElements.define('before-after-image-slider', class BeforeAfterImageSlider extends HTMLElement {
    constructor() {
      super();
      this.range = this.querySelector('.ba-image-slider__drag-slider');
    }

    connectedCallback() {
      this.onRangeChangeHandler = this.onRangeChange.bind(this);
      this.range.addEventListener('input', this.onRangeChangeHandler);
    }

    disconnectedCallback() {
      this.range.removeEventListener('input', this.onRangeChangeHandler);
    }

    onRangeChange(e) {
      this.style.setProperty('--drag-position', `${e.target.value}%`);
    }
  })
}