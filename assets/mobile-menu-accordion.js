if (!customElements.get('mobile-menu-accordion')) {
  customElements.define(
    'mobile-menu-accordion',
    class MobileMenuAccordion extends HTMLElement {
      connectedCallback() {
        this.toggles = Array.from(this.querySelectorAll('[data-mobile-menu-toggle]'));
        this.onToggle = this.onToggle.bind(this);
        this.toggles.forEach((toggle) => toggle.addEventListener('click', this.onToggle));
      }

      disconnectedCallback() {
        this.toggles?.forEach((toggle) => toggle.removeEventListener('click', this.onToggle));
      }

      onToggle(event) {
        const toggle = event.currentTarget;
        const opening = toggle.getAttribute('aria-expanded') !== 'true';

        if (opening && toggle.dataset.menuLevel === '1') {
          this.toggles
            .filter(
              (item) =>
                item.dataset.menuLevel === '1' &&
                item.getAttribute('aria-controls') !== toggle.getAttribute('aria-controls')
            )
            .forEach((item) => this.setExpanded(item, false));
        }

        this.setExpanded(toggle, opening);
      }

      setExpanded(toggle, expanded) {
        const panel = this.querySelector(`#${CSS.escape(toggle.getAttribute('aria-controls'))}`);
        if (!panel) return;

        this.toggles
          .filter((item) => item.getAttribute('aria-controls') === toggle.getAttribute('aria-controls'))
          .forEach((item) => item.setAttribute('aria-expanded', String(expanded)));
        panel.classList.toggle('is-open', expanded);
        panel.setAttribute('aria-hidden', String(!expanded));
        panel.toggleAttribute('inert', !expanded);

        if (!expanded) {
          panel.querySelectorAll('[data-mobile-menu-toggle][aria-expanded="true"]').forEach((nestedToggle) => {
            this.setExpanded(nestedToggle, false);
          });
        }
      }
    }
  );
}
