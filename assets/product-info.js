if (!customElements.get('product-info')) {
  customElements.define(
    'product-info',
    class ProductInfo extends HTMLElement {
      constructor() {
        super();
        this.input = this.querySelector('.quantity__input');
        this.currentVariant = this.querySelector('.product-variant-id');
        this.submitButton = this.querySelector('[type="submit"]');
        this.sectionId = this.dataset.originalSection || this.dataset.section;
        this.recallCounter = 0;
        this.optionSize = parseInt(this.dataset.optionSize);
        this.preProcessHtmlCallbacks = [];
        this.postProcessHtmlCallbacks = [];
      }

      connectedCallback() {
        this.initializeProductSwapUtility();
        if (this.input) {
          this.quantityForm = this.querySelector('.product-form__quantity-wrapper');
          if (this.quantityForm) {
            this.setQuantityBoundries();
            this.cartUpdateHandler = this.fetchQuantityRules.bind(this);
            document.addEventListener('afterCartChanged', this.cartUpdateHandler);
            document.addEventListener('afterUpdateQuantity', this.cartUpdateHandler);
          }
        }

        this.optionValueChangeHandler = this.handleOptionValueChange.bind(this);
        document.addEventListener('optionValueSelectionChange', this.optionValueChangeHandler);
      }

      disconnectedCallback() {
        if (this.cartUpdateHandler) {
          document.removeEventListener('afterCartChanged', this.cartUpdateHandler);
          document.removeEventListener('afterUpdateQuantity', this.cartUpdateHandler);
        }
        if (this.optionValueChangeHandler) {
          document.removeEventListener('optionValueSelectionChange', this.optionValueChangeHandler);
        }
      }

      addPreProcessCallback(callback) {
        this.preProcessHtmlCallbacks.push(callback);
      }

      initializeProductSwapUtility() {
        this.postProcessHtmlCallbacks.push((newNode) => {
          window?.Shopify?.PaymentButton?.init();
          window?.ProductModel?.loadShopifyXR();
        });
      }

      handleOptionValueChange(event) {
        if (event.detail.sectionId !== this.dataset.section || (event.detail.recallId !== undefined && (event.detail.recallId !== this.dataset.section))) return;

        this.resetProductFormState();

        const productUrl = event.detail.target.dataset.productUrl || this.pendingRequestUrl || this.dataset.url;
        this.pendingRequestUrl = productUrl;
        const shouldSwapProduct = this.dataset.url !== productUrl;
        if(shouldSwapProduct && this.dataset.hasOutsideElements) {
          document.dispatchEvent(new CustomEvent('swapProductOutsideNode', {detail: {
            oldSectionId: this.dataset.section,
            productUrl: productUrl,
            index: this.dataset.index
          }}));
          return;
        }
        const shouldFetchFullPage = this.dataset.updateUrl === 'true' && shouldSwapProduct && !this.dataset.inSticky;
        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithParams(productUrl, event.detail.selectedOptionValues, shouldFetchFullPage),
          targetId: event.detail.target.id,
          callback: shouldSwapProduct
            ? this.handleSwapProduct(productUrl, shouldFetchFullPage)
            : this.handleUpdateProductInfo(productUrl),
        });
      }

      resetProductFormState() {
        const productForm = this.productForm;
        productForm?.toggleSubmitButton(true);
        productForm?.handleErrorMessage();
      }

      handleSwapProduct(productUrl, updateFullPage) {
        return (html) => {
          this.productModal?.remove();

          const selector = updateFullPage ? "product-info[id^='MainProduct']" : (this.id ? `#${this.id}` : 'product-info');
          const variant = this.getSelectedVariant(html.querySelector(selector));
          this.updateURL(productUrl, variant?.id);

          if (updateFullPage) {
            document.querySelector('head title').innerHTML = html.querySelector('head title').innerHTML;
            HTMLUpdateUtility.viewTransition(
              document.querySelector('main'),
              html.querySelector('main'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          } else {
            HTMLUpdateUtility.viewTransition(
              this,
              html.querySelector(selector),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          }

          if(this.dataset.inSticky) {
            setTimeout(() => {
              document.querySelector("product-info[id^='MainProduct']").scrollIntoView({behavior: 'smooth'});
            }, 500);
          }
        };
      }

      renderProductInfo({ requestUrl, targetId, callback }) {
        this.abortController?.abort();
        this.abortController = new AbortController();

        fetch(requestUrl, { signal: this.abortController.signal })
          .then((response) => response.text())
          .then((responseText) => {
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            callback(html);
          })
          .then(() => {
            // set focus to last clicked option value
            document.querySelector(`#${targetId}`)?.focus();
          })
          .catch((error) => {
            this.recallCounter = 0;
            if (error.name === 'AbortError') {
              console.log('Fetch aborted by user');
            } else {
              console.error(error);
            }
          });
      }

      getSelectedVariant(productInfoNode) {
        const selectedVariant = productInfoNode.querySelector('[data-selected-variant]')?.innerHTML;
        return !!selectedVariant ? JSON.parse(selectedVariant) : null;
      }

      buildRequestUrlWithParams(url, optionValues, shouldFetchFullPage = false) {
        const params = [];

        !shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);

        if (optionValues.length) {
          params.push(`option_values=${optionValues.join(',')}`);
        }

        return `${url}?${params.join('&')}`;
      }

      updateOptionValues(html) {
        const variantSelects = html.getElementById(this.variantSelectors.id);
        if (variantSelects) {
          HTMLUpdateUtility.viewTransition(this.variantSelectors, variantSelects, this.preProcessHtmlCallbacks);
        }
      }

      handleUpdateProductInfo(productUrl) {
        return (html) => {
          const variant = this.getSelectedVariant(html);
          if(!variant && window.hideUnavailableOptions && this.recallCounter < (this.optionSize - 1)) {
            // Auto select new option for available variant
            this.recallCounter++;
            this.variantSelectors.autoCorrectAvailableVariant(html.getElementById(`ProductInfo-${this.dataset.section}`));
            return true;
          }
          this.recallCounter = 0;
          this.updateURL(productUrl, variant?.id);
          this.updateElements(variant, html);
          if(this.dataset.syncElement) {
            const syncElement = document.getElementById(this.dataset.syncElement);
            syncElement.updateElements(variant, html);
          }
        };
      }

      swapElementsOutsideProductNode(html) {
        const variant = this.getSelectedVariant(html);
        this.updateElements(variant, html, true);
      }

      updateElements(variant, html) {
        this.updateOptionValues(html);
        this.pickupAvailability?.update(variant);
        this.updateVariantInputs(variant?.id);
        
        if (!variant) {
          this.setUnavailable();
          return;
        }

        this.updateMedia(variant);
        
        const descAddButton = document.querySelector(`#product-form-${this.dataset.section} [name="add"]`);
        const sourceAddButton = html.querySelector(`#product-form-${this.dataset.section} [name="add"]`);
        if(sourceAddButton && descAddButton) {
          this.productForm.toggleSubmitButton(!variant || !variant.available, window.variantStrings.soldOut);
          const descAddButtonText = descAddButton.querySelector('[name="add"] > span');
          if(descAddButtonText) {
            if(sourceAddButton.dataset.preOrder) {
              descAddButton.dataset.preOrder = sourceAddButton.dataset.preOrder;
              descAddButtonText.textContent = sourceAddButton.querySelector('[name="add"] > span').textContent;
            } else {
              descAddButton.removeAttribute('data-pre-order');
              if(variant && variant.available) {
                descAddButtonText.textContent = sourceAddButton.querySelector('[name="add"] > span').textContent;
              }
            }
          }
        }
        
        this.updateSourceFromDestination(html, 'Volume');
        this.updateSourceFromDestination(html, 'Volume-Note');
        this.updateSourceFromDestination(html, 'Featured-Media');
        this.updateSourceFromDestination(html, 'price');
        this.updateSourceFromDestination(html, 'price-top');

        const inventoryDestination = document.querySelectorAll(`.inventory-${this.dataset.section}`);
        const inventorySource = html.querySelector(`.inventory-${this.dataset.section}`);
        if (inventorySource && inventoryDestination) {
          inventoryDestination.forEach((invDesc, index) => {
            invDesc.innerHTML = inventorySource.innerHTML;
          })
        }

        // Update sku

        const skuDestination = document.querySelectorAll(`.sku-${this.dataset.section}`);
        const skuSource = html.querySelector(`.sku-${this.dataset.section}`);
        if (skuSource && skuDestination) {
          skuDestination.forEach((skuDesc, index) => {
            skuDesc.innerHTML = skuSource.innerHTML;
            skuDesc.parentElement.classList.toggle('hidden', skuSource.parentElement.classList.contains('hidden'));
          })
        }

        // Update barcode

        const barcodeDestination = document.querySelectorAll(
          `.barcode-${this.dataset.section}`
        );
        const barcodeSource = html.querySelector(
          `.barcode-${this.dataset.section}`
        );
        if (barcodeSource && barcodeDestination) {
          barcodeDestination.forEach((barcodeDesc, index) => {
            barcodeDesc.innerHTML = barcodeSource.innerHTML;
            barcodeDesc.parentElement.classList.toggle(
              "hidden",
              barcodeSource.parentElement.classList.contains("hidden")
            );
          });
        }

        this.updateQuantityRules(this.dataset.section, html);
        this.setQuantityBoundries();
        this.querySelector(`#Quantity-Rules-${this.dataset.section}`)?.classList.remove('hidden');
        this.querySelector(`#Volume-Note-${this.dataset.section}`)?.classList.remove('hidden');
        document.dispatchEvent(new CustomEvent('afterVariantChanged', {detail: {
          sectionId: this.dataset.section,
          html,
          variant,
        }}));
      }

      updateSourceFromDestination(html, id) {
        const source = html.getElementById(`${id}-${this.dataset.section}`);
        const destination = document.getElementById(`${id}-${this.dataset.section}`);
        if (source && destination) {
          destination.innerHTML = source.innerHTML;
          destination.classList.remove('hidden');
        }
      }

      updateVariantInputs(variantId) {
        this.querySelectorAll(
          `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
        ).forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"]');
          input.value = variantId ?? '';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        this.currentVariant = this.querySelector('.product-variant-id');
      }

      updateURL(url, variantId) {
        this.querySelector('share-button')?.updateUrl(
          `${window.shopUrl}${url}${variantId ? `?variant=${variantId}` : ''}`
        );

        if (this.dataset.updateUrl === 'false') return;
        window.history.replaceState({}, '', `${url}${variantId ? `?variant=${variantId}` : ''}`);
      }

      setUnavailable() {
        this.productForm?.toggleSubmitButton(true, window.variantStrings.unavailable);

        const selectors = ['price', 'price-top','Inventory', 'Volume-Note', 'Volume', 'Quantity-Rules']
          .map((id) => `#${id}-${this.dataset.section}`)
          .join(', ');
        document.querySelectorAll(selectors).forEach(({ classList }) => classList.add('hidden'));
      }

      updateMedia(variant) {
        if (!variant) return;
        if (!variant.featured_media) return;
    
        const mediaGalleries = document.querySelectorAll(`[id^="MediaGallery-${this.dataset.section}"]`);
        mediaGalleries.forEach(mediaGallery => mediaGallery.setActiveMedia(`${this.dataset.section}-${variant.featured_media.id}`, true));
    
        const modalContent = document.querySelector(`#ProductModal-${this.dataset.section} .product-media-modal__content`);
        if (!modalContent) return;
        const newMediaModal = modalContent.querySelector( `[data-media-id="${variant.featured_media.id}"]`);
        modalContent.prepend(newMediaModal);
      }

      setQuantityBoundries() {
        if(!this.input) {
          return;
        }
        const data = {
          cartQuantity: this.input.dataset.cartQuantity ? parseInt(this.input.dataset.cartQuantity) : 0,
          min: this.input.dataset.min ? parseInt(this.input.dataset.min) : 1,
          max: this.input.dataset.max ? parseInt(this.input.dataset.max) : null,
          step: this.input.step ? parseInt(this.input.step) : 1,
        };

        let min = data.min;
        const max = data.max === null ? data.max : data.max - data.cartQuantity;
        if (max !== null) min = Math.min(min, max);
        if (data.cartQuantity >= data.min) min = Math.min(min, data.step);
        this.input.min = min;

        if (max) {
          this.input.max = max;
        } else {
          this.input.removeAttribute('max');
        }
        this.input.value = min;

        document.dispatchEvent(new CustomEvent('afterQuantityUpdate'));
      }

      fetchQuantityRules() {
        if (!this.currentVariant || !this.currentVariant.value) return;
        const quantityLabelLoading = this.querySelector('.quantity__label__loading');
        quantityLabelLoading?.classList.remove('hidden');
        fetch(`${this.dataset.url}?variant=${this.currentVariant.value}&section_id=${this.sectionId}`)
          .then((response) => {
            return response.text();
          })
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            this.updateQuantityRules(this.dataset.section, html);
            this.setQuantityBoundries();
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.querySelector('.quantity__label__loading')?.classList.add('hidden');
          });;
      }

      updateQuantityRules(sectionId, html) {
        if(!this.quantityForm) return;
        const quantityFormUpdated = html.getElementById(`Quantity-Form-${sectionId}`);
        const selectors = ['.quantity__input', '.quantity__rules', '.quantity__label'];
        if(quantityFormUpdated.classList.contains('product-form__wholesale')) {
          if(!this.quantityForm.classList.contains('product-form__wholesale')) {
            this.quantityForm.classList.add('product-form__wholesale');
          }
        } else if(this.quantityForm.classList.contains('product-form__wholesale')) {
          this.quantityForm.classList.remove('product-form__wholesale');
        }
        for (let selector of selectors) {
          const current = this.quantityForm.querySelector(selector);
          const updated = quantityFormUpdated.querySelector(selector);
          if (!current || !updated) continue;
          if (selector === '.quantity__input') {
            const attributes = ['data-cart-quantity', 'data-min', 'data-max', 'step'];
            for (let attribute of attributes) {
              const valueUpdated = updated.getAttribute(attribute);
              if (valueUpdated !== null) {
                current.setAttribute(attribute, valueUpdated);
              } else {
                current.removeAttribute(attribute);
              }
            }
          } else {
            current.innerHTML = updated.innerHTML;
          }
        }
      }

      get productForm() {
        return this.querySelector(`product-form`);
      }

      get variantSelectors() {
        return this.querySelector('variant-selects,variant-radios') || document.getElementById(`variant-select-${this.dataset.section}`);
      }

      get pickupAvailability() {
        return this.querySelector(`pickup-availability`);
      }
    }
  );
}
