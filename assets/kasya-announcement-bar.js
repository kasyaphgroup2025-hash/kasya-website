if (!customElements.get('kasya-announcement-bar')) {
  class KasyaAnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.messages = Array.from(this.querySelectorAll('[data-announcement-message]'));
      this.currentIndex = Math.max(
        0,
        this.messages.findIndex((message) => message.classList.contains('is-active'))
      );

      if (this.messages.length < 2) return;

      const configuredInterval = Number.parseInt(this.dataset.interval, 10);
      this.interval = Number.isFinite(configuredInterval) ? configuredInterval : 5000;
      this.startRotation();

      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    disconnectedCallback() {
      this.pauseRotation();
      window.clearTimeout(this.exitTimer);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    pauseRotation = () => {
      window.clearInterval(this.rotationTimer);
    };

    startRotation = () => {
      this.pauseRotation();
      this.rotationTimer = window.setInterval(() => this.showNextMessage(), this.interval);
    };

    handleVisibilityChange = () => {
      if (document.hidden) {
        this.pauseRotation();
      } else {
        this.startRotation();
      }
    };

    showNextMessage() {
      const currentMessage = this.messages[this.currentIndex];
      const nextIndex = (this.currentIndex + 1) % this.messages.length;
      const nextMessage = this.messages[nextIndex];

      currentMessage.classList.remove('is-active');
      currentMessage.classList.add('is-exiting');
      nextMessage.classList.remove('is-exiting');

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => nextMessage.classList.add('is-active'));
      });

      window.clearTimeout(this.exitTimer);
      this.exitTimer = window.setTimeout(() => currentMessage.classList.remove('is-exiting'), 500);
      this.currentIndex = nextIndex;
    }
  }

  customElements.define('kasya-announcement-bar', KasyaAnnouncementBar);
}
