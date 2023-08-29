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

  class SidebarItem {
    constructor(id, text, options = [], type = "radio", selectedOption) {
        this.id = id;
        this.text = text;
        this.options = options;
        this.type = type;
        this.selectedOption = selectedOption;
    }

    // Render the item based on its type
    render() {
      const container = document.createElement('div');
      
      let title = document.createElement("calcite-label");  // Create a new div element
      title.innerHTML = "<b>" + this.text + "</b>";  // Set its innerHTML
      container.appendChild(title);  // Append the new element to the container
      
      if (this.type === "radio") {

        this.options.forEach((option, index) => {

          // create radio buttons
          var radioButtonLabel = document.createElement("calcite-label");
          radioButtonLabel.setAttribute('layout', 'inline');
          radioButtonLabel.classList.add('pointer-cursor');


          var radioButton = document.createElement("calcite-radio-button");

          radioButton.name = this.id;
          radioButton.value = option;

          // Optionally, select the first radio button by default
          if (option === this.selectedOption) {
              radioButton.checked = true;
          }
          // Listen for changes to the radio buttons
          radioButton.addEventListener("change", function (e) {
            // to make sure the radio button is the is the actual element
            const radioButton = e.currentTarget; // or e.target.closest('input[type="radio"]')
            // update renderer with value of radio button
            console.log(this.id + ':' + this.name + ' radio button change')
          });    

          // Nest the radio button directly inside the calcite-label
          radioButtonLabel.appendChild(radioButton);
          radioButtonLabel.appendChild(document.createTextNode(option || option));

          container.appendChild(radioButtonLabel);

        });
      } else if (this.type === "select") {
        const select = document.createElement('calcite-select');
        this.options.forEach(option => {
          const optionEl = document.createElement('calcite-option');
          optionEl.value = option;
          optionEl.textContent = option;
          
          if (option === this.selectedOption) {
            optionEl.setAttribute('selected', 'true'); // This will select the option
          }
          select.appendChild(optionEl);
        });
        select.addEventListener('change', (e) => {
          this.selectedOption = e.detail;
        });
        container.appendChild(select);
      }
      
      let space = document.createElement("calcite-label");  // Create a new div element
      space.innerHTML = "<br/>";  // Set its innerHTML
      container.appendChild(space);  // Append the new element to the container
      
      return container;
    }

    getSelectedOption() {
      return this.selectedOption;
    }
  }

  class SidebarContent {
    constructor(title, SidebarItems = []) {
      this.title = title;
      this.SidebarItems = SidebarItems;
    }

    render() {
      const container = document.createElement('div');
      
      const titleEl = document.createElement('h2');
      titleEl.textContent = this.title;

      const sidebarContainer = document.createElement('div');
      this.SidebarItems.forEach(sidebarItem => {
        sidebarContainer.appendChild(sidebarItem.render());
      });

      container.appendChild(titleEl);
      container.appendChild(sidebarContainer);

      return container;
    }
  }

  class MenuItem {
    constructor(id, text, iconStart, sidebarContent) {
      this.menuItemId = id;
      this.menuItemText = text;
      this.menuItemIconStart = iconStart;
      this.sidebarContent = sidebarContent;
    }

    createMenuItemElement() {
      const mainMenuItem = document.createElement('calcite-menu-item');
      mainMenuItem.setAttribute('id', this.menuItemId);
      mainMenuItem.setAttribute('text', this.menuItemText);
      mainMenuItem.setAttribute('icon-start', this.menuItemIconStart);
      mainMenuItem.setAttribute('text-enabled', '');

      const menuItemInstance = this;

      mainMenuItem.addEventListener('click', function() {
          let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
          mainSidebarItems2.forEach(item2 => {
              if(item2.text === menuItemInstance.menuItemText) {  // Use the saved instance context here
                  item2.active = true;
              } else {
                  item2.active = false;
              }
          });
          
          menuItemInstance.populateSidebar();  // Use the saved instance context here as well
      });
  
      return mainMenuItem;
  
    }

    populateSidebar() {
      const sidebar = document.querySelector('#sidebarContent');
      // You might have to modify the next line based on the structure of your SidebarContent class.
      sidebar.innerHTML = ''; // clear existing content
      sidebar.appendChild(this.sidebarContent.render());
      // Set the focus to the sidebar
      sidebar.focus();
    }
  }

  //mainSidebarItems.forEach(item => {
  //  item.addEventListener('click', function() {
  //    // Identify the clicked item
  //    let clickedItemText = item.getAttribute('text');
  //    
  //    // deselect all menu items
  //    let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
  //    mainSidebarItems2.forEach(item2 => {
  //        item2.active = false;
  //    });
  //    item.active = true;
  //
  //    // Change secondary navigation based on the clicked item
  //    let selectedContent;
  //    switch(clickedItemText) {
  //      case "Scenario Manager":
  //        selectedContent = scenarioManagerContent;
  //        break;
  //      case "Zonal Data":
  //        selectedContent = zonalDataContent;
  //        break;
  //      case "Origin-Destination Data":
  //        selectedContent = originDestinationContent;
  //        break;
  //      case "Segment Data":
  //        selectedContent = segmentDataContent;
  //        break;
  //      //... add more cases as needed
  //      default:
  //        selectedContent = new SidebarContent("Default", "This is the default content.");
  //    }
  //
  //    mainContentSidebar.innerHTML = ''; // clear existing content
  //    mainContentSidebar.appendChild(selectedContent.render());
  //  });
  //});

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