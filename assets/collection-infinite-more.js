class CollectionLoadingButton extends HTMLElement
{
	constructor() {
		super();
	}

	fetchData(cb = null) {
		const productGrid = document.getElementById(this.dataset.productGrid);
		productGrid.parentElement.classList.add('loading');
		fetch(`${this.dataset.url}`, {method: 'GET'})
		.then((response) => {
			return response.text();
		})
		.then(responseText => {
			productGrid.parentElement.classList.remove('loading');
			const responseHTML = new DOMParser().parseFromString(responseText, 'text/html');
			let responseProductItems = responseHTML.querySelectorAll(`#${this.dataset.productGrid} > *`);
			
			if(responseProductItems.length > 0) {
				if(this.dataset.loadingType == 'next') {
					responseProductItems.forEach(element => {
						productGrid.appendChild(element);
					});
				} else {
					Array.from(responseProductItems).reverse().forEach(element => productGrid.prepend(element));
				}
				if(window.appearAnimate) {
					const appear_animate_list = this.closest('appear-animate-list');
					if(appear_animate_list) {
						appear_animate_list.reset();
					}
				}
			}

			const newButton = responseHTML.querySelector(`.collection__loading-button[data-loading-type="${this.dataset.loadingType}"]`);
			if(newButton) {
				if(this.dataset.loadingType == 'next') {
					this.parentElement.appendChild(newButton);
				} else {
					this.parentElement.prepend(newButton);
				}
			}

			let urlParams = new URLSearchParams(this.dataset.url.split('?')[1]);
			urlParams.delete('section_id');
			const params = urlParams.toString();
			history.pushState({ params }, "", `${this.dataset.url.split('?')[0]}?${params}`);

			this.remove();

			if(cb) {
				cb();
			}
		})
		.catch(e => {
			productGrid.parentElement.classList.remove('loading');
		});
	}
}

class CollectionInfiniteButton extends CollectionLoadingButton
{
  connectedCallback() {
		let observer = new IntersectionObserver((entries, observer) => {
			if(entries[0].isIntersecting) {
				this.fetchData();
				observer.disconnect();
			}
		});

		observer.observe(this);
	}
}

customElements.define('collection-infinite-button', CollectionInfiniteButton);

class CollectionLoadMoreButton extends CollectionLoadingButton
{
	connectedCallback() {
		this.addEventListener('click', this.onClick);
	}

	onClick() {
		this.removeEventListener('click', this.onClick);
		this.fetchData();
	}

	disconnectedCallback() {
		this.removeEventListener('click', this.onClick);
	}
}

customElements.define('collection-load-more-button', CollectionLoadMoreButton);