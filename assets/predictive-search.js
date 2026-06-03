class PredictiveSearch extends HTMLElement {
  constructor() {
    super();
    this.cachedResults = {};
    this.input = this.querySelector('input[type="search"]');
    this.predictiveSearchResults = this.querySelector('.predictive-search__results');
    this.overlay = this.querySelector('.predictive-search__overlay');
    this.isOpen = false;
    this.controller = new AbortController();
    this.working = false;
    this.hasPlaceholder = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    const form = this.querySelector('form.search');
    form.addEventListener('submit', this.onFormSubmit.bind(this));
  
    // Use debounce to reduce API calls when typing
    const debouncedInput = debounce(() => {
      const searchTerm = this.getQuery();
  
      // Do not trigger predictive search if input is empty
      if (!searchTerm.length) {
        this.close(true);
        return;
      }
  
      this.open();
      this.setLiveRegionLoadingState();
      this.onChange(); // Will call getSearchResults() internally
    }, 300);
  
    this.input.addEventListener('input', debouncedInput);
    this.input.addEventListener('focus', this.onFocus.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.overlay.addEventListener('click', this.onClickOverlay.bind(this));
  }

  getQuery() {
    return this.input.value.trim();
  }

  onChange() {
    const searchTerm = this.getQuery();
    if (!searchTerm.length) {
      this.close(true);
      return;
    }
    this.getSearchResults(searchTerm);
  }

  onFormSubmit(event) {
    if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) event.preventDefault();
  }

  onFocus() {
    const searchTerm = this.getQuery();

    if (!searchTerm.length) return;

    if (this.getAttribute('results') === 'true') {
      this.open();
    } else {
      this.getSearchResults(searchTerm);
    }
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    })
  }

  onClickOverlay() {
    this.close();
  }

  getSearchResults(searchTerm) {
    const queryKey = searchTerm.replace(/\s+/g, '-').toLowerCase();
  
    // Use cached result if available
    if (!Shopify.designMode && this.cachedResults[queryKey]) {
      this.renderSearchResults(this.cachedResults[queryKey]);
      return;
    }
  
    // Abort any ongoing fetch request
    if (this.working) {
      this.controller.abort();
      this.controller = new AbortController();
    }
  
    const signal = this.controller.signal;
    this.working = true;
  
    fetch(
      `${routes.predictive_search_url}?q=${encodeURIComponent(searchTerm)}&${encodeURIComponent('resources[limit]')}=10&section_id=predictive-search`,
      { signal }
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.status);
        }
        return response.text();
      })
      .then((text) => {
        const resultsMarkup = getDomHtmlFromText(text, '#shopify-section-predictive-search');
        this.cachedResults[queryKey] = resultsMarkup;
        this.renderSearchResults(resultsMarkup);
      })
      .catch((error) => {
        // Ignore AbortError silently
        if (error.name !== 'AbortError') {
          console.error('[PredictiveSearch] Fetch error:', error);
          this.close();
        }
      })
      .finally(() => {
        this.working = false;
      });
  }

  setLiveRegionLoadingState() {
    this.setAttribute('loading', true);
    if(!this.hasPlaceholder) {
      const temp = document.getElementById("predictive-search-placeholder-tpl");
      const placeholder = temp.content.cloneNode(true);
      this.querySelector('.predictive-search__loading-state').append(placeholder);
      this.hasPlaceholder = true;
    }
  }

  renderSearchResults(resultsMarkup) {
    this.predictiveSearchResults.innerHTML = resultsMarkup.innerHTML;

    this.predictiveSearchResults.querySelectorAll('script').forEach(oldScriptTag => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach(attribute => {
        newScriptTag.setAttribute(attribute.name, attribute.value)
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });

    this.setAttribute('results', true);

    this.setLiveRegionResults();
  }

  setLiveRegionResults() {
    this.removeAttribute('loading');
  }

  open() {
    if(!this.isOpen) {
      if(!this.classList.contains('run-top')) {
        if(!this.timeoutRunTop) {
          this.timeoutRunTop = setTimeout(() => {
            this.classList.add('run-top');
            this.timeoutRunTop = null;
          }, 500);
        }
      }
      
      this.setAttribute('open', true);
      this.input.setAttribute('aria-expanded', true);
      this.isOpen = true;
    }
  }

  close(clearSearchTerm = false) {
    if (clearSearchTerm) {
      this.input.value = '';
      this.removeAttribute('results');
    }
    
    this.classList.remove('run-top');

    this.input.setAttribute('aria-activedescendant', '');
    this.removeAttribute('open');
    this.input.setAttribute('aria-expanded', false);
   
    this.isOpen = false;
    if(this.nextElementSibling && this.nextElementSibling.classList.contains('search-modal__close-button')) {
      this.nextElementSibling.dispatchEvent(new Event('click'));
    }
  }
}

customElements.define('predictive-search', PredictiveSearch);