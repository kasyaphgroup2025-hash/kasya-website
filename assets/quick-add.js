if (!customElements.get('quick-add-drawer-opener')) {
  customElements.define('quick-add-drawer-opener', class QuickAddDrawerOpener extends HTMLElement {
    constructor() {
      super();

      this.button = this.querySelector('button');
      this.onClickHandler = this.onClick.bind(this);
      this.button.addEventListener('click', this.onClickHandler);
    }

    disconnectedCallback() {
      this.button.removeEventListener('click', this.onClickHandler);
    }

    onClick(e) {
      this.button.setAttribute('aria-disabled', true);
      this.button.classList.add('loading');
      this.button.querySelector('.loading-overlay__spinner').classList.remove('hidden');
      let url = this.button.dataset.productUrl;
      if(url.includes('?')) {
        url += '&';
      } else {
        url += '?';
      }
      url += 'section_id=quick-add-drawer';
      fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        const newQuickAddDrawer = getDomHtmlFromText(responseText, 'quick-add-drawer');
        if(window.hasQuickAddDrawer) {
          const quickAddDrawer = document.querySelector('quick-add-drawer');
          quickAddDrawer.setInnerHTML(newQuickAddDrawer);
          quickAddDrawer.open(this.button);
        } else {
          document.body.appendChild(newQuickAddDrawer);
          HTMLUpdateUtility.reinjectsScripts(document.querySelector('quick-add-drawer'));
          newQuickAddDrawer.runAfterUpdateHtml();
          setTimeout(() => {
            newQuickAddDrawer.open(this.button);
          }, 300);
          window.hasQuickAddDrawer = true;
        }      
      })
      .finally(() => {
        this.button.removeAttribute('aria-disabled');
        this.button.classList.remove('loading');
        this.button.querySelector('.loading-overlay__spinner').classList.add('hidden');
      });
    }
  });
}
if (!customElements.get('quick-add-drawer')) {
  customElements.define('quick-add-drawer', class QuickAddDrawer extends DrawerFixed {
    constructor() {
      super();

      this.querySelector('.drawer__overlay').addEventListener('click', this.close.bind(this));
      this.postProcessHtmlCallbacks = [];
    }

    connectedCallback() {
      this.initializeCallbackUtility();
    }

    close(evt) {
      this.classList.remove('open-content');
      super.close(evt);
      setTimeout(() => {
        this.productElement.innerHTML = '';
      }, 300);
    }

    open(opener) {
      this.assignProductElement();
      super.open(opener);
      setTimeout(() => {
        this.classList.add('open-content');
      }, 300);
    }

    initializeCallbackUtility() {
      this.postProcessHtmlCallbacks.push((newNode) => {
        this.runAfterUpdateHtml();
      });
    }

    runAfterUpdateHtml() {
      this.productElement = this.querySelector('.quick-add-main-product');
      window?.Shopify?.PaymentButton?.init();
      window?.ProductModel?.loadShopifyXR();
      this.removeDOMElements();
      this.removeGalleryListSemantic();
    }

    assignProductElement() {
      if(!this.productElement || !this.productElement.parentNode) {
        this.productElement = this.querySelector('.quick-add-main-product');
      }
    }

    setInnerHTML(newQuickAddDrawer) {
      this.assignProductElement();
      const newProductElement = newQuickAddDrawer.querySelector('.quick-add-main-product');
      HTMLUpdateUtility.viewTransition(this.productElement, newProductElement, [], this.postProcessHtmlCallbacks);
    }

    reInjectScript(element) {
      HTMLUpdateUtility.reinjectsScripts(element);
    }
    
    removeDOMElements() {
      this.productElement.querySelectorAll('.quick-add-hidden').forEach(element => {
        if(element) {
          element.remove();
        }
      });
    }

    removeGalleryListSemantic() {
      const galleryList = this.productElement.querySelector('[id^="Slider-Gallery"]');
      if (!galleryList) return;

      galleryList.setAttribute('role', 'presentation');
      galleryList.querySelectorAll('[id^="Slide-"]').forEach(li => li.setAttribute('role', 'presentation'));
    }
  });
}
