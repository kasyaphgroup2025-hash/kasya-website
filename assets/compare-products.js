class BtCompareUtil
{
  static init() {
    BtCompareUtil.key = `compare-${Shopify.shop.replace('.myshopify.com', '')}`;
    BtCompareUtil.bubbleHtmlClass = '.compare-count-bubble';
    BtCompareUtil.updateCompareBubble(true);
    BtCompareUtil.loadedContent = false;
  }

  static setCompareArray(compareArray) {
    BtStorageUtil.set(BtCompareUtil.key, compareArray);
  }

  static getCompareArray() {
    return BtStorageUtil.get(BtCompareUtil.key, true) || [];
  }

  static toggleProductToCompare(productId) {
    const currentProducts = BtCompareUtil.getCompareArray();
    if(currentProducts.includes(productId) === false) {
      currentProducts.push(productId);
      pushSuccessMessage(window.addedCompareStrings.success);
    } else {
      const index = currentProducts.indexOf(productId);
      currentProducts.splice(index, 1);
    }
    BtCompareUtil.setCompareArray(currentProducts);
    BtCompareUtil.updateCompareBubble();
    BtCompareUtil.loadedContent = false;
    BtCompareUtil.toogleEmptyWarningClass(document.querySelector('compare-popup'));
  }

  static removeCompareProduct(productId) {
    const currentProducts = BtCompareUtil.getCompareArray();
    const index = currentProducts.indexOf(productId);
    currentProducts.splice(index, 1);
    BtCompareUtil.setCompareArray(currentProducts);
    BtCompareUtil.updateCompareBubble();
  }

  static updateCompareBubble(ignoreZero = false) {
    const currentProducts = BtCompareUtil.getCompareArray();
    const total = currentProducts.length;
    if(total > 0 || !ignoreZero) {
      document.querySelectorAll(BtCompareUtil.bubbleHtmlClass).forEach(bubble => {
        bubble.textContent = total;
      });
      BtCompareUtil.updateAddedStyle(currentProducts);
    }
  }

  static updateAddedStyle(currentProducts = []) {
    let styleTag = document.getElementById('bt-compare-style');
    if(styleTag == undefined) {
      styleTag = document.createElement('style');
      styleTag.setAttribute('id', 'bt-compare-style');
      styleTag.textContent = BtCompareUtil.generateAddedCss(currentProducts);
      document.head.appendChild(styleTag);
    } else {
      styleTag.textContent = BtCompareUtil.generateAddedCss(currentProducts);
    }
  }

  static generateAddedCss(currentProducts = []) {
    let cssContent = '';
    if(currentProducts.length > 0) {
      currentProducts.forEach(productId => {
        if(cssContent != '') {
          cssContent += ',';
        }
        cssContent += `.compare-add-button[data-product-id="${productId}"] .compare-added-check`;
      });
      cssContent += '{opacity:1;}'
    }
    return cssContent;
  }

  static toogleEmptyWarningClass(popup) {
    const size = BtCompareUtil.getCompareArray().length;
    if(size > 1) {
      popup.classList.remove('empty', 'warning');
    } else if(size == 1) {
      popup.classList.remove('empty');
      popup.classList.add('warning');
    } else {
      popup.classList.remove('warning');
      popup.classList.add('empty');
    }
  }

  static recheckItemCount(updatedResults) {
    const updatedItemCount = parseInt(updatedResults.dataset.itemCount);
    const currentProducts = BtCompareUtil.getCompareArray();
    if(currentProducts.length > updatedItemCount) {
      const updatedItemIds = updatedResults.dataset.itemIds.split(',');
      currentProducts.forEach(productId => {
        if(!updatedItemIds.includes(productId)) {
          BtCompareUtil.removeCompareProduct(productId);
        }
      });
    }
  }
}

BtCompareUtil.init();

class ComparePopup extends HTMLElement
{
  constructor() {
    super();
    this.assets = document.getElementById('compare-modal-assets');
    this.results = this.querySelector('.compare-modal__results');
    this.hasAssets = false;
  }

  connectedCallback() {
    this.onSwapProductOutsideNodeHandler = this.onSwapProductOutsideNode.bind(this);
    document.addEventListener('swapProductOutsideNode', this.onSwapProductOutsideNodeHandler);
  }

  loadContent() {
    if(BtCompareUtil.loadedContent) return;
    this.classList.add('loading');
    const currentProducts = BtCompareUtil.getCompareArray();
    const newIds = [];
    currentProducts.forEach(productId => {
      newIds.push(`id:${productId}`);
    });
    const idsQuery =  newIds.join(' OR ');
    fetch(`${window.routes.search_url}?section_id=product-compare&q=${idsQuery}&type="product"`)
    .then((response) => response.text()) 
    .then(response => {
      const html = new DOMParser().parseFromString(response, 'text/html');
      const updatedResults = html.querySelector('.results');
      if(!this.hasAssets) {
        this.assets.innerHTML = html.querySelector('.assets').innerHTML;
        this.hasAssets = true;
        HTMLUpdateUtility.reinjectsScripts(this.assets);
        this.blockTypes = updatedResults.dataset.blockTypes.split(',');
      }
      
      this.results.innerHTML = updatedResults.innerHTML;
      BtCompareUtil.recheckItemCount(updatedResults);
      BtCompareUtil.toogleEmptyWarningClass(this);
    })
    .finally(() => {
      this.classList.remove('loading');
      BtCompareUtil.loadedContent = true;
    });
  }

  onSwapProductOutsideNode(event) {
    const productUrl = event.detail.productUrl;
    fetch(`${productUrl}.json`)
    .then((response) => response.json())
    .then(response => {
      const productId = response.product.id;
      const requestUrl = `${window.routes.search_url}?section_id=product-compare&q=id:${productId}&type="product"`;

      const oldSectionId = event.detail.oldSectionId;
      fetch(requestUrl)
      .then((response) => response.text()) 
      .then(response => {
        const html = new DOMParser().parseFromString(response, 'text/html');
        const newNode = html.querySelector('product-info');
        const newSectionId = newNode.dataset.section;
        const index = event.detail.index;
        this.blockTypes.forEach((blockType) => {
          this.updateSourceFromDestination(html, oldSectionId, newSectionId, index, blockType);
        });
      });
    });

    
  }

  updateSourceFromDestination(html, oldSectionId, newSectionId, index, id, shouldHide = (source) => false) {
    const source = html.getElementById(`${newSectionId}-${id}-1`);
    const destination = document.getElementById(`${oldSectionId}-${id}-${index}`);
    if (source && destination) {
      if(id == 'featured_image') {
        destination.querySelector('.compare-popup__remove-link').dataset.productId = source.querySelector('.compare-popup__remove-link').dataset.productId;
      }
      destination.innerHTML = source.innerHTML;
      destination.classList.toggle('hidden', shouldHide(source));
      destination.id = `${newSectionId}-${id}-${index}`;
      if(id == 'options') {
        HTMLUpdateUtility.reinjectsScripts(destination);
      }
      if(id == 'add_to_cart') {
        destination.querySelector('product-info').dataset.index = index;
      }
    }
  }
}

customElements.define('compare-popup', ComparePopup);

class CompareAddButton extends HTMLElement
{
  constructor() {
    super();
    this.bindEvents();
  }

  bindEvents() {
    this.button = this.querySelector('button');
    this.onButtonClickHandler = this.onButtonClick.bind(this);
    this.button.addEventListener('click', this.onButtonClickHandler);
  }

  disconnectedCallback() {
    this.button.removeEventListener('click', this.onButtonClickHandler);
  }

  onButtonClick() {
    BtCompareUtil.toggleProductToCompare(this.button.dataset.productId);
  }
}

customElements.define('compare-add-button', CompareAddButton);

class CompareRemoveButton extends HTMLElement
{
  constructor() {
    super();
    this.bindEvents();
  }

  bindEvents() {
    this.button = this.querySelector('a');
    this.onButtonClickHandler = this.onButtonClick.bind(this);
    this.button.addEventListener('click', this.onButtonClickHandler);
  }

  disconnectedCallback() {
    this.button.removeEventListener('click', this.onButtonClickHandler);
  }

  onButtonClick(e) {
    e.preventDefault();
    const popup = this.closest('compare-popup');
    BtCompareUtil.removeCompareProduct(this.button.dataset.productId);
    BtCompareUtil.toogleEmptyWarningClass(popup);
    popup.querySelectorAll(`.product-compare-${this.button.dataset.productId}`).forEach((td) => {
      td.remove();
    });
  }
}

customElements.define('compare-remove-button', CompareRemoveButton);

class CompareVariants extends HTMLElement
{
  constructor() {
    super();
    this.loadVariantPicker();
  }

  connectedCallback() {
    
  }

  loadVariantPicker() {
    fetch(`${this.dataset.url}?section_id=product-compare-item`)
    .then((response) => response.text())
    .then((responseText) => {
      const html = new DOMParser().parseFromString(responseText, 'text/html');
      const variantPicker = html.getElementById(`compare-variants-${this.dataset.section}`);
      HTMLUpdateUtility.viewTransition(this, variantPicker);
    });
  }
}

customElements.define('compare-variants', CompareVariants);