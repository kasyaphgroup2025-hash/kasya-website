if(!customElements.get('custom-tabs')) {
  customElements.define('custom-tabs', class CustomTabs extends HTMLElement {
    constructor() {
      super();
      this._boundClickHandler = this._onTabClick.bind(this);
      this._boundKeyHandler = this._onKeydown.bind(this);
      this._boundScrollHandler = throttle(this._onScroll.bind(this), 100);
      this._onOpenStickyHeaderHandler = this._onOpenStickyHeader.bind(this);
      this._onCloseStickyHeaderHandler = this._onCloseStickyHeader.bind(this);
      this._onToggleNavStickyHeaderHandler = this._onToggleNavStickyHeader.bind(this);
    }
  
    connectedCallback() {
      this.mode = this.dataset.mode || "tabbed"; // "tabbed" | "scroll"
      this.sticky = this.dataset.sticky === "true"; // enable sticky offset if needed
      this.tablist = this.querySelector('[role="tablist"]');
      this.tabs = Array.from(this.querySelectorAll('[role="tab"]'));
      this.panels = Array.from(this.querySelectorAll('[role="tabpanel"]'));
      this.delta = 50;
      this._calculateOffsetNavigation();
      this.offsetScroll = this.offsetNavigation + this.delta;

      // bind events
      this.tabs.forEach(tab => {
        tab.addEventListener("click", this._boundClickHandler);
      });
  
      if (this.tablist) {
        this.tablist.addEventListener("keydown", this._boundKeyHandler);
      }
  
      if (this.mode === "scroll") {
        this.stickHeader = document.querySelector('sticky-header');
        window.addEventListener("scroll", this._boundScrollHandler, { passive: true });
        if(this.sticky) {
          document.addEventListener("openStickyHeader", this._onOpenStickyHeaderHandler);
          document.addEventListener("closeStickyHeader", this._onCloseStickyHeaderHandler);
          document.addEventListener("toggleNavInSticky", this._onToggleNavStickyHeaderHandler);
        }
      }

      this.setupWindowResize();
    }
  
    disconnectedCallback() {
      this.tabs?.forEach(tab => {
        tab.removeEventListener("click", this._boundClickHandler);
      });
      if (this.tablist) {
        this.tablist.removeEventListener("keydown", this._boundKeyHandler);
      }
      if(this.mode === "scroll") {
        window.removeEventListener("scroll", this._boundScrollHandler);
        if(this.sticky) {
          document.removeEventListener("openStickyHeader", this._onOpenStickyHeaderHandler);
          document.removeEventListener("closeStickyHeader", this._onCloseStickyHeaderHandler);
          document.removeEventListener("toggleNavInSticky", this._onToggleNavStickyHeaderHandler);
        }
      }
      window.removeEventListener('resize', this._debouncedOnWindowResize);
    }

    setupWindowResize() {
      this._debouncedOnWindowResize = debounce((event) => {
        this._onWindowResize(event);
      }, 1000);

      window.addEventListener('resize', this._debouncedOnWindowResize, false);
    }

    _onWindowResize() {
      this._calculateOffsetNavigation();
    }

    _calculateOffsetNavigation() {
      this.offsetNavigation = this.sticky && this.tablist ? this.tablist.offsetHeight : 0;
      this.style.setProperty('--offset-navigation', `${this.offsetNavigation}px`);
    }
  
    selectTab(tab) {
      const targetPanelId = tab.getAttribute("aria-controls");
      const targetPanel = this.querySelector(`#${targetPanelId}`);
  
      // deactivate all tabs
      this.tabs.forEach(t => {
        t.setAttribute("aria-selected", "false");
        t.setAttribute("tabindex", "-1");
      });
  
      // activate current tab
      tab.setAttribute("aria-selected", "true");
      tab.removeAttribute("tabindex");
  
      if (this.mode === "tabbed") {
        this.panels.forEach(p => p.classList.remove("active"));
        if (targetPanel) {
          targetPanel.classList.add("active");
        }
      } else {
        if (targetPanel) {
          if(this.timeoutStickyHeader) {
            clearTimeout(this.timeoutStickyHeader);
          }
          this.setStickyHeaderPreventHide(true);
          targetPanel.scrollIntoView({ behavior: "smooth", block: "start" });
          this.timeoutStickyHeader = setTimeout(() => {
            this.setStickyHeaderPreventHide(false);
          }, 1000);
        }
      }
    }

    setStickyHeaderPreventHide(value) {
      if(this.stickHeader && this.stickHeader.dataset.stickyType != 'always' && this.stickHeader.openStatus) {
        this.stickHeader.setPreventHide(value);
      }
    }

    _onOpenStickyHeader(e) {
      if(window.innerWidth < 989) {
        this.offsetScroll = this.offsetNavigation + e.detail.headerHeight;
      } else {
        this.offsetScroll = this.offsetNavigation + e.detail.headerHeight - 10;
        if(!e.detail.toggleNav) {
          this.offsetScroll -= e.detail.navHeight;
        }
      }
      this.offsetScroll += this.delta;
    }

    _onCloseStickyHeader() {
      this.offsetScroll = this.offsetNavigation + this.delta;
    }

    _onToggleNavStickyHeader(e) {
      this.offsetScroll = this.offsetNavigation + e.detail.headerHeight - 10;
      if(!e.detail.toggleNav) {
        this.offsetScroll -= e.detail.navHeight;
      }
    }
  
    _onTabClick(event) {
      this.selectTab(event.currentTarget);
    }
  
    _onKeydown(e) {
      const currentTab = document.activeElement;
      if (!this.tabs.includes(currentTab)) return;
  
      let newTab;
      if (e.key === "ArrowRight") {
        newTab = currentTab.parentElement.nextElementSibling.querySelector('[role="tab"]') || this.tabs[0];
      } else if (e.key === "ArrowLeft") {
        newTab = currentTab.parentElement.previousElementSibling.querySelector('[role="tab"]') || this.tabs[this.tabs.length - 1];
      }
  
      if (newTab) {
        newTab.focus();
        this.selectTab(newTab);
        e.preventDefault();
      }
    }
  
    _onScroll() {
      let activePanel = null;
      for (const panel of this.panels) {
        const rect = panel.getBoundingClientRect();
        if (rect.top <= this.offsetScroll && rect.bottom > this.offsetScroll) {
          activePanel = panel;
          break;
        }
      }
  
      if (activePanel) {
        const activeId = activePanel.id;
        const matchingTab = this.tabs.find(tab => tab.getAttribute("aria-controls") === activeId);
        if (matchingTab && matchingTab.getAttribute("aria-selected") !== "true") {
          this.tabs.forEach(t => t.setAttribute("aria-selected", "false"));
          matchingTab.setAttribute("aria-selected", "true");
        }
      }
    }
  });
};