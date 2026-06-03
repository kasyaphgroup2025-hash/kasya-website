if (!customElements.get('product-attributes-table')) {
  customElements.define('product-attributes-table', class ProductAttributesTable extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.requireVariantUpdate = this.querySelectorAll('.require-variant-update').length > 0;
      if(this.requireVariantUpdate) {
        this.mainProductSectionId = this.getMainProductSectionId();
        this.onVariantChangeHandler = this.onVariantChange.bind(this);
        document.addEventListener('afterVariantChanged', this.onVariantChangeHandler);
      }
    }

    disconnectedCallback() {
      if(this.requireVariantUpdate) {
        document.removeEventListener('afterVariantChanged', this.onVariantChangeHandler);
      }
    }

    getMainProductSectionId() {
      const mainProductElement = document.querySelector('[id^="MainProduct"]');
      return mainProductElement ? mainProductElement.dataset.section : null;
    }

    onVariantChange(e) {
      if (e.detail.sectionId !== this.mainProductSectionId) return;
      this.updateAttributesTable(e.detail.variant.id);
    }

    updateAttributesTable(variantId) {
      const sectionId = this.dataset.originalSection || this.dataset.section;
      const url = `${this.dataset.url}?variant=${variantId}&section_id=${sectionId}`;
      
      fetch(url)
        .then(response => response.text())
        .then(responseText => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const newContent = html.querySelector('product-attributes-table');
          if (newContent) {
            this.innerHTML = newContent.innerHTML;
          }
        });
    }
  });
}