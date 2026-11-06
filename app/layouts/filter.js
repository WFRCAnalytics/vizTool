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
      // spaceafter=false: no trailing <br> needed, it renders directly under filterWij's own
      // title (see render() below) inside their shared card. showTitle=false: its own label
      // (e.g. "List Route Names for") is dropped too - the bare dropdown under "Route Name"
      // reads clearly enough on its own without a second caption.
      this.filterSubAgWij = new WijSelect(this.id + '-subag', _configFilter.subAgDisplayName, _configFilter.subAgSelected, _configFilter.subAgOptions, this.vizLayout, false, _configFilter.subTotals, false, false);
    }

    // spaceafter=false throughout: each filter now gets its own card (see cardClass below)
    // whose margin-bottom already spaces it from the next filter, so the widgets' own
    // trailing <br> would just pad extra empty space at the bottom of the card.
    if (_configFilter.fWidget === 'select') {
      this.filterWij = new WijSelect(this.id, this.name, _selected, this.options, this.vizLayout, false, _configFilter.subTotals, true);
      // A lone select is a single compact row; once a subAg select is stacked above it
      // (e.g. fRouteName's "List Route Names for" mode picker) the pair needs the same
      // roomier card as checkboxes/radio so both controls read as one grouped unit.
      this.cardClass = this.filterSubAgWij ? 'filter-card' : 'filter-card-compact';
    } else if (_configFilter.fWidget === 'radio') {
      this.filterWij = new WijRadio(this.id, this.name, _selected, this.options, this.vizLayout, "", false, true);
      this.cardClass = 'filter-card';
    } else if (_configFilter.fWidget === 'checkboxes') {
      this.filterWij = new WijCheckboxes(this.id, this.name, _selected, this.options, this.vizLayout, false, true);
      this.cardClass = 'filter-card';
    } else if (_configFilter.fWidget === 'combobox') {
      this.filterWij = new WijCombobox(this.id, this.name, _selected, this.options, this.vizLayout, true);
    }
  }


  render() {

    const filterContainer = document.createElement('div');
    filterContainer.id = this.id;
    if (this.cardClass) filterContainer.classList.add(this.cardClass);

    // only render if the user can modify widget... otherwise needed settings are all preserved in object
    if (this.userModifiable) {
      const filterWijEl = this.filterWij.render();

      // Sub aggregation widget, if any (e.g. fRouteName's mode picker) - nested directly
      // under filterWij's own title, above its option list, rather than as a separate
      // captioned block stacked above the whole card. Both share this filter's one card so
      // the pair reads as "Route Name, scoped by this dropdown" instead of two things.
      if (typeof this.filterSubAgWij!='undefined') {
        const subAgEl = this.filterSubAgWij.render();
        // Marks this as the thing to hide/show alongside the option list when the card
        // collapses (see WijCheckboxes/WijSelect's own collapsible toggle handlers) - it's a
        // plain sibling of the option list, not inside it, so collapsing the list otherwise
        // left it sitting there on its own with nothing left to scope.
        subAgEl.classList.add('filter-subag-slot');
        const body = filterWijEl.querySelector('.checkbox-container');
        if (body) {
          body.parentElement.insertBefore(subAgEl, body);
        } else {
          filterWijEl.appendChild(subAgEl); // fallback for widget types without a known body element
        }
      }

      filterContainer.appendChild(filterWijEl);
    }

    if (this.geoJsonInfo && Object.keys(this.geoJsonInfo).length > 0) {
      // Add the map popup button - at the bottom of the card, below the options it applies to.
      filterContainer.appendChild(this.renderMapPopupButton());
    }
    return filterContainer;
  }

  renderMapPopupButton() {
    const mapButton = document.createElement('calcite-button');
    mapButton.innerText = "Reference Map";
    mapButton.classList.add('reference-map-button');
    mapButton.round = true; // match .check-all-toggle-button's pill shape
    mapButton.onclick = () => this.openMapPopup();

    // Create a container div if needed
    const container = document.createElement('div');
    container.appendChild(mapButton);
    return container;
  }

  openMapPopup() {
    const mapPopup = document.getElementById("mapPopup");

    // #mapPopup is a single page-level singleton shared by every view that has a "Reference
    // Map" button (vizTrends/vizMatrix/vizDashboard - see VizSidebar.usesAggregatorFilter()),
    // so where it should open depends on which view's button was just clicked: vizDashboard's
    // controls live in its right sidebar, so open toward the right there; vizTrends' controls
    // live on the left, so open toward the left there. Anything else keeps the roughly
    // centered default position.
    mapPopup.classList.remove('align-left', 'align-right');
    const template = this.vizLayout?.modelEntity?.template;
    if (template === 'vizDashboard') {
      mapPopup.classList.add('align-right');
    } else if (template === 'vizTrends') {
      mapPopup.classList.add('align-left');
    }

    mapPopup.style.display = "block";

    if (!this.isMapInitialized) {
      mapPopup.innerHTML = "";
      mapPopup.style.boxSizing = "border-box";
      mapPopup.style.position = "fixed";
      mapPopup.style.padding = "0"; // Remove padding to avoid overflow issues

      // Header - same look as the Definitions popup's header (.definitions-popup-header:
      // orange titlebar, white "x" close) instead of a semi-transparent overlay with its own
      // ad-hoc floating "Close"/"Clear All" divs, so both popups (and the splash modal's
      // .modal-titlebar) read as the same kind of thing. Kept absolutely positioned (not
      // flex, like #definitionsPopup) since mapDiv's own "top: 60px" below still depends on a
      // fixed-height header sitting above it.
      const header = document.createElement("div");
      header.className = "definitions-popup-header";
      header.style.position = "absolute";
      header.style.top = "0";
      header.style.left = "0";
      header.style.width = "100%";
      header.style.height = "60px";
      header.style.boxSizing = "border-box";
      header.style.zIndex = "1000";
      header.style.borderRadius = "6px 6px 0 0";

      const heading = document.createElement("h1");
      heading.innerText = "Reference Map";
      header.appendChild(heading);

      // Grouped together so header's flex space-between treats "title" and "actions" as the
      // two things it's spacing apart, instead of spacing three items apart individually
      // (which would float Clear All in the dead center of the header, away from Close).
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.alignItems = "center";
      actions.style.gap = "10px";

      // Clicking a polygon always toggles that value in/out of the associated checkbox
      // filter (Select Summary Geography), same as clicking the checkbox itself - no mode
      // toggle needed. "Clear All" resets that filter's selection from here directly.
      const clearAllBtn = document.createElement("calcite-button");
      clearAllBtn.innerText = "Clear All";
      clearAllBtn.classList.add('reference-map-button'); // same pill styling as elsewhere
      clearAllBtn.round = true;
      clearAllBtn.style.width = "auto"; // this one sits inline in the header, not full-width
      clearAllBtn.style.margin = "0";
      clearAllBtn.onclick = (event) => {
        event.stopPropagation(); // don't start a header drag
        if (this.filterWij && this.filterWij.clearAll) this.filterWij.clearAll();
        if (this.refreshReferenceMapHighlight) this.refreshReferenceMapHighlight();
      };
      actions.appendChild(clearAllBtn);

      const closePopup = document.createElement("span");
      closePopup.className = "modal-close";
      closePopup.innerHTML = "&times;";
      closePopup.onclick = (event) => {
        event.stopPropagation();
        this.closeMapPopup();
      };
      actions.appendChild(closePopup);

      header.appendChild(actions);
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
    } else {
      // Reopening an already-built map - the sidebar checkboxes may have changed since it was
      // last open (independently of a map click), so refresh which polygons show as selected.
      if (this.refreshReferenceMapHighlight) this.refreshReferenceMapHighlight();
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
      
      // Every feature is the same pastel blue with a white border - color here is only ever
      // used to show selection state (selected -> orange), not to distinguish one zone from
      // another, so a uniform fill reads more clearly than the old per-feature rainbow once
      // the selected/unselected distinction (below) needs to be the thing that stands out.
      // Fills keep some transparency so the basemap's own street names stay legible underneath.
      const COLOR_UNSELECTED = 'rgba(91, 155, 213, 0.55)';  // #5B9BD5
      const COLOR_SELECTED = 'rgba(200, 83, 39, 0.65)';     // #C85327, a touch more opaque so it stands out
      const COLOR_BORDER = 'rgba(255, 255, 255, 0.9)';

      // Fetch the GeoJSON data first to check its geometry type
      fetch('geo-data/' + url)
        .then(response => response.json())
        .then(data => {
          const geoType = data.features && data.features[0] && data.features[0].geometry.type;
          const isLine = geoType === "LineString" || geoType === "MultiLineString";
          const labelField = this.geoJsonInfo.agCodeLabelField;
          // agCode is the field that actually matches the checkbox filter's own option values
          // (e.g. DISTSML's checkboxes use "1","2",... - agCodeLabelField there is "DSML_NAME",
          // a separate pretty-display field like "Small District 001" that never matches those
          // codes). For most aggregators agCodeLabelField already equals agCode (PLANAREA,
          // CITY_NAME, TAZID, ...), so this only changes behavior for the district aggregators
          // where they differ - previously every click silently found no matching checkbox
          // (toggleFilterOptionByValue()'s "no matching checkbox" warning) and selection
          // highlighting could never match either.
          const valueField = this.geoJsonInfo.agCode;

          // Selected features (per the checkbox filter this map is paired with) turn orange
          // instead of the default blue, so the current filter state is visible on the map
          // itself - both right when it's opened and after any click toggle.
          const buildUniqueValueInfos = () => data.features.map((feature, index) => {
            const rawVal = feature.properties[valueField];
            const val = rawVal != null ? String(rawVal) : String(index);
            const isSelected = !!(this.filterWij && this.filterWij.selected && this.filterWij.selected.includes(val));
            const color = isSelected ? COLOR_SELECTED : COLOR_UNSELECTED;
            return {
              value: val,
              symbol: isLine
                ? {
                    type: "simple-line", // For polyline
                    color: color,
                    width: 2
                  }
                : {
                    type: "simple-fill", // For polygon fill
                    color: color,
                    outline: {
                      color: COLOR_BORDER,
                      width: 0.75
                    }
                  }
            };
          });

          // Define the GeoJSONLayer with UniqueValueRenderer
          const geojsonLayer = new GeoJSONLayer({
            url: 'geo-data/' + url,
            title: "My GeoJSON Layer",
            renderer: {
              type: "unique-value", // Unique renderer for individual colors
              field: valueField, // Field to distinguish features - matches the checkbox filter's
                                  // own option values, not the separate display-label field
              uniqueValueInfos: buildUniqueValueInfos()
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
                  expression: "$feature." + labelField
                }
              }
            ]
          });

          // Re-applies the renderer so selected/unselected outlines match this.filterWij's
          // current selection - called after a select-mode click, and whenever the popup is
          // reopened in case the sidebar checkboxes changed while it was closed.
          this.refreshReferenceMapHighlight = () => {
            geojsonLayer.renderer = {
              type: "unique-value",
              field: valueField,
              uniqueValueInfos: buildUniqueValueInfos()
            };
          };

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

          // Filter-by-select: clicking a polygon toggles that value in/out of the paired
          // checkbox filter, same as clicking the checkbox - always on, no mode toggle.
          this.mapView.container.style.cursor = "pointer";
          this.mapView.on("click", (event) => {
            this.mapView.hitTest(event, { include: geojsonLayer }).then((response) => {
              const result = response.results && response.results[0];
              if (!result || !result.graphic) return;
              const rawVal = result.graphic.attributes[valueField];
              const val = rawVal != null ? String(rawVal) : null;
              if (val != null) this.toggleFilterOptionByValue(val);
            });
          });
        })
        .catch(error => console.error('Error loading GeoJSON:', error));

    });
  }

  // Toggles one option's checkbox in this filter's own checkbox widget (mirroring a real
  // click on it) and refreshes the reference map's highlight to match the new selection.
  toggleFilterOptionByValue(value) {
    if (!this.filterWij) return;
    const checkbox = document.getElementById(this.filterWij.id + '-chk-' + value);
    if (!checkbox) {
      console.warn('toggleFilterOptionByValue: no matching checkbox for value', value);
      return;
    }
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('calciteCheckboxChange', { bubbles: true }));
    if (this.refreshReferenceMapHighlight) this.refreshReferenceMapHighlight();
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
      // Hide the outer card too, not just the inner widget - now that the card chrome
      // (background/border/shadow) lives on filterContainer (this.id), hiding only the
      // widget inside it left an empty, still-visible card shell.
      const outer = document.getElementById(this.id);
      if (outer) outer.style.display = 'none';
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
      const outer = document.getElementById(this.id);
      if (outer) outer.style.display = 'block';
      document.getElementById(this.filterWij.containerId).style.display = 'block';

      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        document.getElementById(this.filterSubAgWij.containerId).style.display = 'block';
      }
    }
  }

}