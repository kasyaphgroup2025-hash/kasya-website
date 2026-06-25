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
      const isDiscountedSummerQuickShop = this.dataset.discountedSummerQuickShop === 'true' || this.button.dataset.discountedSummerQuickShop === 'true';
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
        if (isDiscountedSummerQuickShop) {
          newQuickAddDrawer.dataset.discountedSummerQuickShop = 'true';
        }
        if(window.hasQuickAddDrawer) {
          const quickAddDrawer = document.querySelector('quick-add-drawer');
          quickAddDrawer.dataset.discountedSummerQuickShop = isDiscountedSummerQuickShop ? 'true' : '';
          quickAddDrawer.setInnerHTML(newQuickAddDrawer);
          if (isDiscountedSummerQuickShop) {
            quickAddDrawer.applyDiscountedSummerQuickShop();
          } else {
            quickAddDrawer.resetDiscountedSummerQuickShop();
          }
          quickAddDrawer.open(this.button);
        } else {
          document.body.appendChild(newQuickAddDrawer);
          HTMLUpdateUtility.reinjectsScripts(document.querySelector('quick-add-drawer'));
          newQuickAddDrawer.runAfterUpdateHtml();
          if (isDiscountedSummerQuickShop) newQuickAddDrawer.applyDiscountedSummerQuickShop();
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
      this.defaultHeading = this.querySelector('.drawer__heading')?.textContent;
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

    applyDiscountedSummerQuickShop() {
      try {
        this.prepareDiscountedSummerQuickShop();
      } catch (error) {
        console.error('Discounted Summer Quick Shop setup failed', error);
      }
    }

    prepareDiscountedSummerQuickShop() {
      // Discounted Summer Collection-specific behavior starts.
      this.discountedSummerQuickShopCleanup?.();

      const drawerHeading = this.querySelector('.drawer__heading');
      if (drawerHeading) {
        drawerHeading.textContent = 'CHOOSE SIZE & COLOR';
        drawerHeading.style.color = 'red';
        drawerHeading.style.fontWeight = '700';
        drawerHeading.style.textTransform = 'uppercase';
      }

      const productInfo = this.querySelector('product-info');
      const variantPicker = productInfo?.querySelector('variant-radios, variant-selects');
      const productForm = productInfo?.querySelector('product-form');
      const form = productForm?.querySelector('form');
      const submitButton = productForm?.querySelector('[type="submit"]');
      const dynamicCheckout = form?.querySelector('.shopify-payment-button');
      const variantInput = productForm?.querySelector('input[name="id"]');
      const selectedVariantScript = productInfo?.querySelector('[data-selected-variant]');
      if (!productInfo || !variantPicker || !productForm || !form || !submitButton || !variantInput) return;

      const optionGroups = Array.from(variantPicker.querySelectorAll('.product-form__input--variant-picker')).map((group) => {
        const legendText = group.querySelector('legend, .form__label')?.textContent || '';
        const inputName = group.querySelector('input[type="radio"], select')?.getAttribute('name') || '';
        return {
          group,
          normalizedName: `${legendText} ${inputName}`.toLowerCase(),
        };
      });
      const sizeGroups = optionGroups.filter(({ normalizedName }) => normalizedName.includes('size'));
      const colorGroups = optionGroups.filter(({ normalizedName }) => normalizedName.includes('color') || normalizedName.includes('colour'));
      const requiredOptionGroups = [
        ...sizeGroups.map((optionGroup) => ({ ...optionGroup, neutralText: 'Please select' })),
        ...colorGroups.map((optionGroup) => ({ ...optionGroup, neutralText: 'Please select' })),
      ];
      const requiredGroups = requiredOptionGroups.map(({ group }) => group);

      if (!sizeGroups.length || !colorGroups.length) return;

      const disableSubmit = (text) => {
        submitButton.setAttribute('disabled', 'disabled');
        submitButton.setAttribute('aria-disabled', 'true');
        if (text && productForm.submitButtonText) productForm.submitButtonText.textContent = text;
      };

      const setDynamicCheckoutDisabled = (disabled = true) => {
        if (!dynamicCheckout) return;
        dynamicCheckout.querySelectorAll('button, input, [role="button"]').forEach((button) => {
          button.toggleAttribute('disabled', disabled);
          button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
          button.classList.toggle('disabled', disabled);
        });
        dynamicCheckout.classList.toggle('disabled', disabled);
        dynamicCheckout.style.pointerEvents = disabled ? 'none' : '';
        dynamicCheckout.style.opacity = disabled ? '0.5' : '';
      };

      const clearVariantInput = () => {
        variantInput.value = '';
        if (selectedVariantScript) selectedVariantScript.textContent = '';
        variantInput.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const groupHasSelection = (group) => {
        const selectedRadio = group.querySelector('input[type="radio"]:checked');
        const select = group.querySelector('select');
        return Boolean(selectedRadio || (select && select.value));
      };

      const hasRequiredSelections = () => requiredGroups.every(groupHasSelection);

      const resetRequiredSelections = () => {
        requiredOptionGroups.forEach(({ group, neutralText }) => {
          group.querySelectorAll('input[type="radio"]:checked').forEach((radio) => {
            radio.checked = false;
            radio.removeAttribute('checked');
          });
          const select = group.querySelector('select');
          if (select) {
            select.selectedIndex = -1;
            select.querySelectorAll('option[selected]').forEach((option) => option.removeAttribute('selected'));
          }
          group.querySelectorAll('.selected, .active, .is-active, .checked').forEach((element) => {
            element.classList.remove('selected', 'active', 'is-active', 'checked');
            element.removeAttribute('aria-current');
            element.removeAttribute('aria-selected');
            element.removeAttribute('aria-pressed');
          });
          const selectedLabel = group.querySelector('.product-form__input__option-value');
          if (selectedLabel) selectedLabel.textContent = neutralText;
        });
        clearVariantInput();
        disableSubmit();
        setDynamicCheckoutDisabled(true);
      };

      const onPickerChange = (event) => {
        if (hasRequiredSelections()) {
          disableSubmit();
          setDynamicCheckoutDisabled(true);
          return;
        }
        event.stopPropagation();
        clearVariantInput();
        disableSubmit();
        setDynamicCheckoutDisabled(true);
      };

      const onFormSubmit = (event) => {
        if (hasRequiredSelections()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        resetRequiredSelections();
      };

      const onVariantChanged = (event) => {
        if (event.detail.sectionId !== productInfo.dataset.section || !hasRequiredSelections()) return;
        if (event.detail.variant?.available) {
          submitButton.removeAttribute('disabled');
          submitButton.removeAttribute('aria-disabled');
          setDynamicCheckoutDisabled(false);
          if (productForm.submitButtonText) productForm.submitButtonText.textContent = window.variantStrings.addToCart;
        } else {
          disableSubmit(window.variantStrings.soldOut);
          setDynamicCheckoutDisabled(true);
        }
      };

      variantPicker.addEventListener('change', onPickerChange, true);
      form.addEventListener('submit', onFormSubmit, true);
      document.addEventListener('afterVariantChanged', onVariantChanged);
      this.discountedSummerQuickShopCleanup = () => {
        variantPicker.removeEventListener('change', onPickerChange, true);
        form.removeEventListener('submit', onFormSubmit, true);
        document.removeEventListener('afterVariantChanged', onVariantChanged);
      };
      resetRequiredSelections();
      requestAnimationFrame(resetRequiredSelections);
      setTimeout(resetRequiredSelections, 75);
      // Discounted Summer Collection-specific behavior ends.
    }

    resetDiscountedSummerQuickShop() {
      this.discountedSummerQuickShopCleanup?.();
      this.discountedSummerQuickShopCleanup = null;
      const drawerHeading = this.querySelector('.drawer__heading');
      if (drawerHeading && this.defaultHeading) {
        drawerHeading.textContent = this.defaultHeading;
        drawerHeading.style.color = '';
        drawerHeading.style.fontWeight = '';
        drawerHeading.style.textTransform = '';
      }
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
