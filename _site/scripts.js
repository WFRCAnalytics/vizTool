let globalTemplates = [];
let dataScenarios = [];
let map;
let geojsonSegments;
let view;
let layerDisplay;
let dummyFeature;

require(["esri/config",
         "esri/Map",
         "esri/views/MapView",
         "esri/Basemap",
         "esri/widgets/BasemapToggle",
         "esri/layers/GeoJSONLayer",
         "esri/widgets/Home",
         "esri/widgets/Search",
         "esri/layers/TileLayer",
         "esri/geometry/Point",
         "esri/geometry/Polygon",
         "esri/geometry/Polyline",
         "esri/layers/FeatureLayer",
         "esri/widgets/LayerList",
         "esri/widgets/Legend",
         "esri/PopupTemplate",
         "esri/symbols/TextSymbol",
         "esri/rest/support/Query",
         "esri/WebMap",
         "esri/PopupTemplate"
        ],
function(esriConfig, Map, MapView, Basemap, BasemapToggle, GeoJSONLayer, Home, Search, TileLayer, Point, Polygon, Polyline, FeatureLayer, LayerList, Legend, PopupTemplate, TextSymbol, Query, WebMap, PopupTemplate) {

  esriConfig.apiKey = "AAPK5f27bfeca6bb49728b7e12a3bfb8f423zlKckukFK95EWyRa-ie_X31rRIrqzGNoqBH3t3Chvz2aUbTKiDvCPyhvMJumf7Wk";

  async function fetchConfig() {
    const response = await fetch('config.json');
    const dataConfig = await response.json();
    return dataConfig;
  }

  async function fetchScenarioData() {
    const response = await fetch('scenarios.json');
    const dataScenario = await response.json();
    return dataScenario;
  }

  async function loadScenarios() {
    const jsonScenario = await fetchScenarioData();
    dataScenarios = jsonScenario.map(item => new Scenario(item));
  }

  async function loadMenuAndItems() {
    const jsonConfig = await fetchConfig();

    const userElement = document.querySelector('calcite-navigation-user[slot="user"]');
    const username = userElement.getAttribute('username');

    const dataApp = jsonConfig['users'].map(item => new User(item));
    const dataMenu = dataApp.filter(item => item.userType === username)[0].userLayout.menuItems;
    const calciteMenu = document.querySelector('calcite-menu[slot="content-start"]');

    // Clear existing menu items
    calciteMenu.innerHTML = '';

    // Render each menu item and log (or insert into the DOM)
    dataMenu.forEach(menuItem => {
      calciteMenu.appendChild(menuItem.createMenuItemElement());
    });
  }

  async function init() {
    const menuStructure = await loadMenuAndItems();
    await loadScenarios();
  }

  function populateTemplates() {
    const container = document.getElementById('main'); // Assuming your templates will be children of a div with the id "main".

    globalTemplates.forEach(template => {
        const div = document.createElement('div');
        div.id = template.templateType + 'Template'; 
        div.classList.add('template');
        div.hidden = true;
        div.innerHTML = template.layoutDivs;
        container.appendChild(div);
    });

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

    map = new Map({
      basemap: "gray-vector" // Basemap layerSegments service
    });
    
    view = new MapView({
      map: map,
      center: [-111.8910, 40.7608], // Longitude, latitude
      zoom: 10, // Zoom level
      container: "mapView", // Div element
      popup: {
        // Popup properties here if any customizations are needed
      }
    });
    
    // Dummy polyline feature connecting Salt Lake City and Provo
    dummyFeature = {
      geometry: {
        type: "polyline",
        paths: [
          [-111.8910, 40.7608], // Salt Lake City
          [-111.8911, 40.7609]  // Provo
        ],
        spatialReference: { wkid: 4326 }  // Specify WGS 84 spatial reference
      },
      attributes: {
        SEGID: 0, // Unique ID, using "SEGID" as the objectIdField
        // ... add other attribute fields if necessary
        displayValue: 0 // Assuming you want a displayValue, you can set any initial value
      }
    };

    let features = [dummyFeature]; // This will be populated with graphics

    layerDisplay = new FeatureLayer({
      source: features,  // Now contains the dummyFeature
      objectIdField: "SEGID",
      fields: [
        // ... your other fields
        { name: "SEGID", type: "oid" },  // Object ID field
        { name: "displayValue", type: "double" } // Assuming 'displayValue' is a type of double
      ]
    });

    map.add(layerDisplay);  // Assuming 'map' is your Map instance


    // ADD GEOJSONS
    
    geojsonSegments = new GeoJSONLayer({
      url: "data/segmentsWithAggFields.geojson",
      title: "Segments",
      renderer: {
        type: "simple",  // autocasts as new SimpleRenderer()
        symbol: {
          type: 'simple-line',
          color: [150, 150, 200],
          width: 1
        }
      }
    });
    map.add(geojsonSegments);
    
    const geojsonParking = new GeoJSONLayer({
      url: "data/parking.geojson",
      title: "Parking",
      renderer: {
        type: "simple",  // autocasts as new SimpleRenderer()
        symbol: {
          type: "simple-fill",  // autocasts as new SimpleFillSymbol()
          color: [255, 120, 120],  // transparent fill
          outline: {  // autocasts as new SimpleLineSymbol()
            width: 0,
            color: [0, 0, 0, 0]
          }
        }
      }
    });
    map.add(geojsonParking);
    
    const geojsonTollz = new GeoJSONLayer({
      url: "data/tollz.geojson",
      title: "Toll Zones",
      renderer: {
        type: "simple",  // autocasts as new SimpleRenderer()
        symbol: {
          type: "simple-fill",  // autocasts as new SimpleFillSymbol()
          color: [120, 255, 120],  // transparent fill
          outline: {  // autocasts as new SimpleLineSymbol()
            width: 0,
            color: [0, 0, 0, 0]
          }
        }
      }
    });
    map.add(geojsonTollz);
    
    const geojsonHexGrid = new GeoJSONLayer({
      url: "data/hexgrid.geojson",
      title: "HexGrid",
      renderer: {
        type: "simple",  // autocasts as new SimpleRenderer()
        symbol: {
          type: "simple-fill",  // autocasts as new SimpleFillSymbol()
          color: [0, 0, 0, 0],  // transparent fill
          outline: {  // autocasts as new SimpleLineSymbol()
            width: 0.5,
            color: [120, 120, 120]
          }
        }
      }
    });
    map.add(geojsonHexGrid);

    const geojsonCities = new GeoJSONLayer({
      url: "data/city.geojson",
      title: "Municipalities",
      renderer: {
        type: "simple",  // autocasts as new SimpleRenderer()
        symbol: {
          type: "simple-fill",  // autocasts as new SimpleFillSymbol()
          color: [0, 0, 0, 0],  // transparent fill
          outline: {  // autocasts as new SimpleLineSymbol()
            width: 3,
            color: [50, 50, 50]
          }
        }
      }
    });
    map.add(geojsonCities);

//    // Define the layer selection widget
//    const layerList = new LayerList({
//      view: view,
//      // Optional: Specify the title for the widget
//      container: document.createElement('div'),
//      // Optional: Expand the widget by default
//      listItemCreatedFunction: function(event) {
//        const item = event.item;
//        item.panel = {
//          content: 'legend',
//          open: true
//        };
//      }
//    });
//
//    // Add the widget to the top-right corner of the view
//    view.ui.add(layerList, {
//      position: 'bottom-left'
//    });

    // add basemap toggle
    const basemapToggle = new BasemapToggle({
      view: view,
      nextBasemap: "arcgis-imagery"
    });
    
    view.ui.add(basemapToggle,"bottom-left");


    // initialize map
    init();
  }

  fetch('templates.json')
  .then(response => response.json())
  .then(data => {
    globalTemplates = data;
    // Optionally, initialize your classes or do other tasks here, 
    // once the data is fetched and assigned.
    populateTemplates();
  })
  .catch(error => {
    console.error("Error fetching templates:", error);
  });

});