require([
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/BasemapToggle",
  "esri/layers/GeoJSONLayer",
  "esri/Graphic",
  "esri/layers/FeatureLayer",
  "esri/renderers/ClassBreaksRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/SimpleLineSymbol",
  "esri/Color",
  "esri/PopupTemplate",
  "esri/widgets/Legend",
  "esri/rest/support/Query"
], function(Map, MapView, BasemapToggle, GeoJSONLayer, Graphic, FeatureLayer, ClassBreaksRenderer, UniqueValueRenderer, SimpleRenderer, SimpleLineSymbol, Color, PopupTemplate, Legend, Query) {
  // Now you can use Graphic inside this callback function

  class VizMap {
    constructor(data, layerTitle) {
      this.id = data.id || this.generateIdFromText(data.attributeTitle); // use provided id or generate one if not provided
      this.mapViewDiv = data.mapViewDiv;
      this.mapOverlayDiv = data.mapOverlayDiv;
      this.sidebarDiv = data.sidebarDiv;
      this.geometryFile = data.geometryFile;
      this.geometryFileId = data.geometryFileId;
      this.geometryType = data.geometryType;
      this.popupTitle = data.popupTitle;
      this.attributeTitle = data.attributeTitle;
      this.attributes = (data.attributes || []).map(item => new Attribute(item));
      this.attributeSelect = new WijRadio(this.id & "_container", data.attributes.map(item => ({
        value: item.aCode,
        label: item.aDisplayName
      })), data.attributeSelected, data.hidden, data.attributeTitle, this);
      this.filters = (data.filters || []).map(item => new Filter(item, this));
      this.layerTitle = layerTitle;
      this.layerDisplay = new FeatureLayer();
      this.initListeners();

      // add map
      this.map = new Map({
        basemap: "gray-vector" // Basemap layerSegments service
      });
      
      this.mapView = new MapView({
        map: this.map,
        center: [-111.8910, 40.7608], // Longitude, latitude
        zoom: 10, // Zoom level
        container: data.mapViewDiv, // Div element
        popup: {
          // Popup properties here if any customizations are needed
        }
      });

      // add basemap toggle
      const basemapToggle = new BasemapToggle({
        view: this.mapView,
        nextBasemap: "arcgis-imagery"
      });
      
      this.mapView.ui.add(basemapToggle,"bottom-left");
      
      // ADD GEOJSONS
      // need to check geometry type before adding!!
      this.geojsonGeometry = new GeoJSONLayer({
        url: "data/" + this.geometryFile,
        title: this.s,
        renderer: {
          type: "simple",  // autocasts as new SimpleRenderer()
          symbol: {
            type: 'simple-line',
            color: [150, 150, 200],
            width: 1
          }
        }
      });
      this.map.add(this.geojsonGeometry);
      this.geojsonGeometry.visible = false;

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
            dVal: 0 // Assuming you want a displayValue, you can set any initial value
          }
        };
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
            dVal: 0 // Assuming you want a displayValue, you can set any initial value
          }
        };
      }
    }

    
    generateIdFromText(text) {
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

    dataMain() {
      if (this.attributeTitle=="Roadway Segment Attribute") {                 // for roadway segs
        return this.scenarioMain().roadwaySegData.data[this.getFilter()]
      } else if (this.attributeTitle=="Mode Share Attributes") {              // for zone mode share
        return this.scenarioMain().zoneModeData.data[this.getFilter()]
      }
    }
    dataComp() {
      if (this.attributeTitle=="Roadway Segment Attribute") {                 // for roadway segs
        return this.scenarioComp().roadwaySegData.data[this.getFilter()]
      } else if (this.attributeTitle=="Mode Share Attributes") {              // for zone mode share
        return this.scenarioComp().zoneModeData.data[this.getFilter()]
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

    getAttributeRendererCollection() {
      return this.attributes.find(item => item.aCode === this.getACode()).rendererCollection;
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

    // get the current filter
    getFilter() {

      var _filterGroup = [];

      if (this.attributeTitle=="Roadway Segment Attribute") {                 // for roadway segs
        _filterGroup = this.scenarioMain().roadwaySegData.attributes.find(item => item.aCode === this.getACode()).filterGroup;
      } else if (this.attributeTitle=="Mode Share Attributes") {              // for zone mode share
        _filterGroup = this.scenarioMain().zoneModeData.attributes.find(item => item.aCode === this.getACode()).filterGroup;
      }

      // Split the _filterGroup by "_"
      const _filterArray = _filterGroup.split("_");
      
      // Map selected options to an array and join with "_"
      const _filter = _filterArray
        .map(filterItem => {
          var _fItem = this.filters.find(item => item.id === filterItem);
          return _fItem ? _fItem.filterWij.selected : "";
        })
        .join("_");

      return _filter;
    }

    // get the current filter
    getFilterGroup() {

      //const _filterGroup = this.scenarioMain().roadwaySegData.attributes.find(item => item.aCode === this.getACode()).filterGroup;
      //
      //// Split the _filterGroup by "_"
      //const _filterArray = _filterGroup.split("_");
      //
      //// Map selected options to an array and join with "_"
      //const _filter = _filterArray
      //  .map(filterItem => {
      //    var _fItem = this.filters.find(item => item.id === filterItem);
      //    return _fItem ? _fItem.filterWij.selected : "";
      //  })
      //  .join("_");
      //
      //return _filter;
    }

    renderSidebar() {
      const container = document.createElement('div');
      container.id = this.id + "viz-map-sidebar";

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
      
      document.getElementById('selectModMain').addEventListener('change', this.updateMap.bind(this));
      document.getElementById('selectGrpMain').addEventListener('change', this.updateMap.bind(this));
      document.getElementById('selectYearMain').addEventListener('change', this.updateMap.bind(this));
      
      document.getElementById('selectModComp').addEventListener('change', this.updateMap.bind(this));
      document.getElementById('selectGrpComp').addEventListener('change', this.updateMap.bind(this));
      document.getElementById('selectYearComp').addEventListener('change', this.updateMap.bind(this));

      // Get all radio buttons with the name "rcPcOption"
      var radioButtons = document.querySelectorAll('input[name="rcPcOption"]');

      // Assuming this is inside a class or object with a method named this.updateMap()
      radioButtons.forEach(function(radio) {
        radio.addEventListener('change', (event) => {  // Arrow function here
            console.log(event.target.value);
            this.updateMap();
        });
      });
    }
    
    afterSidebarUpdate() {
      console.log('afterSidebarUpdate');
      this.updateMap();
      this.updateFilters();
      this.updateAggregations();
    }

    updateFilters() {
      console.log('updateFilters');
      
      var _filterGroup = [];

      if (this.attributeTitle=="Roadway Segment Attribute") {                 // for roadway segs
        _filterGroup = this.scenarioMain().roadwaySegData.attributes.find(item => item.aCode === this.getACode()).filterGroup;
      } else if (this.attributeTitle=="Mode Share Attributes") {              // for zone mode share
        _filterGroup = this.scenarioMain().zoneModeData.attributes.find(item => item.aCode === this.getACode()).filterGroup;
      }
      
      // Split the _filterGroup by "_"
      const _filterArray = _filterGroup.split("_");
    
      // Select all elements with an 'id' containing '_filter_container'
      const filteredDivs = Array.from(document.querySelectorAll('div[id*="_filter_container"]'));
    
      filteredDivs.forEach(divElement => {
        const containsFilterText = _filterArray.some(filterText => divElement.id.includes(filterText));
        divElement.style.display = containsFilterText && _filterGroup !== '' ? 'block' : 'none';
      });
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

    updateMap() {
      console.log('updateMap');
      
      // Reinitialize the layer with the current features array
      this.map.remove(this.layerDisplay);

      var _dataMain = [];
      var _dataComp = [];
      
      let _filter = this.getFilter();

      // get main data
      _dataMain = this.dataMain();

      let mode = 'base'; //default is base

      // get compare data
      if (this.scenarioComp() !== null) {
        mode = 'compare';
        _dataComp = this.dataComp();
      }

      // check if comp scenario values are complete. if selection is incomplete, then do not map
      if (this.incompleteScenarioComp()) {
        return;
      }

      //
      let dValFieldType;

      // MANUALLY SET SCENARIO -- REPLACE WITH PROGRAMATIC SOLUTION
      if (this.getACode() === 'aFtClass') {
        dValFieldType = "string";
      } else {
        dValFieldType = "double";  // or "int" based on your requirement
      }

      this.layerDisplay = new FeatureLayer({
        source: [this.dummyFeature],
        objectIdField: this.geometryFileId,
        fields: [
          // ... your other fields
          { name: this.geometryFileId, type: "oid" },  // Object ID field
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
              text: this.geometryFileId + " {expression/geometryFieldId}"
            },
            {
              type: "text",
              text: this.getACode() + " is: {expression/formatDisplayValue}"
            }
          ],
          expressionInfos: [
            {
              name: "geometryFieldId",
              title: this.geometryFieldId,
              expression: "$feature." + this.geometryFileId
            },
            {
              name: "formatDisplayValue",
              title: "Formatted Display Value",
              expression: "Text(IIF(IsEmpty($feature.dVal), 0, $feature.dVal), '#,###.0000')"
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
          labelPlacement: "above-center",  // Define where to place the label
          labelExpressionInfo: { expression: "Text(IIF(IsEmpty($feature.dVal), 0, $feature.dVal), '#,###.0000')" }  // Define the expression for the label
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
      this.map.add(this.layerDisplay);
      
      const setRendererAndLegend = () => {

        if (mode==='base') {
          this.layerDisplay.renderer = this.getMainRenderer();
        } else if (mode==='compare') {
          this.layerDisplay.renderer = this.getCompareAbsRendererRenderer() 
        }

        this.layerDisplay.refresh();
        this.layerDisplay.visible = true;

        this.layerDisplay.queryFeatures().then(function(results) {
          console.log("Total number of features in layer:", results.features.length);
        });

        if (this.legend) {
          this.mapView.ui.remove(this.legend);
        }

        this.legend = new Legend({
          view: this.mapView,
          layerInfos: [{
            layer: this.layerDisplay,
            title: this.popupTitle + (_filter !== "" ? " - Filtered by " + _filter : "")
          }]
        });
        this.mapView.ui.add(this.legend, "bottom-right");
      
      };

      const vizMapInstance = this;

      this.geojsonGeometry.when(() => {
        this.geojsonGeometry.queryFeatures().then((result) => {
          let graphicsToAdd = [];  // Temporary array to hold graphics

          result.features.forEach((feature) => {
            // Get ID from the feature's attributes
            const _id = feature.attributes[this.geometryFileId];

            var _valueMain = 0;
            var _valueComp = 0;
            var _valueDisp = 0;

            // main value
            if (_dataMain!=='none') {
              if (_dataMain[_id]!==undefined){
                _valueMain = _dataMain[_id][this.getACode()]
              }
            }

            // comp value
            if (_dataComp!=='none') {
              if (_dataComp[_id]!==undefined) {
              _valueComp = _dataComp[_id][this.getACode()]
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
            if (_dataMain[_id]) {
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
            }
          });

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

  
  
    getSidebarSelector(submenuTemplate) {
      if (submenuTemplate === 'vizLog') {
          return '#logSidebarContent';
      } else if (submenuTemplate === 'vizMap') {
          return '#sidebarContent';
      } else if (submenuTemplate === 'vizTrends') {
          return '#trendSidebarContent'
      } else if(submenuTemplate === 'vizMatrix') {
          return '#matrixSidebarContent'
      }
  
    }
  }
  
  // Export ModelEntity to the global scope
  // Exporting to Global Scope (Not recommended but works): If you want to make the ModelEntity class globally accessible (not a good practice but will solve the immediate issue):
  window.VizMap = VizMap;

});