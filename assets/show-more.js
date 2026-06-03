if (!customElements.get('show-more-button')) {
  customElements.define('show-more-button', class ShowMoreButton extends HTMLElement {
    constructor() {
      super();
      const button = this.querySelector('button');
      button.addEventListener('click', (event) => {
        this.expandShowMore(event);
        const nextElementToFocus = event.target.closest('.parent-display').querySelector('.show-more-item')
        if (nextElementToFocus && !nextElementToFocus.classList.contains('hidden')) {
          const input = nextElementToFocus.querySelector('input');
          if(input) {
            input.focus();
          }
        }
        if(this.dataset.onetime) {
          this.classList.add('hidden');
        }
      });
    }
    expandShowMore(event) {
      const parentDisplay = event.target.closest('[id^="Show-More-"]').closest('.parent-display');
      this.querySelectorAll('.label-text').forEach(element => element.classList.toggle('hidden'));
      parentDisplay.querySelectorAll('.show-more-item').forEach(item => item.classList.toggle('hidden'))
    }
  });
}