class BtRecentlyViewedUtil
{
  static init() {
    BtRecentlyViewedUtil.key = `recently_viewed-${Shopify.shop.replace('.myshopify.com', '')}`;
		if(window.currentProduct) {
      BtRecentlyViewedUtil.addProduct(window.currentProduct.id, window.currentProduct.url, window.currentProduct.image);
    }
  }

  static setArray(array) {
    BtStorageUtil.set(BtRecentlyViewedUtil.key, array);
  }

	static getArray() {
    return BtStorageUtil.get(BtRecentlyViewedUtil.key, true) || [];
  }

	static addProduct(productId, productUrl, productImage) {
    let currentList = BtRecentlyViewedUtil.getArray();
		let existProduct = currentList.filter(e => e.product_id != productId);

		existProduct.unshift({
			"product_id": productId,
			"url": productUrl,
			"image": productImage
		});

		if(existProduct.length > window.recentlyViewedLimit) {
			existProduct.pop();
		}

		BtRecentlyViewedUtil.setArray(existProduct);
  }

	static injectScriptTag(element) {
    element.querySelectorAll('script').forEach((oldScriptTag) => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

BtRecentlyViewedUtil.init();

class RecentlyViewed extends HTMLElement
{
  constructor() {
		super();

		this.isEmpty = true;
		
		this.updatedContent = false;
		this.section = this.querySelector('.recently-viewed-products__section');
		this.results = this.querySelector('.recently-viewed-products__results');

		if(this.dataset.productId) {
			this.addProduct(this.dataset.productId, this.dataset.productUrl, this.dataset.productImage);
		}
	}

	connectedCallback() {
		this.stop = Motion.inView(this, (info) => {
      this.updateContent();
    });
	}

	disconnectedCallback() {
		if(this.stop) {
			this.stop();
		}
	}

	addProduct(productId, productUrl, productImage) {
		BtRecentlyViewedUtil.addProduct(productId, productUrl, productImage);
		this.updatedContent = false;
	}

	updateContent() {
		const itemList = BtRecentlyViewedUtil.getArray();
		if(itemList.length > 0) {
			const newIds = [];
			itemList.forEach((item) => {
				if(item.product_id != this.dataset.productId) {
					newIds.push(`id:${item.product_id}`);
				}
			});
			if(!newIds.length) {
				this.section.classList.add('hidden');
				this.updatedContent = true;
				return;
			}
			const idsQuery = newIds.join(' OR ');
			fetch(`${window.routes.search_url}?section_id=recently-viewed-products-ajax&q=${idsQuery}&type="product"`)
			.then((response) => response.text()) 
			.then(response => {
				const html = new DOMParser().parseFromString(response, 'text/html');
				if(!this.hasAssets) {
					this.hasAssets = true;
					document.body.appendChild(html.querySelector('.assets'));
          BtRecentlyViewedUtil.injectScriptTag(document.getElementById('recently-viewed-assets'));
				}
				const sliderComponent = html.querySelector('slider-component');
				if(sliderComponent) {
					if(this.dataset.inheritCardColorScheme == 'false' && this.dataset.colorScheme != this.dataset.cardColorScheme) {
						const colorSchemeClass = `color-${this.dataset.cardColorScheme}`;
						sliderComponent.querySelectorAll('.card-wrapper').forEach(e => e.classList.add(colorSchemeClass, 'card-wrapper--color-scheme'));
					}
					sliderComponent.setAttribute('data-outside-prev-button-id', this.dataset.prevButton);
					sliderComponent.setAttribute('data-outside-next-button-id', this.dataset.nextButton);
					if(this.dataset.fullWidth) {
						sliderComponent.classList.add('page-width--full');
						if(sliderComponent.classList.contains('has-slider')) {
							sliderComponent.classList.add('slider-component-full-width');
							const productGrid = sliderComponent.querySelector('.product-grid');
							if(productGrid.classList.contains('slider')) {
								productGrid.classList.add('grid--peek');
							}
						}
					}
					this.section.classList.remove('hidden');
					this.results.innerHTML == '';
					this.results.appendChild(sliderComponent);
				} else {
					this.section.classList.add('hidden');
				}
			});
		}
		this.updatedContent = true;
	}
}

customElements.define('recently-viewed', RecentlyViewed);
