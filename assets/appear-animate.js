if (!customElements.get('appear-animate-single')) {
  class AppearAnimateSingle extends HTMLElement {
    constructor() {
      super();
    }
  
    connectedCallback() {
      if (!window.appearAnimate && this.dataset.force == undefined) return;
      Motion.inView(this, (info) => {
        this.showElement()
      });
    }

    showElement() {
      if(!this.dataset.immediate) {
        setTimeout(() => this.classList.add('appear'), 500);
      } else {
        this.classList.add('appear');
      }
    }
  };
  
  customElements.define('appear-animate-single', AppearAnimateSingle);
}

if (!customElements.get('appear-animate-list')) {
  class AppearAnimateList extends HTMLElement {
    constructor() {
      super();
    }
  
    connectedCallback() {
      if(!window.appearAnimate) return;
      this.delay = this.dataset.delay ? parseFloat(this.dataset.delay): 0.1;
      this.items = this.querySelectorAll('.appear-animate-item-in-list');
      Motion.inView(this, (info) => {
        this.classList.add('start');
        this.showElements();
      });
    }

    showElements() {
      Motion.animate(this.items, { transform: 'translateY(0)', opacity: 1 }, { delay: Motion.stagger(this.delay), duration: 0.5, easing: `cubic-bezier(.03,.93,.97,1)` }).finished.then(() => {
        this.items.forEach(item => {
          item.classList.add('done');
          setTimeout(() => item.removeAttribute('style'), 100);
        });
      });
    }

    reset() {
      if(!window.appearAnimate) return;
      this.items = this.querySelectorAll('.appear-animate-item-in-list:not(.done)');
      this.showElements();
    }
  };
  
  customElements.define('appear-animate-list', AppearAnimateList);
}