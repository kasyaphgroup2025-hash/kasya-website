class DetailsModal extends HTMLElement {
  constructor() {
    super();
    this.detailsContainer = this.querySelector('details');
    this.summaryToggle = this.querySelector('summary');
    this.overlay = this.querySelector('.details-modal-overlay');

    this.detailsContainer.addEventListener(
      'keyup',
      (event) => (event.code) ? event.code.toUpperCase() === 'ESCAPE' && this.close() : ''
    );
    this.summaryToggle.addEventListener(
      'click',
      this.onSummaryClick.bind(this)
    );
    this.querySelector('.modal__close-button').addEventListener(
      'click',
      this.close.bind(this)
    );
    if(this.overlay) {
      this.overlay.addEventListener(
        'click',
        this.close.bind(this)
      );
    }
    this.summaryToggle.setAttribute('role', 'button');
  }

  isOpen() {
    return this.detailsContainer.hasAttribute('open');
  }

  onSummaryClick(event) {
    event.preventDefault();
    event.target.closest('details').hasAttribute('open')
      ? this.close()
      : this.open(event);
  }

  open(event) {
    if(event) {
      event.target.closest('details').setAttribute('open', true);
    }
    
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);

    trapFocus(
      this.detailsContainer.querySelector('[tabindex="-1"]'),
      this.detailsContainer.querySelector('input:not([type="hidden"])')
    );
  }

  close(focusToggle = true) {
    removeTrapFocus(focusToggle ? this.summaryToggle : null);
    this.detailsContainer.removeAttribute('open');
    document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
  }
}

customElements.define('details-modal', DetailsModal);