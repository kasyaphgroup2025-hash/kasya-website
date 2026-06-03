if (!customElements.get('video-progress')) {
  customElements.define('video-progress', class VideoProgress extends HTMLElement {
    constructor() {
      super();
      this._inited = false;
      this._lastVideo = null;
      this._running = false;
      this._raf = null;
      this._rvfcId = null;
      this._h = null;

      // Offset (in seconds). Default = 0
      this.offset = 0;
    }

    connectedCallback() {
      if (this._inited) return;
      this._inited = true;

      this.classList.add('zoom', 'overflow-hidden');
      if (!this.querySelector('.fill')) {
        const fill = document.createElement('span');
        fill.className = 'fill db h100';
        this.appendChild(fill);
      }
      this._fill = this.querySelector('.fill');
    }

    disconnectedCallback() { this.reset(); }

    reset() {
      this._set(0);

      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._rvfcId && this._lastVideo?.cancelVideoFrameCallback) {
        this._lastVideo.cancelVideoFrameCallback(this._rvfcId);
      }

      if (this._lastVideo && this._h) {
        this._lastVideo.removeEventListener('play', this._h.play);
        this._lastVideo.removeEventListener('pause', this._h.pause);
        this._lastVideo.removeEventListener('ended', this._h.ended);
        this._lastVideo.removeEventListener('seeked', this._h.seeked);
      }

      this._lastVideo = null;
      this._running = false;
      this._raf = null;
      this._rvfcId = null;
      this._h = null;
    }

    async attach(mediaEl) {
      if (!this._fill || !mediaEl) return;
      this.reset();

      const video = mediaEl.querySelector('video');
      if (video) {
        this._attachHTML5(video);
      }
    }

    // --- HTML5 ---
    _attachHTML5(video) {
      this._lastVideo = video;
    
      const updateProgress = () => {
        if (!this._running) return;
    
        const duration = video.duration || 0;
        const current = video.currentTime || 0;
    
        if (duration > 0) {
          let pct;
    
          // 🧠 Some browsers fire 'ended' slightly before reaching full duration.
          // If less than 0.1s remaining or 'ended' is true → force 100%.
          if (video.ended || (duration - current) < 0.1) {
            pct = 100;
          } else {
            pct = Math.min(100, (current / duration) * 100);
          }
    
          this._set(pct);
        }
    
        this._raf = requestAnimationFrame(updateProgress);
      };
    
      this._h = {
        play: () => {
          this._running = true;
          cancelAnimationFrame(this._raf);
          this._raf = requestAnimationFrame(updateProgress);
        },
        pause: () => {
          this._running = false;
          cancelAnimationFrame(this._raf);
          const pct = (video.currentTime / (video.duration || 1)) * 100;
          this._set(Math.min(100, pct));
        },
        ended: () => {
          // 🎯 Always force fill to 100% when video actually ends.
          this._running = false;
          cancelAnimationFrame(this._raf);
          this._set(100);
        },
        seeked: () => {
          const pct = (video.currentTime / (video.duration || 1)) * 100;
          this._set(Math.min(100, pct));
        },
        loadedmetadata: () => {
          if (!video.paused && !video.ended) this._h.play();
        }
      };
    
      // Attach listeners
      video.addEventListener('play', this._h.play);
      video.addEventListener('pause', this._h.pause);
      video.addEventListener('ended', this._h.ended);
      video.addEventListener('seeked', this._h.seeked);
      video.addEventListener('loadedmetadata', this._h.loadedmetadata);
    
      // If already playing, begin tracking right away
      if (!video.paused && !video.ended) this._h.play();
    }

    // --- Helpers ---
    _set(pct) {
      if (!this._fill) return;
      const v = Math.max(0, Math.min(100, pct || 0));
      this._fill.style.width = v + '%';
    }
  });
}