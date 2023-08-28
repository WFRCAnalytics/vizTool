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

  let mainMenuItems = document.querySelectorAll('calcite-menu-item');
  let mainContentSidebar = document.getElementById('sidebarContent');

  class MenuItem {
    constructor(id, label, options = [], type = "radio") {
      this.id = id;
      this.label = label;
      this.options = options;
      this.type = type;
      this.selectedOption = null;
    }

    // Render the item based on its type
    render() {
      const container = document.createElement('div');
      const labelEl = document.createElement('label');
      labelEl.textContent = this.label;
      container.appendChild(labelEl);

      if (this.type === "radio") {
        this.options.forEach((option, index) => {

          // ABSOLUTE
          // create radio buttons for absolute
          var radioButtonGroup = document.createElement("label");
          var radioButton = document.createElement("calcite-radio-button");
          radioButton.name = "absolute";
          radioButton.value = option;

          // Listen for changes to the radio buttons
          radioButton.addEventListener("change", function (e) {
            // to make sure the radio button is the is the actual element
            const radioButton = e.currentTarget; // or e.target.closest('input[type="radio"]')
            // update renderer with value of radio button
            console.log(radioButton.value);
            updateDisplay();
          });    

          radioButtonGroup.appendChild(radioButton);
          radioButtonGroup.appendChild(document.createTextNode(option || option));
          container.appendChild(radioButtonGroup);
        });
      } else if (this.type === "select") {
          const select = document.createElement('calcite-select');
          this.options.forEach(option => {
              const optionEl = document.createElement('calcite-option');
              optionEl.value = option;
              optionEl.textContent = option;
              select.appendChild(optionEl);
          });
          select.addEventListener('change', (e) => {
              this.selectedOption = e.detail;
          });
          container.appendChild(select);
      }

      return container;
    }

    getSelectedOption() {
      return this.selectedOption;
    }
  }

  // Usage
  const radioMenuItem = new MenuItem('scenario', 'Choose Scenario', ['Scenario 1', 'Scenario 2']);
  const selectMenuItem = new MenuItem('data', 'Choose Data Type', ['Zonal Data', 'Segment Data'], 'select');

  class SidebarContent {
    constructor(title, menuItems = []) {
      this.title = title;
      this.menuItems = menuItems;
    }

    render() {
      const container = document.createElement('div');
      
      const titleEl = document.createElement('h2');
      titleEl.textContent = this.title;

      const menuContainer = document.createElement('div');
      this.menuItems.forEach(menuItem => {
          menuContainer.appendChild(menuItem.render());
      });

      container.appendChild(titleEl);
      container.appendChild(menuContainer);

      return container;
    }
  }
  mainMenuItems.forEach(item => {
    item.addEventListener('click', function() {
      // Identify the clicked item
      let clickedItemText = item.getAttribute('text');
      
      // deselect all menu items
      let mainMenuItems2 = document.querySelectorAll('calcite-menu-item');
      mainMenuItems2.forEach(item2 => {
          item2.active = false;
      });
      item.active = true;
  
      // Change secondary navigation based on the clicked item
      let selectedContent;
      switch(clickedItemText) {
        case "Scenario Manager":
          selectedContent = scenarioManagerContent;
          break;
        case "Zonal Data":
          selectedContent = zonalDataContent;
          break;
        case "Origin-Destination Data":
          selectedContent = originDestinationContent;
          break;
        case "Segment Data":
          selectedContent = segmentDataContent;
          break;
        //... add more cases as needed
        default:
          selectedContent = new SidebarContent("Default", "This is the default content.");
      }
  
      mainContentSidebar.innerHTML = ''; // clear existing content
      mainContentSidebar.appendChild(selectedContent.render());
    });
  });

  const subMenuModelVersions = new MenuItem('subItem1', 'Test 1', ['Option 1', 'Option 2'], 'select');
  const subMenuItem2 = new MenuItem('subItem2', 'Test 2', ['Option 1', 'Option 2'], 'select');

  const scenarioManagerContent   = new SidebarContent("Scenario Manager", [subMenuItem1, subMenuItem2]);
  const zonalDataContent         = new SidebarContent("Zonal Data"                                    );
  const originDestinationContent = new SidebarContent("Origin-Destination Data"                       );
  const segmentDataContent       = new SidebarContent("Segment Data"                                  );

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
    const response = await fetch('menu.json');
    const data = await response.json();
    return data;
  }

  async function createMenuStructure() {
    const menuData = await fetchMenuData();
    
    const mainMenuItems = menuData.map(mainMenuItemData => {
      const submenuItems = (mainMenuItemData.submenu || []).map(subItemData => {
        return new MenuItem(subItemData.id, subItemData.text, subItemData.options || [], subItemData.type);
      });

      return {
        mainItem: mainMenuItemData.text,
        icon: mainMenuItemData.icon,
        sidebarContent: new SidebarContent(mainMenuItemData.text, mainMenuItemData.content, submenuItems)
      };
    });

    return mainMenuItems;
  }

  async function init() {
    const menuStructure = await createMenuStructure();
    
    menuStructure.forEach(itemStructure => {
      const mainMenuItem = document.createElement('calcite-menu-item');
      mainMenuItem.textContent = itemStructure.mainItem;
      
      mainMenuItem.addEventListener('click', function() {
        // clear existing content
        mainContentSidebar.innerHTML = ''; 
        mainContentSidebar.appendChild(itemStructure.sidebarContent.render());

        // Additional logic: deselect other main menu items, etc.
      });

      // Append the main menu item to some parent container
      // Example: mainMenuContainer.appendChild(mainMenuItem);
    });
  }

  init();


});