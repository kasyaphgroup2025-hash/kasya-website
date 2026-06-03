if (!customElements.get('quick-view-modal-opener')) {
    customElements.define('quick-view-modal-opener', class QuickViewModalOpener extends HTMLElement {
      constructor() {
        super();
        this.button = this.querySelector('button');
        this.onButtonClickHandler = this.onButtonClick.bind(this);
        if(this.button) {
          this.button.addEventListener('click', this.onButtonClickHandler);
        }
      }
  
      onButtonClick() {
        if(!window.hasQuickViewModal) {
          window.hasQuickViewModal = true;
          this.button.setAttribute('aria-disabled', true);
          this.button.classList.add('loading');
          this.button.querySelector('.loading-overlay__spinner').classList.remove('hidden');
          fetch(`${Shopify.routes.root}?section_id=quick-view-modal`)
            .then((response) => response.text())
            .then((responseText) => {
              document.body.appendChild(getDomHtmlFromText(responseText, '.quick-view-modal'));
              const modal = document.querySelector(this.dataset.modal);
              if (modal) modal.show(this.button);
              HTMLUpdateUtility.reinjectsScripts(document.getElementById('QuickView-Modal'));
            });
        } else {
          const modal = document.querySelector(this.dataset.modal);
          modal.modalContent.innerHTML = '';
          if (modal) modal.show(this.button);
        }
      }

      disconnectedCallback() {
        if(this.button) {
          this.button.removeEventListener('click', this.onButtonClickHandler);
        }
      }
    });
  }
  if (!customElements.get('quick-view-modal')) {
    customElements.define('quick-view-modal', class QuickViewModal extends ModalDialog {
      constructor() {
        super();
        this.modalContent = this.querySelector('[id^="QuickViewInfo-"]');
        this.moved = true;
      }
  
      hide(preventFocus = false) {
        this.classList.remove('open-content');
        setTimeout(() => {
          if (preventFocus) this.openedBy = null;
          super.hide();
          setTimeout(() => {
            this.modalContent.innerHTML = '';
          }, 500);
        }, 300);
      }
  
      show(opener) {
        opener.setAttribute('aria-disabled', true);
        opener.classList.add('loading');
        opener.querySelector('.loading-overlay__spinner').classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
  
        let url = opener.dataset.productUrl;
        if(url.includes('?')) {
          url += '&';
        } else {
          url += '?';
        }
        url += 'section_id=quick-view';
        fetch(url)
          .then((response) => response.text())
          .then((responseText) => {
            const responseHTML = new DOMParser().parseFromString(responseText, 'text/html');
            this.productElement = responseHTML.querySelector('product-info[id^="ProductQuickView-"]');
            this.productElement.classList.remove('hidden');
            HTMLUpdateUtility.setInnerHTML(this.modalContent, this.productElement.outerHTML);
            
            window?.Shopify?.PaymentButton?.init();
            window?.ProductModel?.loadShopifyXR();
  
            this.removeGalleryListSemantic();
            this.updateImageSizes();
            this.preventVariantURLSwitching();
            super.show(opener);
            setTimeout(() => {
              this.classList.add('open-content');
            }, 300);
            if(window.recentlyViewedStrings) {
              BtRecentlyViewedUtil.addProduct(this.productElement.dataset.productId, this.productElement.dataset.productUrl, this.productElement.dataset.productImage);
            }
          })
          .finally(() => {
            opener.removeAttribute('aria-disabled');
            opener.classList.remove('loading');
            opener.querySelector('.loading-overlay__spinner').classList.add('hidden');
          });
      }
  
      preventVariantURLSwitching() {
        const variantPicker = this.modalContent.querySelector('variant-radios,variant-selects');
        if(variantPicker) {
          variantPicker.setAttribute('data-update-url', 'false');
        }
      }
  
      removeGalleryListSemantic() {
        const galleryList = this.modalContent.querySelector('[id^="Slider-Gallery"]');
        if (!galleryList) return;
  
        galleryList.setAttribute('role', 'presentation');
        galleryList.querySelectorAll('[id^="Slide-"]').forEach(li => li.setAttribute('role', 'presentation'));
      }
      updateImageSizes() {
        const product = this.modalContent.querySelector('.product');
        const desktopColumns = product.classList.contains('product--columns');
        if (!desktopColumns) return;
        const mediaImages = product.querySelectorAll('.product__media img');
        if (!mediaImages.length) return;
        let mediaImageSizes = '(min-width: 1000px) 715px, (min-width: 750px) calc((100vw - 11.5rem) / 2), calc(100vw - 4rem)';
        if (product.classList.contains('product--medium')) {
          mediaImageSizes = mediaImageSizes.replace('715px', '605px');
        } else if (product.classList.contains('product--small')) {
          mediaImageSizes = mediaImageSizes.replace('715px', '495px');
        }
        mediaImages.forEach(img => img.setAttribute('sizes', mediaImageSizes));
      }
    });
  }
  