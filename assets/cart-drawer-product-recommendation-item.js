if (!customElements.get("cart-drawer-product-recommendation-item")) {
  customElements.define(
    "cart-drawer-product-recommendation-item",
    class CartDrawerProductRecommendationItem extends HTMLElement {
      constructor() {
        super();
        this.addEventListener("change", this.onVariantChange);
      }

      onVariantChange(event) {
        const select = this.querySelector(
          ".cart-drawer__recommendation-item__select"
        );
        const variantId = select.value;
        fetch(
          `${this.dataset.productUrl}?variant=${variantId}&section_id=cart-drawer-product-recommendation-item`
        )
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(
              responseText,
              "text/html"
            );
            const priceDestination = this.querySelector(
              `.cart-drawer__recommendation-item__price`
            );
            const priceSource = html.querySelector(
              `.cart-drawer__recommendation-item__price`
            );

            if (priceSource && priceDestination)
              priceDestination.innerHTML = priceSource.innerHTML;

            const imageDestination = this.querySelector(
              `.cart-drawer__recommendation-item__info--image`
            );
            const imageSource = html.querySelector(
              `.cart-drawer__recommendation-item__info--image`
            );

            if (imageDestination && priceDestination)
              imageDestination.innerHTML = imageSource.innerHTML;

            const buttonDestination = this.querySelector(
              ".cart-drawer__recommendation-item__button"
            );
            const buttonSource = html.querySelector(
              ".cart-drawer__recommendation-item__button"
            );
            buttonDestination.removeAttribute("disabled");
            if (buttonSource.hasAttribute("disabled")) {
              buttonDestination.setAttribute("disabled", "disabled");
            }

            const quantityDestination = this.querySelector(
              ".cart-drawer__recommendation-item__quantity-wrapper"
            );
            const quantitytySource = html.querySelector(
              ".cart-drawer__recommendation-item__quantity-wrapper"
            );
            if (quantitytySource && quantityDestination)
              quantityDestination.innerHTML = quantitytySource.innerHTML;
          });
      }

      disconnectedCallback() {
        this.removeEventListener("change", this.onVariantChange);
      }
    }
  );
}
