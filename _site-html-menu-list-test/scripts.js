require(["esri/config",
         "esri/Map",
         "esri/views/MapView",
         "esri/Basemap",
         "esri/widgets/BasemapToggle",
         "esri/layers/GeoJSONLayer",
         "esri/widgets/Home",
         "esri/widgets/Search",
         "esri/layers/TileLayer",
         "esri/Graphic",
         "esri/geometry/Point",
         "esri/geometry/Polygon",
         "esri/geometry/Polyline",
         "esri/layers/FeatureLayer",
         "esri/widgets/LayerList",
         "esri/renderers/ClassBreaksRenderer",
         "esri/renderers/UniqueValueRenderer",
         "esri/renderers/SimpleRenderer",
         "esri/widgets/Legend",
         "esri/PopupTemplate",
         "esri/symbols/TextSymbol",
         "esri/rest/support/Query",
         "esri/WebMap"
        ],
function(esriConfig, Map, MapView, Basemap, BasemapToggle, GeoJSONLayer, Home, Search, TileLayer, Graphic, Point, Polygon, Polyline, FeatureLayer, LayerList, ClassBreaksRenderer, UniqueValueRenderer, SimpleRenderer, Legend, PopupTemplate, TextSymbol, Query, WebMap) {

  esriConfig.apiKey = "AAPK5f27bfeca6bb49728b7e12a3bfb8f423zlKckukFK95EWyRa-ie_X31rRIrqzGNoqBH3t3Chvz2aUbTKiDvCPyhvMJumf7Wk";

//  document.getElementById('toggleOverlay').addEventListener('click', function() {
//    var overlay = document.getElementById('overlay');
//    if (overlay.classList.contains('collapsed')) {
//      overlay.classList.remove('collapsed');
//      this.innerText = 'Collapse';
//    } else {
//      overlay.classList.add('collapsed');
//      this.innerText = 'Expand';
//    }
//  });
//  
//  const map = new Map({
//    basemap: "gray-vector" // Basemap layerSegments service
//  });
//
//  view = new MapView({
//    map: map,
//    center: [-111.8910, 40.7608], // Longitude, latitude
//    zoom: 10, // Zoom level
//    container: "mapView" // Div element
//  });

  async function fetchMenuData() {
    const response = await fetch('menu.json');
    const data = await response.json();
    return data;
  }

  async function loadMenuAndItems() {
    const menuJson = await fetchMenuData();
    const menuData = menuJson.map(item => new MenuItem(item));

    const menuContainer = document.getElementById("menu-container");

    // Render each menu item and log (or insert into the DOM)
    menuData.forEach(menuItem => {
      menuContainer.innerHTML += menuItem.render();
    });
  }

  async function init() {
    const menuStructure = await loadMenuAndItems();

  }

  init();


});