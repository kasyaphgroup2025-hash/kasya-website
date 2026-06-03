class CollectionPaginationNumbers extends HTMLElement
{
  constructor() {
    super();
  }

  connectedCallback() {
    this.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', this.onClick);
    });
  }

  onClick(e) {
    e.preventDefault();
    const url = this.getAttribute('href');
    const productGrid = document.getElementById('ProductGridContainer');
    productGrid.querySelector('.collection').classList.add('loading');
    fetch(url)
      .then(response => response.text())
      .then((responseText) => {
        const html = responseText;
        productGrid.innerHTML = new DOMParser().parseFromString(html, 'text/html').getElementById('ProductGridContainer').innerHTML;
        const searchParams = url.split('?')[1];
        history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
        productGrid.querySelector('.collection').classList.remove('loading');
        productGrid.scrollIntoView({behavior: 'smooth'});
      });
  }
}

customElements.define('collection-pagination-numbers', CollectionPaginationNumbers);