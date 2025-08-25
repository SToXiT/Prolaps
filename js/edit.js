// --- DATA STRUCTURE ---
let data = { hydrants: [], routes: [] };

// --- UTILITAIRES ---
async function loadMarkerData() {
  const response = await fetch('marker.json');
  data = await response.json();
  saveMarkerLocally(data);
  return data;
}
function saveMarkerLocally(data) { localStorage.setItem('markerData', JSON.stringify(data)); }
function getLocalMarker() {
  const local = localStorage.getItem('markerData');
  return local ? JSON.parse(local) : null;
}

// --- MAP SETUP ---
const markerIcons = {
  "hydrant-red": L.icon({ iconUrl: 'img/Station.png', iconSize: [18,28], iconAnchor: [9,28] }),
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
let selectedType = "hydrant-red";
let visibleTypes = {}, visibleRoutes = {};
let map = L.map('map', { crs: L.CRS.Simple, minZoom: -3 });
const bounds = [[0,0], [9000,8192]];
L.imageOverlay('img/map.png', bounds).addTo(map);
map.fitBounds(bounds);

// --- HYDRANTS ---
let markers = [];
function renderHydrants() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  data.hydrants.forEach((h, idx) => {
    if(visibleTypes[h.type] !== false) {
      const icon = markerIcons[h.type] || markerIcons["hydrant-red"];
      let label = h.nom || markerLabels[h.type] || h.type;
      const marker = L.marker([h.y, h.x], {icon}).bindPopup(label).addTo(map);
      marker.on('click', () => {
        if(selectedType==="firestation" && confirm(`Renommer ce point ?`)) {
          openRouteModal(h.nom||"", "#333333", (newNom) => {
            h.nom = newNom;
            saveMarkerLocally(data);
            renderHydrants();
          });
        } else if(confirm(`Supprimer ce marqueur (${label}) ?`)) {
          data.hydrants.splice(idx, 1);
          saveMarkerLocally(data);
          renderHydrants();
        }
      });
      markers.push(marker);
    }
  });
}

// --- ROUTES / ITINÉRAIRES ---
let routeMarkers = [];
function renderRoutes() {
  routeMarkers.forEach(arr => arr.forEach(m => map.removeLayer(m)));
  routeMarkers = [];
  data.routes.forEach(route => {
    if(visibleRoutes[route.nom] !== false && route.points.length > 0) {
      let rMarkers = [];
      route.points.forEach((pt, i) => {
        // Point draggable
        
        const m = L.marker([pt.y, pt.x], {
          draggable: true,
          icon: L.divIcon({className:"draggable-point-marker",iconSize:[2,2],html:`<div style="width:2px;height:2px;border-radius:8px;border:2px solid #fff;background:${route.color};box-shadow:0 0 2px #222"></div>`})
        }).addTo(map);
        m.on('dragend', function(ev){
          let pos = ev.target.getLatLng();
          pt.x = pos.lng; pt.y = pos.lat;
          saveMarkerLocally(data);
          renderRoutes();
        });
        // Remove on click
        m.on('click',function(){
          if(route.points.length>2 && confirm('Retirer ce point du parcours ?')) {
            route.points.splice(i,1);
            saveMarkerLocally(data);
            renderRoutes();
          }
        });
        rMarkers.push(m);
      });
      // Ligne visuelle
      if(route.points.length>1) {
        const latlngs = route.points.map(p => [p.y, p.x]);
        let poly = L.polyline(latlngs, {color: route.color, weight: 4}).addTo(map);
        rMarkers.push(poly);
      }
      // Marqueur pour ouvrir menu édition de nom/couleur
      let mid = route.points[Math.floor(route.points.length/2)];
      if(mid) {
        let labelBtn = L.marker([mid.y, mid.x], {
          icon: L.divIcon({className:"route-label-marker",html:`<span style="background:#fff;padding:3px 3zpx;border-radius:8px;border:1px solid #bbb;color:#222;font-size:12px">${route.nom}</span>`,iconSize:[70,18]})
        }).addTo(map);
        labelBtn.on('click',()=>openRouteModal(route.nom, route.color, (n,c)=>{route.nom=n;route.color=c;saveMarkerLocally(data);renderRoutes();createTypeMenu([...new Set(data.hydrants.map(h=>h.type))], data.routes);updateRoutesSelect();}));
        rMarkers.push(labelBtn);
      }
      routeMarkers.push(rMarkers);
    }
  });
}

// --- MENU ---
function createTypeMenu(types, routes) {
  const menu = document.getElementById('type-menu');
  menu.innerHTML = `<div><b>Types à afficher :</b><br>`;
  types.forEach(type => {
    const checked = visibleTypes[type] !== false ? 'checked' : '';
    const label = markerLabels[type] || type;
    menu.innerHTML += `<label><input type="checkbox" data-type="${type}" ${checked}> ${label}</label><br>`;
  });
  menu.innerHTML += `<hr><b>Itinéraires à afficher :</b><br>`;
  routes.forEach(route => {
    const checked = visibleRoutes[route.nom] !== false ? 'checked' : '';
    menu.innerHTML += `<label><input type="checkbox" data-route="${route.nom}" ${checked} style="accent-color:${route.color};"> ${route.nom}</label><br>`;
  });
  menu.innerHTML += '</div>';
  menu.querySelectorAll('input[data-type]').forEach(cb => {
    cb.addEventListener('change', function() {
      visibleTypes[this.getAttribute('data-type')] = this.checked;
      renderHydrants();
    });
  });
  menu.querySelectorAll('input[data-route]').forEach(cb => {
    cb.addEventListener('change', function() {
      visibleRoutes[this.getAttribute('data-route')] = this.checked;
      renderRoutes();
    });
  });
}

// --- Ajout marqueur normal ---
document.querySelectorAll('#marker-type-selector button').forEach(btn => {
  btn.onclick = () => {
    selectedType = btn.getAttribute('data-type');
    document.getElementById('map').classList.add('crosshair-cursor');
  };
});

map.on('click', function(e) {
  if(routeModeActive) {
    const route = data.routes.find(r=>r.nom===currentRoute);
    route.points.push({x:e.latlng.lng, y:e.latlng.lat});
    saveMarkerLocally(data);
    renderRoutes();
  } else {
    let obj = { x: e.latlng.lng, y: e.latlng.lat, type: selectedType };
    if(selectedType === "firestation") {
      openRouteModal("", "#333333", function(nom, color){
        obj.nom = nom||"Caserne";
        data.hydrants.push(obj);
        saveMarkerLocally(data);
        renderHydrants();
      });
    } else {
      data.hydrants.push(obj);
      saveMarkerLocally(data);
      renderHydrants();
    }
  }
});

// --- ROUTE CREATION & EDIT ---
let routeModeActive = false;
let currentRoute = null;

document.getElementById("createRouteBtn").onclick = function() {
  openRouteModal("", "#ff0000", function(nom, color){
    if(!nom || data.routes.find(r=>r.nom===nom)) return alert("Nom vide ou déjà pris.");
    data.routes.push({nom: nom, color: color, points: []});
    currentRoute = nom;
    routeModeActive = true;
    alert("Cliquez sur la carte pour ajouter les points de votre itinéraire !");
    updateRoutesSelect(); createTypeMenu([...new Set(data.hydrants.map(h=>h.type))], data.routes);
  });
};

document.getElementById("finishRouteBtn").onclick = function() {
  routeModeActive = false;
  currentRoute = null;
  saveMarkerLocally(data);
  renderRoutes();
  updateRoutesSelect();
};

function updateRoutesSelect() {
  const sel = document.getElementById("routesSelect");
  sel.innerHTML = "";
  data.routes.forEach(r => {
    let opt = document.createElement("option");
    opt.value = r.nom;
    opt.textContent = r.nom;
    sel.appendChild(opt);
  });
}
document.getElementById("routesSelect").onchange = function() {
  let nom = this.value; displayRoute(nom);
};
function displayRoute(nom) {
  renderRoutes();
}

// --- EXPORT/IMPORT/CLEAR ---
document.getElementById('export-json-btn').onclick = function() {
  const json = JSON.stringify(data, null, 2);
  navigator.clipboard.writeText(json);
  alert("JSON global copié !");
};
document.getElementById('import-json-btn').onclick = function() {
  document.getElementById('import-json-file').click();
};
document.getElementById('import-json-file').onchange = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.hydrants || !imported.routes) throw new Error("Format JSON invalide");
      data = imported;
      saveMarkerLocally(data);
      createTypeMenu([...new Set(data.hydrants.map(h => h.type))], data.routes);
      renderHydrants(); renderRoutes(); updateRoutesSelect();
      alert("Importation réussie !");
    } catch (err) { alert("Erreur lors de l'import : " + err.message);}
  };
  reader.readAsText(file);
};
document.getElementById('clear-json-btn').onclick = function() {
  if(confirm("Voulez-vous vraiment supprimer toutes les données ?")) {
    data = { hydrants: [], routes: [] };
    saveMarkerLocally(data);
    renderHydrants(); renderRoutes(); updateRoutesSelect();
    alert("Tous les points et routes ont été supprimés.");
  }
};

// --- INIT ---
async function init() {
  let loaded = await loadMarkerData();
  const typesUniq = [...new Set(loaded.hydrants.map(h => h.type))];
  typesUniq.forEach(type => visibleTypes[type] = true);
  loaded.routes.forEach(route => visibleRoutes[route.nom] = true);
  createTypeMenu(typesUniq, loaded.routes);
  renderHydrants();
  renderRoutes();
  updateRoutesSelect();
}
init();
