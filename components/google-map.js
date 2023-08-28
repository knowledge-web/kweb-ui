
class GoogleMap extends HTMLElement {
  connectedCallback() {
    const apiKey = this.getAttribute('api-key');
    this.mapDiv = document.createElement('div');
    this.mapDiv.style.width = '100%';
    this.mapDiv.style.height = '100%';
    this.mapDiv.style.backgroundColor = 'gray'; // Gray background
    this.appendChild(this.mapDiv);

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.onload = () => this.initMap();
    document.head.appendChild(script);
  }

  initMap() {
    const mapOptions = {
      center: { lat: Math.random() * 180 - 90, lng: Math.random() * 360 - 180 },
      zoom: 3,
      disableDefaultUI: true
    };
    this.map = new google.maps.Map(this.mapDiv, mapOptions);
  }

  setLocations(locations) {
    const geocoder = new google.maps.Geocoder();

    locations.forEach((location, index) => {
      geocoder.geocode({ address: location.name }, (results, status) => {
        if (status === 'OK') {
          const position = results[0].geometry.location;
          const marker = new google.maps.Marker({
            position,
            map: this.map,
            icon: location.primary
              ? null // Default red pin
              : {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5, // Smaller gray dot
                fillColor: '#808080',
                fillOpacity: 1,
                strokeWeight: 0
              }
          });

          if (location.primary) {
            this.map.setCenter(position);
            this.map.setZoom(8); // Centered zoom
          }

          // Custom event on hover
          marker.addListener('mouseover', () => {
            const event = new CustomEvent('pin-hover', {
              detail: location.name
            });
            this.dispatchEvent(event);
          });
        }
      });
    });
  }
}

customElements.define('google-map', GoogleMap);
