if (!customElements.get('scrolling-text')) {
  customElements.define('scrolling-text', class ScrollingText extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.stop = Motion.inView(this, (info) => {
        this.#duplicateItems();
        this.runAnimation();
      });
    }

    disconnectedCallback() {
      if(this.stop) {
        this.stop();
      }
    }

    runAnimation() {
      setTimeout(() => {
        this.classList.add('enable-animation');
      }, 500);
    }

    #duplicateItems() {
      const items = this.querySelectorAll('.scrolling-text__li');
      if(items.length > 0) {
        const repeatedList = this.querySelector('.scrolling-text__list--repeated');
        items.forEach(item => {
          repeatedList.appendChild(this.#cloneItem(item));
        });
        if(items.length == 1) {
          this.querySelector('.scrolling-text__list--original').appendChild(this.#cloneItem(items[0]));
          repeatedList.appendChild(this.#cloneItem(items[0]));
        }
      }
    }

    #cloneItem(item) {
      const clonedItem = item.cloneNode(true);
      if(Shopify.designMode) {
        clonedItem.removeAttribute('data-shopify-editor-block');
      }
      return clonedItem;
    }
  });
}