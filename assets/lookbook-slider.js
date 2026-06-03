if (!customElements.get('lookbook-slider')) {
  customElements.define('lookbook-slider', class LookbookSlider extends HTMLElement {
    constructor() {
      super();

      this.triggers = this.querySelectorAll('.lookbook__hotspot__trigger');
      this.sliderComponent = this.querySelector('slider-component');
    }

    connectedCallback() {
      this.onTriggerClickHandler = this.onTriggerClick.bind(this);
      this.triggers.forEach((trigger) => {
        trigger.addEventListener('click', this.onTriggerClickHandler);
      });
      
      this.onSlideChangedHandler = this.onSlideChanged.bind(this);
      this.sliderComponent.addEventListener('slideChanged', this.onSlideChangedHandler);
    }

    disconnectedCallback() {
      this.triggers.forEach((trigger) => {
        trigger.removeEventListener('click', this.onTriggerClickHandler);
      });

      this.sliderComponent.removeEventListener('slideChanged', this.onSlideChangedHandler);
    }

    onTriggerClick(event) {
      this.openProductTarget(event.target);
    }

    openProductTarget(target) {
      if(!target.classList.contains('active')) {
        const targetIndex = target.dataset.index;
        this.sliderComponent.goToSlideByTarget(this.sliderComponent.sliderControlButtons[targetIndex]);
      }
    }

    onSlideChanged(event) {
      const currentPage = event.detail.currentPage - 1;
      this.triggers.forEach((trigger) => {
        trigger.classList.remove('active');
      });
      this.triggers[currentPage].classList.add('active');
    }
  });
}