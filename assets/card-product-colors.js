if (!customElements.get('card-product-colors')) {
	customElements.define('card-product-colors', class CardProductColors extends HTMLElement {
		constructor() {
			super();
		}

		connectedCallback() {
			if(!window.loadedBackgroundColorSwatches) {
				loadColorSwatches();
			}

			this.card = this.closest('.card');
			this.primaryImage = this.card.querySelector('.media img:first-child');

			this.onColorHoverHandler = this.onColorHover.bind(this);
			this.onColorClickHandler = this.onColorClick.bind(this);
			this.onMouseLeaveHandler = this.onMouseLeave.bind(this);

			this.querySelectorAll('.card__product-color-list__button').forEach(color => {
				color.addEventListener('mouseenter', this.onColorHoverHandler);
				color.addEventListener('focus', this.onColorHoverHandler);
				color.addEventListener('click', this.onColorClickHandler);
			});

			this.addEventListener('mouseleave', this.onMouseLeaveHandler);
		}

		disconnectedCallback() {
			this.querySelectorAll('a').forEach(color => {
				color.removeEventListener('mouseenter', this.onColorHoverHandler);
				color.removeEventListener('focus', this.onColorHoverHandler);
				color.removeEventListener('click', this.onColorClickHandler);
			});
			this.removeEventListener('mouseleave', this.onMouseLeaveHandler);
    }

		onColorHover(e) {
			const currentSelectedColor = this.querySelector('.selected');
			if(currentSelectedColor) {
				currentSelectedColor.classList.remove('selected');
			}
			e.target.classList.add('selected');
			if(e.target.dataset.srcset) {
				if(this.primaryImage) {
					this.primaryImage.srcset = e.target.dataset.srcset;
					if(!e.target.classList.contains('loaded')) {
						e.target.classList.add('loaded');
						const parentImageElement = this.primaryImage.parentElement;
						parentImageElement.classList.add('skeleton-box');
						setTimeout(() => {
							parentImageElement.classList.remove('skeleton-box');
						}, 1000);
					}
				}
				if(!this.card.classList.contains('ignore-second-image')) {
					this.card.classList.add('ignore-second-image');
				}
			}

			const cardLink = this.card.querySelector('.card__heading a');
			if(cardLink) {
				cardLink.setAttribute('href', e.target.href);
			}

			const quickViewButton = this.card.querySelector('.quick-button--view button');
			if(quickViewButton) {
				quickViewButton.dataset.productUrl = e.target.href;
			}
		}

		onColorClick(e) {
			e.preventDefault();
		}

		onMouseLeave(e) {
			this.card.classList.remove('ignore-second-image')
		}
	});
}