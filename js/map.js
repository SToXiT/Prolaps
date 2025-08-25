// Icônes personnalisées
const markerIcons = {
  "hydrant-red": L.icon({ iconUrl: 'img/Station.png', iconSize: [10,10], iconAnchor: [5,5] }),
  "hydrant-yellow": L.icon({ iconUrl: 'img/marker-yellow.png', iconSize: [10,10], iconAnchor: [5,5] }),
  "firestation": L.icon({ iconUrl: 'img/reparation.png', iconSize: [17,30], iconAnchor: [8.5,30] }),
  "hospital": L.icon({ iconUrl: 'img/hopital.png', iconSize: [30,30], iconAnchor: [15,30] }),
};

const markerLabels = {
  "hydrant-red": "Station Service",
  "hydrant-yellow": "Borne jaune",
  "firestation": "Réparation",
  "hospital": "Hôpital"
};

let map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -3,
  maxZoom: 2
});
const bounds = [[0,0], [9000,8192]];
L.imageOverlay('img/map.png', bounds).addTo(map);
map.fitBounds(bounds);

let data = { hydrants: [], routes: [] };
let markers = [];
let polylines = [];
let visibleTypes = {};
let visibleRoutes = {};

function renderHydrants() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  data.hydrants.forEach(h => {
    if (visibleTypes[h.type] !== false) {
      const icon = markerIcons[h.type] || markerIcons["hydrant-red"];
      let label = h.nom || markerLabels[h.type] || h.type;
      const marker = L.marker([h.y, h.x], {icon: icon}).bindPopup(label).addTo(map);
      markers.push(marker);
    }
  });
}

function renderRoutes() {
  polylines.forEach(p => map.removeLayer(p));
  polylines = [];
  data.routes.forEach(route => {
    if (visibleRoutes[route.nom] !== false && route.points.length > 1) {
      const latlngs = route.points.map(p => [p.y, p.x]);
      const polyline = L.polyline(latlngs, {color: route.color, weight: 4}).bindPopup(route.nom).addTo(map);
      polylines.push(polyline);
    }
  });
}

function createTypeMenu(types, routes) {
  const menu = document.getElementById('type-menu');
  menu.innerHTML = `<div><b>Types à afficher :</b><br>`;
  types.forEach(type => {
    const checked = visibleTypes[type] !== false ? 'checked' : '';
    const label = markerLabels[type] || type;
    menu.innerHTML += `
      <label><input type="checkbox" data-type="${type}" ${checked}> ${label}</label><br>
    `;
  });
  menu.innerHTML += `<hr><b>Itinéraires à afficher :</b><br>`;
  routes.forEach(route => {
    const checked = visibleRoutes[route.nom] !== false ? 'checked' : '';
    menu.innerHTML += `
      <label><input type="checkbox" data-route="${route.nom}" ${checked} style="accent-color:${route.color};"> ${route.nom}</label><br>
    `;
  });
  menu.innerHTML += '</div>';

  // Types handlers
  menu.querySelectorAll('input[data-type]').forEach(cb => {
    cb.addEventListener('change', function(){
      visibleTypes[this.getAttribute('data-type')] = this.checked;
      renderHydrants();
    });
  });
  // Routes handlers
  menu.querySelectorAll('input[data-route]').forEach(cb => {
    cb.addEventListener('change', function(){
      visibleRoutes[this.getAttribute('data-route')] = this.checked;
      renderRoutes();
    });
  });
}

async function initMap() {
  const response = await fetch('marker.json');
  data = await response.json();
  // init visible types/routes
  const types = [...new Set(data.hydrants.map(h => h.type))];
  types.forEach(type => visibleTypes[type] = true);
  data.routes.forEach(r => visibleRoutes[r.nom] = true);
  createTypeMenu(types, data.routes);
  renderHydrants();
  renderRoutes();
}

initMap();
