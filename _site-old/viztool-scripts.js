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

  document.getElementById('toggleOverlay').addEventListener('click', function() {
    var overlay = document.getElementById('overlay');
    if (overlay.classList.contains('collapsed')) {
      overlay.classList.remove('collapsed');
      this.innerText = 'Collapse';
    } else {
      overlay.classList.add('collapsed');
      this.innerText = 'Expand';
    }
  });

  
  const map = new Map({
    basemap: "gray-vector" // Basemap layerSegments service
  });

  view = new MapView({
    map: map,
    center: [-111.8910, 40.7608], // Longitude, latitude
    zoom: 10, // Zoom level
    container: "mapView" // Div element
  });

  async function fetchMenuData() {
    const response = await fetch('viztool-menu.json');
    const data = await response.json();
    return data;
  }

  async function createMenuStructure() {
    const menuData = await fetchMenuData();

    const mainMenuItems = menuData.map(menuItemData => {

      const convertedSidebarItems = menuItemData.sidebarItems.map(item => {
        if (item instanceof SidebarItem) {
            return item;
        } else {
            // Assume SidebarItem constructor can handle the item's structure
            return new SidebarItem(item.id, item.text, item.options, item.type, item.selectedOption);
        }
      });
    
      menuItemData.sidebarItems = convertedSidebarItems;
  
      const sidebarContent = new SidebarContent(menuItemData.text, menuItemData.sidebarItems);
      return new MenuItem(menuItemData.id, menuItemData.text, menuItemData.iconStart, sidebarContent);

    });

    return mainMenuItems;
  }

  async function init() {
    const menuStructure = await createMenuStructure();
    const calciteMenu = document.querySelector('calcite-menu[slot="content-start"]');

    // Clear existing menu items
    calciteMenu.innerHTML = '';  

    menuStructure.forEach(itemStructure => {
      calciteMenu.appendChild(itemStructure.createMenuItemElement());

      // Append the main menu item to some parent container
      // Example: mainMenuContainer.appendChild(mainMenuItem);
    });
  }

  init();


});