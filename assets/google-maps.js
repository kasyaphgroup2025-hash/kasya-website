if (!customElements.get('google-maps')) {
  customElements.define('google-maps', class GoogleMaps extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.observer = new IntersectionObserver((entries, observer) => {
        if(entries[0].isIntersecting) {
          this.loadMap();
          this.observer.disconnect();
        }
      });
  
      this.observer.observe(this);
    }

    disconnectedCallback() {
      if(this.observer) {
        this.observer.disconnect();
        if(this.onResizeHandler) {
          window.removeEventListener('resize', this.onResizeHandler);
        }
      }
    }

    async loadLibrary() {
      await google.maps.importLibrary("maps");
      await google.maps.importLibrary("marker");
    }

    loadMap() {
      const positionArray = this.dataset.coordinates.split(',');
      this.position = { lat: parseFloat(positionArray[0]), lng: parseFloat(positionArray[1]) };
      const zoom = parseInt(this.dataset.zoom);
      const mapType = this.dataset.mapType;
      this.loadLibrary().then(() => {
        // The map
        this.map = new google.maps.Map(document.getElementById(`map-${this.dataset.sectionId}`), {
          zoom: zoom,
          center: this.position,
          mapTypeId: mapType,
          mapId: this.dataset.mapId || "DEMO_MAP_ID"
        });

        // The marker
        new google.maps.marker.AdvancedMarkerElement({
          map: this.map,
          position: this.position
        });

        this.onResizeHandler = this.onResize.bind(this);
        window.addEventListener('resize', this.onResizeHandler);
      });
    }

    onResize() {
      if(this.map) {
        google.maps.event.trigger(this.map, 'resize');
        this.map.setCenter(this.position);
      }
    }
  });
}