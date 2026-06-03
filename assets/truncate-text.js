if (!customElements.get('truncate-text')) {
  customElements.define('truncate-text', class TruncateText extends HTMLElement {
    constructor() {
      super();
      if(!this.dataset.ignore) {
        this.button = this.querySelector('.button--truncate-text-js');
        this.contentWrapper = this.querySelector('.truncate-text__content-wrapper');
        this.content = this.querySelector('.truncate-text__content');
      }
    }

    connectedCallback() {
      if(this.button) {
        this.onClickButtonHandler = this.onClickButton.bind(this);
        this.button.addEventListener('click', this.onClickButtonHandler);
        this.onResizeHandler = this.onResize.bind(this);
        window.addEventListener('resize', this.onResizeHandler);
        this.calculateHeight();
      }
    }

    disconnectedCallback() {
      this.uninstallEventListener();
    }

    uninstallEventListener() {
      if(this.uninstalled) return;
      if(this.button) {
        this.uninstalled = true;
        this.button.removeEventListener('click', this.onClickButtonHandler);
        window.removeEventListener('resize', this.onResizeHandler);
      }
    }

    onClickButton(e) {
      e.preventDefault();
      e.stopPropagation();
      this.uninstallEventListener();
      const buttonWrapper = this.button.closest('.truncate-text__button-wrapper');
      const buttonHeight = buttonWrapper.clientHeight;
      Motion.animate(buttonWrapper, {height: [`${buttonHeight}px`, '0px'], marginTop: '0px'}, {duration: 0.5, easing: `linear`}).finished.then(() => {
        buttonWrapper.remove();
      });
      Motion.animate(this.contentWrapper, { maxHeight: `${this.content.clientHeight}px` }, { duration: 0.5, easing: `cubic-bezier(.03,.93,.97,1)` }).finished.then(() => {
        this.contentWrapper.classList.add('expand');
        this.contentWrapper.removeAttribute('style');
      });
    }

    onResize() {
      this.calculateHeight();
    }

    calculateHeight() {
      if(this.contentWrapper.clientHeight < this.content.clientHeight) {
        this.button.closest('.truncate-text__button-wrapper').classList.remove('hidden');
      }
    }
  });
}