class Filter {
  constructor(fCode, vizLayout, filterData = null, geoJsonInfo={}) {

    let _configFilter;

    if (filterData) {
      this.fCode = filterData.fCode;
      _configFilter = filterData;

    } else {
      this.fCode = fCode;
      _configFilter = configFilters[this.fCode];
    }

    console.log('filter:' + this.fCode);

    if (_configFilter === undefined) {
      return; // Exit the constructor if _configFilter is undefined
    }

    this.id = vizLayout.id + '-' + this.fCode + '-filter';
    console.log('filter-construct:' + this.id);

    this.vizLayout = vizLayout;

    //this.name = (_configFilter.fWidget === 'select' || _configFilter.fWidget === 'checkboxes') ? _configFilter.alias : ''; // Assign alias for select and checkboxes, otherwise blank title

    this.name = _configFilter.alias;

    this.options = [];

    if (_configFilter.fOptionsJson) {
      this.loadAndProcessFOptionsJson(_configFilter).then(() => {
        this.initializeFilter(_configFilter);
      });
    } else if (_configFilter.fOptions){
      this.options = _configFilter.fOptions;
      this.initializeFilter(_configFilter);
    } else {
      this.initializeFilter(_configFilter);
    }

    if (geoJsonInfo && Object.keys(geoJsonInfo).length > 0) {
      this.geoJsonInfo = geoJsonInfo;
    }

    this.isMapInitialized = false; // Track map initialization    
    this.mapView = null; // Placeholder for the ArcGIS map view
  }

  async loadAndProcessFOptionsJson(_configFilter) {
    // load json data
    const _value = _configFilter.fOptionValue;
    const _label = _configFilter.fOptionName;
    let _options = [];
    let _subAgField = "";

    if (_configFilter.fOptionSubAg) {
      _subAgField = _configFilter.fOptionSubAg
    }

    for (let scenario of dataScenarios) {
      // open json file
      let jsonFilename = 'scenario-data/' + scenario.scnFolder + '/' + _configFilter.fOptionsJson;

      // get list of options using _value and _label fields
      try {
        let jsonData = await this.loadJsonFile(jsonFilename);

        _options = _options.concat(
          jsonData.map(object => {
              let mappedObject = {
                  value: object[_value], // Assuming these are under `properties`
                  label: object[_label]  // Adjust if they are located elsewhere
              };

              // Include `subag` only if `_subAgField` exists in the object
              if (object[_subAgField] !== undefined) {
                  mappedObject.subag = object[_subAgField];
              }

              return mappedObject;
          })
        );
      } catch (error) {
        console.error(`Error loading JSON file ${jsonFilename}:`, error);
      }
    }

    // Remove duplicates
    let uniqueOptions = [];
    let seen = new Set();
    for (let option of _options) {
      if (!seen.has(option.value)) {
        seen.add(option.value);
        uniqueOptions.push(option);
      }
    }


    if (_configFilter.fOptionSubAg){


      let combinedRecords = {};
    
      // Group records by 'value' field
      for (let record of uniqueOptions) {
        if (!combinedRecords[record.value]) {
          let option = _options.find(option => String((option.value)) === String((record.value)));

          combinedRecords[record.value] = {
            value: String(record.value),
            label: option ? option.label : 'Unknown Label',  // Handle error by setting a default label
            subag: []
          };
        }
        combinedRecords[record.value].subag.push(String(record.subag));
      }

      // Add 'All' option to each 'subag' array
      for (let key in combinedRecords) {
        if (combinedRecords.hasOwnProperty(key)) {
            combinedRecords[key].subag.unshift('All');
        }
      }

      // Convert grouped object back to array
      uniqueOptions = Object.values(combinedRecords);

    }

    // Sort by label
    uniqueOptions.sort((a, b) => a.label.localeCompare(b.label));
    this.options = uniqueOptions;
  }

  async loadJsonFile(filename) {
    const response = await fetch(filename);
    if (!response.ok) {
      throw new Error(`Failed to load JSON file: ${filename}`);
    }
    return await response.json();
  }

  initializeFilter(_configFilter) {

    // Check if 'selected' is undefined, then create a list of 'value' from 'options'
    const _selected = _configFilter.fSelected !== undefined ? _configFilter.fSelected : this.options.map(option => option.value);

    this.userModifiable = _configFilter.userModifiable === undefined ? true : _configFilter.userModifiable; // set to true if undefined

    if (_configFilter.subAgDisplayName) {
      this.filterSubAgWij = new WijSelect(this.id + '-subag', _configFilter.subAgDisplayName, _configFilter.subAgSelected, _configFilter.subAgOptions, this.vizLayout, true, _configFilter.subTotals);
    }
  
    if (_configFilter.fWidget === 'select') {
      this.filterWij = new WijSelect(this.id, this.name, _selected, this.options, this.vizLayout, true, _configFilter.subTotals);
    } else if (_configFilter.fWidget === 'radio') {
      this.filterWij = new WijRadio(this.id, this.name, _selected, this.options, this.vizLayout, "", true);
    } else if (_configFilter.fWidget === 'checkboxes') {
      this.filterWij = new WijCheckboxes(this.id, this.name, _selected, this.options, this.vizLayout, true);
    } else if (_configFilter.fWidget === 'combobox') {
      this.filterWij = new WijCombobox(this.id, this.name, _selected, this.options, this.vizLayout, true);
    }
  }


  render() {

    const filterContainer = document.createElement('div');
    filterContainer.id = this.id;

    if (this.geoJsonInfo && Object.keys(this.geoJsonInfo).length > 0) {
      // Add the map popup button
      filterContainer.appendChild(this.renderMapPopupButton());
    }

    // only render if the user can modify widget... otherwise needed settings are all preserved in object
    if (this.userModifiable) {
      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        filterContainer.appendChild(this.filterSubAgWij.render());
      }
      
      filterContainer.appendChild(this.filterWij.render());
    }
    return filterContainer;
  }

  renderMapPopupButton() {
    const mapButton = document.createElement('calcite-button');
    mapButton.innerText = "Reference Map";
    mapButton.classList.add('reference-map-button');
    mapButton.onclick = () => this.openMapPopup();
  
    // Create a line break element
    const lineBreak = document.createElement('br');
  
    // Create a container div if needed
    const container = document.createElement('div');
    container.appendChild(mapButton);
    container.appendChild(lineBreak);
    container.appendChild(lineBreak);
    return container;
  }

  openMapPopup() {
    const mapPopup = document.getElementById("mapPopup");
    mapPopup.style.display = "block";
    
    if (!this.isMapInitialized) {
      mapPopup.innerHTML = "";
      mapPopup.style.boxSizing = "border-box";
      mapPopup.style.position = "fixed";
      mapPopup.style.padding = "0"; // Remove padding to avoid overflow issues
  
      // Close button
      const closePopup = document.createElement("div");
      closePopup.innerText = "Close";
      closePopup.style.position = "absolute";
      closePopup.style.top = "10px";
      closePopup.style.right = "10px";
      closePopup.style.zIndex = "3000";
      closePopup.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
      closePopup.style.padding = "5px 10px";
      closePopup.style.cursor = "pointer";
      closePopup.onclick = () => this.closeMapPopup();
      mapPopup.appendChild(closePopup);
  
      // Header (for dragging)
      const header = document.createElement("div");
      header.style.position = "absolute";
      header.style.top = "0";
      header.style.left = "0";
      header.style.width = "100%";
      header.style.height = "60px"; // Adjusted height of the header
      header.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
      header.style.cursor = "move";
      header.style.padding = "10px"; // Padding for content within header
      header.style.boxSizing = "border-box"; // Ensures padding doesn't increase header width
      header.style.zIndex = "1000"; // Ensures header is above the map
      header.innerHTML = "<h1>Reference Map</h1>";
      mapPopup.appendChild(header);
  
      // Map container
      const mapDiv = document.createElement("div");
      mapDiv.id = "mapDiv";
      mapDiv.style.position = "absolute";
      mapDiv.style.top = "60px"; // Position it below the header
      mapDiv.style.width = "100%";
      mapDiv.style.height = "calc(100% - 70px)"; // Leaves space for header and padding
      mapDiv.style.padding = "10px"; // Padding for content within mapDiv
      mapDiv.style.boxSizing = "border-box"; // Ensures padding doesn't increase mapDiv width
      mapPopup.appendChild(mapDiv);  
  
      // Initialize the map
      this.initializeMap(mapDiv);
      this.isMapInitialized = true;
  
      // Make the popup draggable via the header only
      this.makePopupDraggable(mapPopup, header);
      // Make the popup resizable
      this.makePopupResizable(mapPopup);
    }
  }
  
  // Function to make popup draggable, restricted to header
  makePopupDraggable(popup, dragHandle) {
    let isDragging = false;
    let offsetX, offsetY;
  
    dragHandle.addEventListener("mousedown", function (event) {
      isDragging = true;
      offsetX = event.clientX - popup.offsetLeft;
      offsetY = event.clientY - popup.offsetTop;
  
      document.onmousemove = function (event) {
        if (isDragging) {
          popup.style.left = event.clientX - offsetX + "px";
          popup.style.top = event.clientY - offsetY + "px";
        }
      };
  
      document.onmouseup = function () {
        isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
      };
    });
  }
  
  // Function to make popup resizable
  makePopupResizable(popup) {
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "resize-handle";
    resizeHandle.style.width = "10px";
    resizeHandle.style.height = "10px";
    resizeHandle.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    resizeHandle.style.position = "absolute";
    resizeHandle.style.right = "0";
    resizeHandle.style.bottom = "0";
    resizeHandle.style.cursor = "se-resize"; // Ensure cursor style here
    resizeHandle.style.zIndex = "3000";

    popup.appendChild(resizeHandle);

    resizeHandle.addEventListener("mousedown", function (event) {
      event.stopPropagation();

      // Disable text selection during resize
      document.body.classList.add("no-select");

      // Apply se-resize cursor during resizing
      document.body.style.cursor = "se-resize";

      const startWidth = popup.offsetWidth;
      const startHeight = popup.offsetHeight;
      const startX = event.clientX;
      const startY = event.clientY;

      document.onmousemove = function (event) {
        popup.style.width = startWidth + (event.clientX - startX) + "px";
        popup.style.height = startHeight + (event.clientY - startY) + "px";
      };

      document.onmouseup = function () {
        document.onmousemove = null;
        document.onmouseup = null;

        // Re-enable text selection and reset cursor after resizing
        document.body.classList.remove("no-select");
        document.body.style.cursor = "default";
      };
    });
  }
  
  closeMapPopup() {
    const mapPopup = document.getElementById("mapPopup");
    if (mapPopup) {
      mapPopup.style.display = "none";
    }
  }

  initializeMap(container) {
    require(["esri/Map", "esri/views/MapView", "esri/layers/GeoJSONLayer"], (Map, MapView, GeoJSONLayer) => {
      const map = new Map({
        basemap: "gray-vector"
      });
  
      this.mapView = new MapView({
        container: container,
        map: map,
        center: [-111.891, 40.7608], // Salt Lake City coordinates
        zoom: 9 // Initial zoom level
      });
  
      let url;
  
      const scenarioWithData = getFirstScenarioWithGeoJsonData(this.geoJsonInfo.agGeoJsonKey);
      if (scenarioWithData) {
        url = scenarioWithData.getGeoJsonFileNameFromKey(this.geoJsonInfo.agGeoJsonKey);
      }
      
      // Initialize counter for color cycling
      let counterColor = 0;

      // Function to get the next color in the sequence
      const getColor = (() => {
        const colors = [
          'rgba( 75, 210, 192, 0.75)', // Teal
          'rgba( 54, 162, 225, 0.75)', // Blue
          'rgba(255,  99, 132, 0.75)', // Pink/Red
          'rgba(255, 216,  96, 0.75)', // Yellow
          'rgba(153, 102, 255, 0.75)', // Purple
          'rgba(255, 159,  64, 0.75)', // Orange
          'rgba(  0, 128, 128, 0.75)', // Dark Teal
          'rgba(128,   0, 128, 0.75)', // Dark Purple
          'rgba(255,  69,   0, 0.75)', // Red-Orange
          'rgba(  0, 128,   0, 0.75)', // Green
          'rgba(  0,   0, 128, 0.75)', // Navy Blue
          'rgba(128, 128,   0, 0.75)', // Olive
          'rgba(128,   0,   0, 0.75)', // Maroon
          'rgba(  0, 255, 127, 0.75)', // Spring Green
          'rgba( 70, 130, 180, 0.75)', // Steel Blue
          'rgba(255, 215,   0, 0.75)', // Gold
          'rgba(255, 140,   0, 0.75)', // Dark Orange
          'rgba(123, 104, 238, 0.75)', // Medium Slate Blue
          'rgba( 34, 139,  34, 0.75)', // Forest Green
          'rgba(220,  20,  60, 0.75)'  // Crimson
        ];

        return () => {
          const color = colors[counterColor % colors.length];
          counterColor++;
          return color;
        };
      })();

      // Fetch the GeoJSON data first to check its geometry type
      fetch('geo-data/' + url)
        .then(response => response.json())
        .then(data => {
          const geoType = data.features && data.features[0] && data.features[0].geometry.type;

          // Use UniqueValueRenderer to assign a random color to each feature
          const uniqueValueInfos = data.features.map((feature, index) => ({
            value: feature.properties[this.geoJsonInfo.agCodeLabelField] || index,
            symbol: geoType === "LineString" || geoType === "MultiLineString" 
              ? {
                  type: "simple-line", // For polyline
                  color: getColor(), // Random color for each line
                  width: 2
                }
              : {
                  type: "simple-fill", // For polygon fill
                  color: getColor(), // Random color fill
                  outline: {
                    color: [255, 255, 255, 1], // White outline
                    width: 1
                  }
                }
          }));

          // Define the GeoJSONLayer with UniqueValueRenderer
          const geojsonLayer = new GeoJSONLayer({
            url: 'geo-data/' + url,
            title: "My GeoJSON Layer",
            renderer: {
              type: "unique-value", // Unique renderer for individual colors
              field: this.geoJsonInfo.agCodeLabelField, // Field to distinguish features
              uniqueValueInfos: uniqueValueInfos
            },
            labelingInfo: [
              {
                symbol: {
                  type: "text", // Defines it as a text symbol
                  color: "black",
                  haloColor: "white",
                  haloSize: 2,
                  font: {
                    size: 14,
                    family: "sans-serif"
                  }
                },
                labelPlacement: "always-horizontal", // Ensures the label is placed within the polygon
                labelExpressionInfo: {
                  expression: "$feature." + this.geoJsonInfo.agCodeLabelField
                }
              }
            ]
          });

          // Add the layer to the map (assuming you have a map instance)
          map.add(geojsonLayer);
          
          // Once the layer is loaded, zoom to its full extent
          geojsonLayer.when(() => {
            if (geojsonLayer.fullExtent) {
              this.mapView.goTo(geojsonLayer.fullExtent).catch(error => {
                console.error("Error zooming to GeoJSON extent:", error);
              });
            }
          });
        })
        .catch(error => console.error('Error loading GeoJSON:', error));
  
    });
  }

  afterUpdateSubAg() {
    this.filterWij.applySubAg(this.filterSubAgWij.selected);
  }

  getSelectedOptionsAsList() {
    return this.filterWij.getSelectedOptionsAsList();
  }

  getSelectedOptionsAsListOfLabels() {
    return this.filterWij.getSelectedOptionsAsListOfLabels();
  }

  isVisible() {
    if (this.userModifiable) {
      //Debug
      //console.log('debug filter isVisible containerId: ' + this.filterWij.containerId)
      const element = document.getElementById(this.filterWij.containerId);

      // Error checking: Ensure the element exists and has a valid style property
      if (!element) {
        console.log(`Element with ID ${this.filterWij.containerId} not found.`);
        return false; // Return false or handle the case appropriately
      }
      
      if (!element.style) {
        console.log(`Element with ID ${this.filterWij.containerId} does not have a style property.`);
        return false; // Return false or handle the case appropriately
      }
      
      return element.style.display !== 'none';
    } else {  // if not userModifiable, we need to act like it is being displayed anyway
      return true;
    }
  }

  hide() {
    if (this.userModifiable) {
      console.log('hide: ' + this.filterWij.id);
      document.getElementById(this.filterWij.containerId).style.display = 'none';
  
      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        document.getElementById(this.filterSubAgWij.containerId).style.display = 'none';
      }
    }
  }

  show() {
    if (this.userModifiable) {
      console.log('show: ' + this.filterWij.id);
      document.getElementById(this.filterWij.containerId).style.display = 'block';
      
      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        document.getElementById(this.filterSubAgWij.containerId).style.display = 'block';
      }
    }
  }

}