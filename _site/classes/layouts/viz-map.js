require([
  "esri/layers/GeoJSONLayer",
  "esri/Graphic",
  "esri/layers/FeatureLayer",
  "esri/renderers/ClassBreaksRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/renderers/SimpleRenderer",
  "esri/renderers/visualVariables/ColorVariable",
  "esri/symbols/SimpleLineSymbol",
  "esri/Color",
  "esri/PopupTemplate",
  "esri/widgets/Legend",
  "esri/rest/support/Query"
], function(GeoJSONLayer, Graphic, FeatureLayer, ClassBreaksRenderer, UniqueValueRenderer, SimpleRenderer, ColorVariable, SimpleLineSymbol, Color, PopupTemplate, Legend, Query) {
  // Now you can use Graphic inside this callback function

  class VizMap {
    constructor(data, layerTitle) {
      this.id = data.id || this.generateIdFromText(data.attributeTitle); // use provided id or generate one if not provided
      this.sidebarDiv = "sidebarContent";
      this.baseGeometryFile = data.baseGeometryFile;
      this.baseGeoField = data.baseGeoField;
      this.geometryType = data.geometryType;
      this.popupTitle = data.popupTitle;
      this.attributeTitle = data.attributeTitle;
      this.attributes = (data.attributes || []).map(item => new Attribute(item));
      this.attributeSelect = new WijRadio(this.id & "_attribute-selector", data.attributes.map(item => ({
        value: item.aCode,
        label: item.aDisplayName
      })), data.attributeSelected, data.hidden, data.attributeTitle, this);
      this.filters = (data.filters || []).map(item => new Filter(item, this));
      this.layerTitle = layerTitle;
      this.layerDisplay = new FeatureLayer();
      this.initListeners();
      this.aggregators = (data.aggregators || []).map(item => new Aggregator(item));
      // Check if data.aggregator exists before initializing aggregatorSelect
      if (data.aggregators) {
        this.aggregatorSelect = new WijSelect(this.id + "_aggregator-selector", data.aggregators.map(item => ({
          value: item.agCode,
          label: item.agDisplayName
        })), data.aggregatorSelected, false, data.aggregatorTitle, this);
      }

      // Global variable to store original label info
      this.originalLabelInfo = null;

      // ADD GEOJSONS
      // need to check geometry type before adding!!
      this.geojsonLayer = new GeoJSONLayer({
        url: this.baseGeometryFile,
        title: "Zone Aggregation"
      });
      map.add(this.geojsonLayer);
      this.geojsonLayer.visible = false;

      
      // Get GEOJSON NON-GEOMTRY FOR EASY QUERYING
      // Read JSON file
      fetch(this.baseGeometryFile)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
      })
      .then(data => {
        this.baseGeometryGeoJson = data;

          // Now call the rest of your code that depends on this.aggregatorGeoJson
          // For example, you might need to refactor the remaining code into a new function and call it here
      })
      .catch(error => {
        console.error('Error reading the JSON file:', error);
        // Handle the error appropriately
        });


    }

    hideLayout() {
      console.log('hideLayout');

    }
    
    generateIdFromText(text) {
      console.log('generateIdFromText');
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    
    getScenario(_modVersion, _scnGroup, _scnYear) {
      return dataScenarios.find(scenario =>
        scenario.modVersion === _modVersion &&
        scenario.scnGroup   === _scnGroup   &&
        scenario.scnYear    === _scnYear
      ) || null;
    }

    scenarioMain() {
      return this.getScenario(         document.getElementById('selectModMain' ).value,
                                       document.getElementById('selectGrpMain' ).value,
                              parseInt(document.getElementById('selectYearMain').value, 10)); // Assuming it's a number
    }

    scenarioComp() {
      return this.getScenario(         document.getElementById('selectModComp' ).value,
                                       document.getElementById('selectGrpComp' ).value,
                              parseInt(document.getElementById('selectYearComp').value, 10)); // Assuming it's a number
    }

    findAllCombinationsOfFilters(lists, prefix = '', separator = '_') {
      // If there are no more lists to process, return the current prefix as the result
      if (lists.length === 0) {
        return [prefix];
      }
  
      // Get the first list and the remaining lists
      const firstList = lists[0];
      const remainingLists = lists.slice(1);
  
      // Combine the elements of the first list with the recursive results of the remaining lists
      let combinations = [];
      firstList.forEach(element => {
          const newPrefix = prefix ? prefix + separator + element : element;
          combinations = combinations.concat(this.findAllCombinationsOfFilters(remainingLists, newPrefix, separator));
      });
  
      return combinations;
    }

    dataMain() {
      console.log('dataMain');
      if (this.attributeTitle=="Roadway Segment Attribute") {                 // for roadway segs
        return this.scenarioMain().roadwaySegData.data[this.getFilter()]
      } else if (this.attributeTitle=="Mode Share Attributes") {              // for zone mode share
        return this.scenarioMain().zoneModeData.data[this.getFilter()]
      } else if (this.attributeTitle=="Transit Segment Attribute") {          // for transit
        //return this.scenarioMain().transitSegData.data[this.getFilter()]

        // loop through attributes and get every single combination...
        
        // for each filter, add all options to list of options
        const listOfOptions = this.filters.map(filter => filter.getSelectedOptionsAsList());

        // Initialize an object to hold the aggregated sums
        let aggregatedSums = {};

        const _parent = this;

        // Modified sumFields function to handle the summing of specific attributes for each key
        function sumFields(data) {
          Object.keys(data).forEach(key => {
            if (!aggregatedSums[key]) {
              aggregatedSums[key] = {};
            }

            _parent.attributes.forEach(attr => {
              if (data[key].hasOwnProperty(attr.aCode)) {
                if (!aggregatedSums[key][attr.aCode]) {
                  aggregatedSums[key][attr.aCode] = 0;
                }
                aggregatedSums[key][attr.aCode] += data[key][attr.aCode];
              }
            });
          });
        }

        // Loop through each combination of filters
        this.findAllCombinationsOfFilters(listOfOptions).forEach(function(combo) {
          let data = _parent.scenarioMain().transitSegData.data[combo];

          // Sum the fields in the data object
          if (data) {
            sumFields(data);
          }
        });

        return aggregatedSums;
      }
    }

    dataComp() {
      console.log('dataComp');
      if (this.attributeTitle=="Roadway Segment Attribute") {                 // for roadway segs
        return this.scenarioComp().roadwaySegData.data[this.getFilter()]
      } else if (this.attributeTitle=="Mode Share Attributes") {              // for zone mode share
        return this.scenarioComp().zoneModeData.data[this.getFilter()]
      }  else if (this.attributeTitle=="Transit Segment Attribute") {          // for transit
        //return this.scenarioMain().transitSegData.data[this.getFilter()]

        // loop through attributes and get every single combination...
        
        // for each filter, add all options to list of options
        const listOfOptions = this.filters.map(filter => filter.getSelectedOptionsAsList());

        // Initialize an object to hold the aggregated sums
        let aggregatedSums = {};

        const _parent = this;

        // Modified sumFields function to handle the summing of specific attributes for each key
        function sumFields(data) {
          Object.keys(data).forEach(key => {
            if (!aggregatedSums[key]) {
              aggregatedSums[key] = {};
            }

            _parent.attributes.forEach(attr => {
              if (data[key].hasOwnProperty(attr.aCode)) {
                if (!aggregatedSums[key][attr.aCode]) {
                  aggregatedSums[key][attr.aCode] = 0;
                }
                aggregatedSums[key][attr.aCode] += data[key][attr.aCode];
              }
            });
          });
        }

        // Loop through each combination of filters
        this.findAllCombinationsOfFilters(listOfOptions).forEach(function(combo) {
          let data = _parent.scenarioComp().transitSegData.data[combo];

          // Sum the fields in the data object
          if (data) {
            sumFields(data);
          }
        });

        return aggregatedSums;
      }
    }

    // check if comparison scenario is in process of being defined... i.e. some values are not 'none'
    incompleteScenarioComp() {
      if (this.scenarioComp() === null) {
        if ((document.getElementById('selectModComp' ).value !== "none" ||
             document.getElementById('selectGrpComp' ).value !== "none" ||
             document.getElementById('selectYearComp').value !== "none" )) {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    getACode() {
      return this.attributeSelect.selected;
    }

    getWeightCode() {
      return this.attributes.find(item => item.aCode === this.getACode()).agWeightCode;
    }

    getSelectedAggregator() {

      let foundAggregator = this.aggregators.find(obj => obj.agCode === this.aggregatorSelect.selected);

      if (foundAggregator) {
        return foundAggregator;
      }

      return;
    }



    getAttributeRendererCollection() {
      return this.attributes.find(item => item.aCode === this.getACode()).rendererCollection;
    }
    
    getAttributeLabelExpressionInfo() {
      return this.attributes.find(item => item.aCode === this.getACode()).aLabelExpressionInfo;
    }

    getMainRenderer() {
      return this.getAttributeRendererCollection().main.renderer;
    }

    getCompareAbsRenderer() {
      return this.getAttributeRendererCollection().compare_abs.renderer;
    }

    getComparePctRenderer() {
      return this.getAttributeRendererCollection().compare_pct.renderer;
    }

    initializeLayer() {
      //
      let dValFieldType;

      // MANUALLY SET SCENARIO -- REPLACE WITH PROGRAMATIC SOLUTION
      if (this.getACode() === 'aFtClass') {
        dValFieldType = "string";
      } else {
        dValFieldType = "double";  // or "int" based on your requirement
      }

      if (this.geometryType=='polyline') {
        // Dummy polyline feature
        this.dummyFeature = {
          geometry: {
            type: "polyline",
            paths: [
              [-111.8910, 40.7608],
              [-111.8911, 40.7609]
            ],
            spatialReference: { wkid: 4326 }  // Specify WGS 84 spatial reference
          },
          attributes: {
            id: 0, // Unique ID, using "SEGID" as the objectIdField
            // ... add other attribute fields if necessary
            dVal: null // Assuming you want a displayValue, you can set any initial value
          }
        };

        
        this.layerDisplay = new FeatureLayer({
          source: [this.dummyFeature],
          objectIdField: this.baseGeoField,
          fields: [
            // ... your other fields
            { name: this.baseGeoField, type: "oid" },  // Object ID field
            { name: "dVal"             , type: dValFieldType, alias: this.getACode() },
            // HARD CODE... NEED TO ADD PROGRAMATICALLY
            { name: "SmallArea"        , type: "string"},
            { name: "DMED_NAME"        , type: "string"},
            { name: "DLRG_NAME"        , type: "string"},
            { name: "DISTANCE"         , type: "double"}

          ],
          popupTemplate: {
            title: this.popupTitle,
            content: [
              {
                type: "text",
                text: this.baseGeoField + " {expression/baseGeoField}"
              },
              {
                type: "text",
                text: this.getACode() + " is: {expression/formatDisplayValue}"
              }
            ],
            expressionInfos: [
              {
                name: "baseGeoField",
                title: this.baseGeoField,
                expression: "$feature." + this.baseGeoField
              },
              {
                name: "formatDisplayValue",
                title: "Formatted Display Value",
                expression: this.getAttributeLabelExpressionInfo()
              }
            ]
          },
          labelingInfo: [{
            symbol: {
              type: "text",  // Use a text symbol for labeling
              color: [50, 50, 50],  // Dark grey color
              haloColor: "white",
              haloSize: "2px",  // Halo size of 2px
              font: {  // Define the font used for labeling
                family: "sans-serif",
                size: 9,
                weight: "normal"  // Make the font weight normal (not bold)
              }
            },
            labelPlacement: "center-along",  // Define where to place the label
            labelExpressionInfo: { expression: this.getAttributeLabelExpressionInfo() }  // Define the expression for the label
          }],
          renderer: {
            type: "simple",  // Use a simple renderer
            symbol: {
              type: 'simple-line',
              color: [255, 255, 255],
              width: 0.2
            }
          }
        });
        map.add(this.layerDisplay);

      } else if (this.geometryType=='polygon') {
        // Dummy polygon feature representing an area encompassing Salt Lake City and Provo
        this.dummyFeature = {
          geometry: {
            type: "polygon",
            rings: [
              [-111.8910, 40.7608], // Start at Salt Lake City
              [-111.8911, 40.7609], // A point near Provo
              [-111.8912, 40.7610], // An additional point to make it a polygon, could be another city or arbitrary coordinate
              [-111.8910, 40.7608]  // End at Salt Lake City to close the loop
            ],
            spatialReference: { wkid: 4326 }  // Specify WGS 84 spatial reference
          },
          attributes: {
            id: 0, // Unique ID, using "SEGID" as the objectIdField
            // ... add other attribute fields if necessary
            dVal: null // Assuming you want a displayValue, you can set any initial value
          }
        };

        this.layerDisplay = new FeatureLayer({
          source: [this.dummyFeature],
          objectIdField: this.baseGeoField,
          fields: [
            // ... your other fields
            { name: this.baseGeoField, type: "oid" },  // Object ID field
            { name: "dVal"             , type: dValFieldType, alias: this.getACode() },
            // HARD CODE... NEED TO ADD PROGRAMATICALLY
            { name: "SmallArea"        , type: "string"},
            { name: "DMED_NAME"        , type: "string"},
            { name: "DLRG_NAME"        , type: "string"},
            { name: "DISTANCE"         , type: "double"}

          ],
          popupTemplate: {
            title: this.popupTitle,
            content: [
              {
                type: "text",
                text: this.baseGeoField + " {expression/baseGeoField}"
              },
              {
                type: "text",
                text: this.getACode() + " is: {expression/formatDisplayValue}"
              }
            ],
            expressionInfos: [
              {
                name: "baseGeoField",
                title: this.baseGeoField,
                expression: "$feature." + this.baseGeoField
              },
              {
                name: "formatDisplayValue",
                title: "Formatted Display Value",
                expression: this.getAttributeLabelExpressionInfo()
              }
            ]
          },
          labelingInfo: [{
            symbol: {
              type: "text",  // Use a text symbol for labeling
              color: [50, 50, 50],  // Dark grey color
              haloColor: "white",
              haloSize: "2px",  // Halo size of 2px
              font: {  // Define the font used for labeling
                family: "sans-serif",
                size: 10,
                weight: "normal"  // Make the font weight normal (not bold)
              }
            },
            labelPlacement: "always-horizontal",  // Define where to place the label
            labelExpressionInfo: { expression: this.getAttributeLabelExpressionInfo() }  // Define the expression for the label
          }],
          renderer: {
            type: "simple",  // Use a simple renderer
            symbol: {
              type: "simple-fill",  // Use a fill symbol for polygons
              color: [0, 0, 0, 0],  // No fill color (transparent)
              outline: {  // Define the outline of the polygon
                color: [255, 255, 255],  // Outline color (black)
                width: 0.2  // Outline width
              }
            }
          }
        });
        map.add(this.layerDisplay);
      }
    }
    // get the current filter
    getFilter() {

      var _filterGroup = [];

      if (this.attributeTitle == "Roadway Segment Attribute") {                 // for roadway segs
        _filterGroup = this.scenarioMain().roadwaySegData.attributes.find(item => item.aCode === this.getACode())?.filterGroup;
      } else if (this.attributeTitle == "Mode Share Attributes") {              // for zone mode share
        _filterGroup = this.scenarioMain().zoneModeData.attributes.find(item => item.aCode === this.getACode())?.filterGroup;
      } else if (this.attributeTitle == "Transit Segment Attribute") {          // for transit segs
        _filterGroup = this.scenarioMain().transitSegData.attributes.find(item => item.aCode === this.getACode())?.filterGroup;
      }
    
      // Check if _filterGroup is not undefined
      if (_filterGroup) {
        // Split the _filterGroup by "_"
        const _filterArray = _filterGroup.split("_");
        
        // Map selected options to an array and join with "_"
        const _filter = _filterArray
          .map(filterItem => {
            var _fItem = this.filters.find(item => item.id === filterItem + '_' + this.id);
            return _fItem ? _fItem.filterWij.selected : "";
          })
          .join("_");
    
        return _filter;
      }
    
      return ""; // Return an empty string or a default value if _filterGroup is undefined
    
    }

    renderSidebar() {
      const container = document.createElement('div');
      container.id = this.id + "-viz-map-sidebar";

      if (this.aggregatorSelect) {
        container.appendChild(this.aggregatorSelect.render());
      }
      container.appendChild(this.attributeSelect.render());
      this.filters.forEach(filter => {
        container.appendChild(filter.render());
      });

      var divSidebar = document.getElementById(this.sidebarDiv);
      divSidebar.innerHTML = '';
      divSidebar.appendChild(container);  // Append the new element to the container
    }

    initListeners() {
      console.log('initListeners');
      
      document.getElementById('selectModMain').addEventListener('change', this.updateDisplay.bind(this));
      document.getElementById('selectGrpMain').addEventListener('change', this.updateDisplay.bind(this));
      document.getElementById('selectYearMain').addEventListener('change', this.updateDisplay.bind(this));
      
      document.getElementById('selectModComp').addEventListener('change', this.updateDisplay.bind(this));
      document.getElementById('selectGrpComp').addEventListener('change', this.updateDisplay.bind(this));
      document.getElementById('selectYearComp').addEventListener('change', this.updateDisplay.bind(this));

      // Get all radio buttons with the name "rcPcOption"
      var radioButtons = document.querySelectorAll('input[name="rcPcOption"]');

      // Assuming this is inside a class or object with a method named this.updateDisplay()
      radioButtons.forEach(function(radio) {
        radio.addEventListener('change', (event) => {  // Arrow function here
            console.log(event.target.value);
            this.updateDisplay();
        });
      });

      document.getElementById('vizMapLabelToggle').addEventListener('change', (event) => {  // Arrow function here
        this.toggleLabels(); // Replace with the actual function or code to show labels
      });
    }


    // Function to be called when checkbox status changes
    toggleLabels() {
      var labelCheckbox = document.getElementById('vizMapLabelToggle');
      
      if (this.layerDisplay) {
        if (labelCheckbox.checked) {
          // Checkbox is checked, show labels
          // Restore labels if originalLabelInfo has been stored
          if (!this.originalLabelInfo) {
            // Set originalLabelInfo if not set previously
            this.originalLabelInfo = this.layerDisplay.labelingInfo;
          }
          this.layerDisplay.labelingInfo = this.originalLabelInfo;
        } else {
          // Checkbox is unchecked, hide labels
          // Store the current label info before hiding if not already stored
          if (!this.originalLabelInfo) {
            this.originalLabelInfo = this.layerDisplay.labelingInfo;
          }
          this.layerDisplay.labelingInfo = [];
        }
        this.layerDisplay.refresh(); // Refresh the layer to apply changes
      }
    }
    
    afterUpdateSidebar() {
      console.log('afterUpdateSidebar');
      this.updateDisplay();
      this.updateFilters();
      this.updateAggregations();
    }

    afterUpdateAggregator() {
      console.log('afterUpdateAggregator');
      
      // remove aggregator geometry
      if (this.geojsonLayer) {
        map.remove(this.geojsonLayer);
      }

      // ADD GEOJSONS
      // need to check geometry type before adding!!
      this.geojsonLayer = new GeoJSONLayer({
        url: this.getSelectedAggregator().agGeoJson,
        title: "Aggregator Layer"
      });

      // add new geometry
      map.add(this.geojsonLayer);
      this.geojsonLayer.visible = false;
      this.afterUpdateSidebar();
    }

    updateFilters() {
      console.log('updateFilters');
      
      var _filterGroup = [];
    
      if (this.attributeTitle == "Roadway Segment Attribute") {                 // for roadway segs
        _filterGroup = this.scenarioMain().roadwaySegData.attributes.find(item => item.aCode === this.getACode())?.filterGroup;
      } else if (this.attributeTitle == "Mode Share Attributes") {              // for zone mode share
        _filterGroup = this.scenarioMain().zoneModeData.attributes.find(item => item.aCode === this.getACode())?.filterGroup;
      }
    
      // Select all elements with an 'id' containing '_filter_container'
      const filteredDivs = Array.from(document.querySelectorAll("div[id$='_" + this.id + "_filter_container']"));
    
      if (_filterGroup) {
        // Split the _filterGroup by "_"
        const _filterArray = _filterGroup.split("_");
        
        filteredDivs.forEach(divElement => {
          const containsFilterText = _filterArray.some(filterText => divElement.id.includes(filterText));
          divElement.style.display = containsFilterText ? 'block' : 'none';
        });
      } else {
        console.log('_filterGroup is null or undefined. Hiding all divs.');
        // Hide all divs if _filterGroup is null or undefined
        filteredDivs.forEach(divElement => {
          divElement.style.display = 'none';
        });
      }
    }
    

    updateAggregations() {
      console.log('updateAggregations');
      
      const aggNumeratorSelect = document.getElementById('aggNumerator');

      if (aggNumeratorSelect === null || typeof aggNumeratorSelect === 'undefined') {
        return;
      }
    

      const selectedOption = aggNumeratorSelect.querySelector('calcite-option[selected]');
      
      var aggNumeratorContent = "";

      if (selectedOption) {
        aggNumeratorContent = selectedOption.textContent || selectedOption.innerText;
        console.log(aggNumeratorContent); // Outputs the text content of the selected option
      } else {
        console.error('No option selected in aggNumerator.');
      }

      const aggDenominatorInput = document.getElementById('aggDenominator');

      // get aggregation numberator
      const aggNumerator = selectedOption.value;
      const aggDenominator = aggDenominatorInput.value;

      // Query the features
      var query = new Query();
      query.where = "1=1"; // Get all features. Adjust if you need a different condition.
      query.returnGeometry = false; // We don't need geometries for aggregation.
      query.outFields = [aggNumerator, "dVal", "DISTANCE"];
  
      this.layerDisplay.queryFeatures(query).then(function(results) {
        var sumDistXVal  = {};
        var sumDist      = {}; // For storing distances
        var aggDistWtVal = {};
        
        results.features.forEach(function(feature) {
          var agg = feature.attributes[aggNumerator];
          var distxval = feature.attributes.dVal * feature.attributes.DISTANCE;
          var dist = feature.attributes.DISTANCE;
      
          // Check if agg already exists in the objects
          if (sumDistXVal[agg]) {
            sumDistXVal[agg] += distxval;
            sumDist    [agg] += dist;
          } else {
            sumDistXVal[agg] = distxval;
            sumDist    [agg] = dist;
          }
        });
        
        // Calculate aggDistWtVal for each key
        for (var key in sumDistXVal) {
          aggDistWtVal[key] = sumDistXVal[key] / sumDist[key];
        }
        
                        
        // Sort the keys based on their values in aggDistWtVal in descending order
        var sortedKeys = Object.keys(aggDistWtVal).sort(function(a, b) {
          return aggDistWtVal[b] - aggDistWtVal[a];
        });

        // Construct a new object with sorted keys
        var sortedAggDistWtVal = {};
        for (var i = 0; i < sortedKeys.length; i++) {
          sortedAggDistWtVal[sortedKeys[i]] = aggDistWtVal[sortedKeys[i]];
        }

        // Do something with the aggDistWtVal...
        console.log(aggDistWtVal);
        //table.style.fontSize = "0.8em"; // For smaller text

        // Create a new table element
        var table = document.createElement("table");
        
        // Create the table header
        var thead = table.createTHead();
        var headerRow = thead.insertRow();
        var th1 = document.createElement("th");
        th1.textContent = aggNumeratorContent;
        headerRow.appendChild(th1);
        var th2 = document.createElement("th");
        th2.textContent = "";
        //switch(this.getACode()) {
        //  case 'aLanes':
        //    th2.textContent = "Lane Miles";
        //    break;
        //  case 'aFt':
        //    th2.textContent = "FT x Distance";
        //    break;
        //  case 'aFtClass':
        //    th2.textContent = "ERROR";
        //    break;
        //  case 'aCap1HL':
        //    th2.textContent = "Cap x Distance";
        //    break;
        //  case 'aVc' :
        //    th2.textContent = "VC x Distance";
        //    break;
        //  case 'aVol':
        //    th2.textContent = "VMT";
        //    break;
        //  case 'aSpd':
        //  case 'aFfSpd':
        //    th2.textContent = "Spd x Distance";
        //    break;
        //}
        headerRow.appendChild(th2);

        const formatNumber = (num) => {
          return num.toLocaleString('en-US', {
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
          });
        }

        // Populate the table with data
        for (var key in sortedAggDistWtVal) {
          var row = table.insertRow();
          var cell1 = row.insertCell();
          cell1.textContent = key;
          var cell2 = row.insertCell();
          //cell2.style.textAlign = "right"; // Right-justify the text
          cell2.textContent = formatNumber(sortedAggDistWtVal[key]);
        }

        // Append the table to the container div
        var container = document.getElementById("tableContainer");
        container.innerHTML = '';
        container.appendChild(table);

      }).catch(function(error) {
          console.error("There was an error: ", error);
      });

    }

    updateDisplay() {
      console.log('updateDisplay');
      
      // Reinitialize the layer with the current features array
      map.remove(this.layerDisplay);

      // remove other vizMap displays??? MAYBE ADD HERE
      
      //let _filter = this.getFilter();

      // get main data
      var _dataMain = this.dataMain();

      let mode = 'base'; //default is base

      // get compare data
      if (this.scenarioComp() !== null) {
        mode = 'compare';
        var _dataComp = this.dataComp();
      }

      // check if comp scenario values are complete. if selection is incomplete, then do not map
      if (this.incompleteScenarioComp()) {
        return;
      }

      this.initializeLayer();

      const _aCode = this.getACode();

      const setRendererAndLegend = () => {

        if (_aCode.substring(0, 2) === "aS" & this.attributeTitle =="Mode Share Attributes") {
          if (mode==='base') {
            // Define the color ramp from yellow to blue
            var colorVisVar = new ColorVariable({
              field: "dVal", // replace with the field name of your data
              stops: [
                { value: 0.0001, color: new Color("#FFFF00") }, // Yellow
                { value: 1.0000, color: new Color("#0000FF") }  // Blue
              ]
            });
          }
          else if (mode==='compare') {
            var colorVisVar = {
              type: "color",
              field: "dVal", // Replace with your field name
              stops: [
                { value: -0.25, color: "red", label: "< -0.25" },
                { value: 0, color: "#d3d3d3", label: "0" }, // Lighter grey color
                { value: 0.25, color: "blue", label: "> 0.25" }
              ],
              // Optional: Include normalizationField, minValue, maxValue, etc., if needed
            };
          }

          // Create a simple renderer and apply the visual variable
          this.layerDisplay.renderer = new SimpleRenderer({
            symbol: {
              type: "simple-fill", // Use "simple-marker" for point layers
              outline: {
                // You can adjust the outline properties as needed
                color: "white",
                width: 0.2
              }
            },
            visualVariables: [colorVisVar]
          });
        } else {
          if (mode==='base') {
            this.layerDisplay.renderer = this.getMainRenderer();
          } else if (mode==='compare') {
            this.layerDisplay.renderer = this.getCompareAbsRenderer() 
          }
        }

        this.layerDisplay.refresh();
        this.layerDisplay.visible = true;
          
        this.layerDisplay.queryFeatures().then(function(results) {
          console.log("Total number of features in layer:", results.features.length);
        });

        if (this.legend) {
          mapView.ui.remove(this.legend);
        }

        this.legend = new Legend({
          view: mapView,
          layerInfos: [{
            layer: this.layerDisplay,
            title: this.popupTitle// + (_filter !== "" ? " - Filtered by " + _filter : "")
          }]
        });
        mapView.ui.add(this.legend, "bottom-right");
        
        // toggle labels based on checkbox
        this.originalLabelInfo = this.layerDisplay.labelingInfo;
        this.toggleLabels();

      };

      const vizMapInstance = this;

      // GET MAP FEATURES

      this.geojsonLayer.when(() => {
        this.geojsonLayer.queryFeatures().then((result) => {
          let graphicsToAdd = [];  // Temporary array to hold graphics


          // there will be two pathways
          // A: one with new aggregation possible this.aggregator is empty
          //    loop through geojsonLayer features
          //    one-to-one relationship with json data
          //    add data to feature
          // B: one with aggregation
          //    loop through geojsonLayer features
          //    get agg id
          //    find matching json records
          //    aggregate
          //    add data to feature

          
          // NO AGGREGATOR
          if (this.aggregators.length === 0 || (this.getSelectedAggregator() && this.getSelectedAggregator().agCode == this.baseGeoField)) {
            
            result.features.forEach((feature) => {

              // Get ID from the feature's attributes
              var _id = feature.attributes[this.baseGeoField];
                                          
              var _valueMain = 0;
              var _valueComp = 0;
              var _valueDisp = 0;

              // main value
              if (_dataMain!==undefined) {
                if (_dataMain[_id]) {
                  _valueMain = _dataMain[_id][_aCode];
                }
              }

              // comp value
              if (_dataComp!==undefined) {
                if (_dataComp[_id]) {
                _valueComp = _dataComp[_id][_aCode];
                }
              }

              var selectedRadio = document.querySelector('input[name="rcPcOption"]:checked');
              var curPCOption = selectedRadio ? selectedRadio.value : null;

              // calculate final display value based on selection (absolute or change)
              try {
                if (curPCOption=='abs') { // absolute change
                _valueDisp = _valueMain - _valueComp;
                } else if (curPCOption=='pct') { // percent change
                  if (_valueComp>0) _valueDisp = ((_valueMain - _valueComp) / _valueComp) * 100;
                }
              } catch(err) {
                _valueDisp = _valueMain;
              }

              var attributes;

              // If there's a display value for the given SEGID in the _dataMain object, set it
              if (_valueMain>0) {
                attributes = {
                  ...feature.attributes,
                  dVal: _valueDisp  // Add the dVal to attributes
                };
              } else {
                attributes = {
                  ...feature.attributes,
                  dVal: null  // Add the dVal to attributes
                };
              }

              // Create a new graphic with the updated attributes
              var graphic = new Graphic({
                geometry: feature.geometry,
                attributes: attributes
              });

              graphicsToAdd.push(graphic);  // Add graphic to the temporary array
            

            });

          // B: Aggregator
          } else if (this.baseGeometryGeoJson.features) {

            const _idAgFieldName = this.getSelectedAggregator().agCode;
            const _wtCode = this.getWeightCode();

            // go through display geometry features
            result.features.forEach((feature) => {

              var _valueMain = 0;
              var _valueComp = 0;
              var _valueDisp = 0;
              var _valueMainXWt = 0;
              var _valueCompXWt = 0;
              var _valueMainSumWt = 0;
              var _valueCompSumWt = 0;

              // Get ID from the feature's attributes
              var _idAg = feature.attributes[_idAgFieldName];
              
              // get associated json records for given aggregator
              let _featuresToAg = this.baseGeometryGeoJson.features.filter(feature => 
                feature.properties[_idAgFieldName] === _idAg
              );

              // aggregate json data for give display feature
              _featuresToAg.forEach((baseFt) => {
                
                const _idFt = baseFt.properties[this.baseGeoField];

                // main value
                if (_dataMain!==undefined) {
                  if (_dataMain[_idFt]) {
                    if (_dataMain[_idFt][_aCode]) {
                      if (!_wtCode) {
                        _valueMain += _dataMain[_idFt][_aCode];
                      } else {
                        var _wtMain = _dataMain[_idFt][_wtCode];
                        if (_wtMain) {
                          _valueMainXWt +=  _dataMain[_idFt][_aCode] * _wtMain;
                          _valueMainSumWt += _wtMain;
                        }
                      }
                    }
                  }
                }
                
                // comp value
                if (_dataComp!==undefined) {
                  if (_dataComp[_idFt]) {
                    if (_dataComp[_idFt][_aCode]) {
                      if (!_wtCode) {
                        _valueComp += _dataComp[_idFt][_aCode];
                      } else {
                        var _wtComp = _dataComp[_idFt][_wtCode];
                        if (_wtComp) {
                          _valueCompXWt +=  _dataComp[_idFt][_aCode] * _wtComp;
                          _valueCompSumWt += _wtComp;
                        }
                      }
                    }
                  }
                }
              });

              if (_wtCode) {
                if (_valueMainSumWt>0) {
                  _valueMain = _valueMainXWt / _valueMainSumWt;
                }
                if (_valueCompSumWt>0) {
                  _valueComp = _valueCompXWt / _valueCompSumWt;
                }
              }

              var selectedRadio = document.querySelector('input[name="rcPcOption"]:checked');
              var curPCOption = selectedRadio ? selectedRadio.value : null;

              // calculate final display value based on selection (absolute or change)
              try {
                if (curPCOption=='abs') { // absolute change
                _valueDisp = _valueMain - _valueComp;
                } else if (curPCOption=='pct') { // percent change
                  if (_valueComp>0) _valueDisp = ((_valueMain - _valueComp) / _valueComp) * 100;
                }
              } catch(err) {
                _valueDisp = _valueMain;
              }
              
              // If there's a display value for the given SEGID in the _dataMain object, set it
              let attributes = {
                ...feature.attributes,
                dVal: _valueDisp  // Add the dVal to attributes
              };

              // Create a new graphic with the updated attributes
              var graphic = new Graphic({
                geometry: feature.geometry,
                attributes: attributes
              });

              graphicsToAdd.push(graphic);  // Add graphic to the temporary array

              
            });
          }

          vizMapInstance.layerDisplay.on("error", function(event){
            console.log("Layer error: ", event.error);
          });

          // Source modifications will not propagate after layer has been loaded. Please use .applyEdits() instead
          vizMapInstance.layerDisplay.applyEdits({ addFeatures: graphicsToAdd })
            .then(function(editsResult) {
              if (editsResult.addFeatureResults.length > 0) {
                console.log("Number of features added:", editsResult.addFeatureResults.length);
                // Call this AFTER adding graphics to the feature layer
                setRendererAndLegend();
                
                // update agg table
                vizMapInstance.updateFilters();
                vizMapInstance.updateAggregations();

              } else {
                console.log("No features were added.");
              }
          })
          .catch(function(error) {
            console.log("Error applying edits:", error);
          });
          // Add graphics to the FeatureLayer's source
          //vizMapInstance.layerDisplay.source.addMany(graphicsToAdd);

        });
      });

    }

    hideLayers() {
      this.layerDisplay.visible = false;
      
      if (this.legend) {
        mapView.ui.remove(this.legend);
      }
    }
    

  }
  
  // Export ModelEntity to the global scope
  // Exporting to Global Scope (Not recommended but works): If you want to make the ModelEntity class globally accessible (not a good practice but will solve the immediate issue):
  window.VizMap = VizMap;

});