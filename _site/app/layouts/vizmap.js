require([
  "esri/layers/GeoJSONLayer",
  "esri/Graphic",
  "esri/layers/FeatureLayer",
  "esri/renderers/SimpleRenderer",
  "esri/renderers/visualVariables/ColorVariable",
  "esri/Color",
  "esri/PopupTemplate",
  "esri/widgets/Legend",
  "esri/rest/support/Query",
  "esri/widgets/Expand"
], function(GeoJSONLayer, Graphic, FeatureLayer, SimpleRenderer, ColorVariable, Color, PopupTemplate, Legend, Query, Expand) {
  // Now you can use Graphic inside this callback function

  class VizMap {
    constructor(data, layerTitle, modelEntity) {
      this.id = data.id || this.generateIdFromText(data.attributeTitle) + '-vizmap'; // use provided id or generate one if not provided
      console.log('vizmap:construct:' + this.id);
      
      // link to parent
      this.modelEntity = modelEntity;

      this.jsonFileName = data.jsonFileName;
      this.baseGeoJsonKey = data.baseGeoJsonKey;
      this.baseGeoJsonId = data.baseGeoJsonId;
      this.geometryType = data.geometryType;
      this.popupTitle = data.popupTitle;
      this.layerTitle = layerTitle;
      this.layerDisplay = new FeatureLayer();
      this.mode = 'main'; //default is main  other option is compare
      this.modeCompare = 'abs' //default is abs  other option is pct

      // Global variable to store original label info
      this.originalLabelInfo = null;

      // sidebar
      this.sidebar = new VizSidebar(data.attributes,
                                    data.attributeSelected,
                                    data.attributeTitle,
                                    data.attributeInfoTextHtml,
                                    data.filters,
                                    data.aggregators,
                                    data.aggregatorSelected,
                                    data.aggregatorTitle,
                                    data.dividers,
                                    data.dividerSelected,
                                    data.dividerTitle,
                                    this)

      // ADD GEOJSONS
      // need to check geometry type before adding!!
      this.geojsonLayer = new GeoJSONLayer({
        url: 'geo-data/' + this.getScenarioMain().getGeoJsonFileNameFromKey(this.baseGeoJsonKey),
        title: "dummy layer"
      });
      map.add(this.geojsonLayer);
      this.geojsonLayer.visible = false;

      
      // Get GEOJSON NON-GEOMTRY FOR EASY QUERYING
      // Read JSON file
      if (this.baseGeoJsonKey!="") {
        fetch('geo-data/' + this.getScenarioMain().getGeoJsonFileNameFromKey(this.baseGeoJsonKey))
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
          this.baseGeometryGeoJson = data;
        })
        .catch(error => {
          console.error('Error reading the JSON file:', error);
          // Handle the error appropriately
          });
      }
    }
    
    afterUpdateSidebar() {
      console.log('vizmap:afterUpdateSidebar');
      this.updateDisplay();
    }

    afterUpdateAggregator() {
      console.log('vizmap:afterUpdateAggregator');
      
      // remove aggregator geometry
      if (this.geojsonLayer) {
        map.remove(this.geojsonLayer);
      }

      // ADD GEOJSONS
      // need to check geometry type before adding!!
      this.geojsonLayer = new GeoJSONLayer({
        url: 'geo-data/' + this.getScenarioMain().getGeoJsonFileNameFromKey(this.getSelectedAggregator().agGeoJsonKey),
        title: "Aggregator Layer"
      });

      // add new geometry
      map.add(this.geojsonLayer);
      this.geojsonLayer.visible = false;
      this.afterUpdateSidebar();
    }

    generateIdFromText(text) {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    renderSidebar() {
      this.sidebar.render();
    }

    getScenarioMain() {
      return this.getMain();
    }

    getScenarioComp() {
      return this.getComp();
    }
    
    getDataMain() {
      const _scenario = this.getMain()
      if (_scenario) {
        return _scenario.getDataForFilterOptionsList(this.jsonFileName, this.sidebar.getListOfSelectedFilterOptions());
      }
    }

    
    getDataWeightMain() {
      const _scenario = this.getMain()
      if (_scenario) {
        return _scenario.getDataForFilter(this.jsonFileName, this.sidebar.getWeightCodeFilter());
      }
    }

    getDataComp() {
      const _scenario = this.getComp()
      if (_scenario) {
        return _scenario.getDataForFilterOptionsList(this.jsonFileName, this.sidebar.getListOfSelectedFilterOptions());
      }
    }
    
    getDataWeightComp() {
      const _scenario = this.getComp()
      if (_scenario) {
        return _scenario.getDataForFilter(this.jsonFileName, this.sidebar.getWeightCodeFilter());
      }
    }

    getScenario(_modVersion, _scnGroup, _scnYear) {
      return dataScenarios.find(scenario =>
                                scenario.modVersion === _modVersion &&
                                scenario.scnGroup   === _scnGroup   &&
                                scenario.scnYear    === _scnYear
                                ) || null;
    }

    getMainScenarioDisplayName() {
      const _scenario = this.getMain();
      if (_scenario.alias) {
        return _scenario.alias;
      } else {
        return _scenario.modVersion + ' ' +
               _scenario.scnGroup + ' ' +
               _scenario.scnYear;
      }       
    }

    getCompScenarioDisplayName() {
      const _scenario = this.getComp();
      if (_scenario.alias) {
        return _scenario.alias;
      } else {
        return _scenario.modVersion + ' ' +
               _scenario.scnGroup + ' ' +
               _scenario.scnYear;
      }    
    }

    getMain() {
      return this.getScenario(         selectedScenario_Main.modVersion,
                                       selectedScenario_Main.scnGroup,
                              parseInt(selectedScenario_Main.scnYear, 10)); // Assuming it's a number
    }

    getComp() {
      return this.getScenario(         selectedScenario_Comp.modVersion,
                                       selectedScenario_Comp.scnGroup,
                              parseInt(selectedScenario_Comp.scnYear, 10)); // Assuming it's a number
    }

    // check if comparison scenario is in process of being defined... i.e. some values are not 'none'
    isScenarioCompIncomplete() {
      if (this.getComp() === null) {
        if ((selectedScenario_Comp.modVersion !== "none" ||
             selectedScenario_Comp.scnGroup !== "none" ||
             selectedScenario_Comp.scnYear !== "none" )) {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    getACode() {
      return this.sidebar.getACode();
    }

    getADisplayName() {
      return this.sidebar.getADisplayName();
    }

    // get the divider code that is selected
    getDCode() {
      return this.divideByAttributeSelect.selected;
    }
  
    getSelectedAggregator()  {
      return this.sidebar.getSelectedAggregator();
    }

    getFilterGroup() {
      const _scenario = this.getScenarioMain();
      if (_scenario) {
        return _scenario.getFilterGroupForAttribute(this.jsonFileName, this.getACode())
      }
    }

    getFilterGroupArray() {
      var _filterGroup = this.getFilterGroup();
    
      if (_filterGroup) {
        // Split the _filterGroup by "_"
        return _filterGroup.split("_");
      }
    }
    
    hideLayers() {
      this.layerDisplay.visible = false;
      
      if (this.legend) {
        mapView.ui.remove(this.legend);
        mapView.ui.remove(this.expandLengend);
      }
    }
    
    getLabelInfo() {
      let attributeRenderer = this.getAttributeRendererPath();
      return attributeRenderer ? attributeRenderer.labelExpressionInfo : null;
    }
    
    getRenderer() {
      let attributeRenderer = this.getAttributeRendererPath();
      return attributeRenderer ? attributeRenderer.renderer : null;
    }
    
    getAttributeRendererPath() {

      var compareType = document.getElementById('selectCompareType');
      this.modeCompare = compareType ? compareType.selectedOption.value : null;

      const collection = this.sidebar.getAttributeRendererCollection();
      if (this.mode == 'main') {
        return collection.main;
      } else if (this.mode == 'compare') {
        return this.modeCompare == 'abs' ? collection.compare_abs :
               this.modeCompare == 'pct' ? collection.compare_pct : null;
      }
      return null;
    }

    getPopupLayerName() {
      if (this.sidebar.aggregators.length>0) {
        return this.sidebar.getSelectedAggregator().agTitleText;
      } else {
        return this.baseGeoJsonId;
      }
    }

    getPopupFeatureCode() {
      if (this.sidebar.aggregators.length>0) {
        return this.sidebar.getSelectedAggregator().agCode;
      } else {
        return this.baseGeoJsonId;
      }
    }

    getPopupFeatureField() {
      if (this.sidebar.aggregators.length>0) {
        return this.sidebar.getSelectedAggregator().agCodeLabelField;
      } else {
        return this.baseGeoJsonId;
      }
    }

    initializeLayer() {
      
//      // remove layer
//      if (this.geojsonLayer) {
//        map.remove(this.geojsonLayer);
//      }
//      
//      // ADD GEOJSONS
//      // need to check geometry type before adding!!
//      this.geojsonLayer = new GeoJSONLayer({
//        url: 'geo-data/' + this.getScenarioMain().getGeoJsonFileNameFromKey(this.baseGeoJsonKey),
//        title: "dummy layer"
//      });
//      map.add(this.geojsonLayer);
//      this.geojsonLayer.visible = false;
//
//      
//      // Get GEOJSON NON-GEOMTRY FOR EASY QUERYING
//      // Read JSON file
//      if (this.baseGeoJsonKey!="") {
//        fetch('geo-data/' + this.getScenarioMain().getGeoJsonFileNameFromKey(this.baseGeoJsonKey))
//          .then(response => {
//            if (!response.ok) {
//              throw new Error(`HTTP error! status: ${response.status}`);
//            }
//            return response.json();
//        })
//        .then(data => {
//          this.baseGeometryGeoJson = data;
//        })
//        .catch(error => {
//          console.error('Error reading the JSON file:', error);
//          // Handle the error appropriately
//          });
//      }

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
            idLabel: "",
            // ... add other attribute fields if necessary
            dVal: null // Assuming you want a displayValue, you can set any initial value
          }
        };

        
        this.layerDisplay = new FeatureLayer({
          source: [this.dummyFeature],
          //objectIdField: this.baseGeoJsonId,
          fields: [
            // ... your other fields
            { name: this.baseGeoJsonId, type: "oid" },  // Object ID field
            { name: "idLabel", type: "string"},
            { name: "dVal", type: dValFieldType, alias: this.getACode() },

          ],
          popupTemplate: {
            title: this.popupTitle,
            content: [
              {
                type: "text",
                text: this.getPopupLayerName() + " {expression/featureName}"
              },
              {
                type: "text",
                text: this.getACode() + ": {expression/formatDisplayValue}"
              }
            ],
            expressionInfos: [
              {
                name: "featureName",
                title: "Feature Name",
                expression: '$feature.idLabel'
              },
              {
                name: "formatDisplayValue",
                title: "Formatted Display Value",
                expression: this.getLabelInfo()
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
            labelExpressionInfo: { expression: this.getLabelInfo() }  // Define the expression for the label
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
            id: 0,
            idLabel: "",
            dVal: null
          }
        };

        this.layerDisplay = new FeatureLayer({
          source: [this.dummyFeature],
          fields: [
            // ... your other fields
            { name: this.baseGeoJsonId, type: "oid" },  // Object ID field
            { name: "idLabel", type: "string"},
            { name: "dVal", type: dValFieldType, alias: this.getACode() },
          ],
          popupTemplate: {
            title: this.popupTitle,
            content: [
              {
                type: "text",
                text: this.getPopupLayerName() + " {expression/featureName}"
              },
              {
                type: "text",
                text: this.getACode() + ": {expression/formatDisplayValue}"
              }
            ],
            expressionInfos: [
              {
                name: "featureName",
                title: "Feature Name",
                expression: '$feature.idLabel'
              },
              {
                name: "formatDisplayValue",
                title: "Formatted Display Value",
                expression: this.getLabelInfo()
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
            labelExpressionInfo: { expression: this.getLabelInfo() }  // Define the expression for the label
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

    // Function to be called when checkbox status changes
    toggleLabels() {
      console.log('vizmap:toggleLabels')
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

    updateDisplay() {
      console.log('vizmap:updateDisplay');
      
      // Reinitialize the layer with the current features array
      map.remove(this.layerDisplay);

      // get main data
      var _dataMain = this.getDataMain();
      // get data for weighting
      if (this.sidebar.getWeightCode()) {
        var _dataWeightMain = this.getDataWeightMain();
      }


      // get compare data
      if (document.getElementById('comparisonScenario').open & this.getComp() !== null) {
        this.mode = 'compare';
        var _dataComp = this.getDataComp();
        // get data for weighting
        if (this.sidebar.getWeightCode()) {
          var _dataWeightComp = this.getDataWeightComp();
        }
      } else {
        this.mode = 'main';
      }

      // check if comp scenario values are complete. if selection is incomplete, then do not map
      if (this.isScenarioCompIncomplete()) {
        return;
      }
      
      // return if no data!
      if (!_dataMain & !_dataComp) {
        return;
      }

      this.initializeLayer();

      const _aCode = this.getACode();

      const setRendererAndLegend = () => {

        if (_aCode.substring(0, 2) === "aS" & this.attributeTitle =="Mode Share Attributes") {
          if (this.mode==='main') {
            // Define the color ramp from yellow to blue
            var colorVisVar = new ColorVariable({
              field: "dVal", // replace with the field name of your data
              stops: [
                { value: 0.0001, color: new Color("#FFFF00") }, // Yellow
                { value: 1.0000, color: new Color("#0000FF") }  // Blue
              ]
            });
          }
          else if (this.mode==='compare') {
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
          this.layerDisplay.renderer = this.getRenderer();
        }

        this.layerDisplay.refresh();
        this.layerDisplay.visible = true;
          
        this.layerDisplay.queryFeatures().then(function(results) {
          console.log("Total number of features in layer:", results.features.length);
        });

        if (this.legend) {
          mapView.ui.remove(this.legend);
          mapView.ui.remove(this.expandLengend);
        }
        var _title = "";
        //if (this.sidebar.aggregators.length>0) {
        //  const _aggCode = this.sidebar.getSelectedAggregator();
        //  _title += ' by ' + _aggCode.agTitleText;
        //}
        if (this.mode==='main') {
          _title += this.getMainScenarioDisplayName();
        } else if(this.mode==='compare' & (this.modeCompare==='abs' | this.modeCompare==='pct')) {
          _title += this.getMainScenarioDisplayName() + ' compared to ' + this.getCompScenarioDisplayName();
        }
        this.legend = new Legend({
          view: mapView,
          layerInfos: [{
            layer: this.layerDisplay,
            title: _title// + (_filter !== "" ? " - Filtered by " + _filter : "")
          }]
        });
        //mapView.ui.add(this.legend, "bottom-right");
        
        // Create the Expand widget
        this.expandLengend = new Expand({
          view: mapView,
          content: this.legend,
          expandIcon: "legend",
          expanded: true,
          expandTooltip: 'Show Legend',
          group: "bottom-right"
        });

        // Add the Expand widget to the view
        mapView.ui.add(this.expandLengend, "bottom-right");

        // toggle labels based on checkbox
        this.originalLabelInfo = this.layerDisplay.labelingInfo;
        this.toggleLabels();

      };

      // set map header
      var _title = "";
      
      //_title += this.modelEntity.submenuText + ' - ' 
      //_title = this.sidebar.getADisplayName().replace(/[ ]+/g, '').replace(/(^-|-$)/g, '');
      //if (this.sidebar.aggregators.length>0) {
      //  const _aggCode = this.sidebar.getSelectedAggregator();
      //  _title += ' by ' + _aggCode.agTitleText;
      //}
      //if (this.mode==='main') {
      //  _title += ' - ' + this.getMainScenarioDisplayName();
      //} else if(this.mode==='compare' & this.modeCompare==='abs') {
      //  _title += ' - ' + this.getMainScenarioDisplayName() + ' vs ' + this.getCompScenarioDisplayName();
      //} else if(this.mode==='compare' & this.modeCompare==='pct') {
      //  _title += ' - ' + this.getMainScenarioDisplayName() + ' vs ' + this.getCompScenarioDisplayName() + ' - Percent Difference';
      //}

      const _subTitle = this.sidebar.getSelectedOptionsAsLongText();

      const containerHeaderElement = document.getElementById('mapFooter');
      containerHeaderElement.innerHTML = '';
      
      const _titleDiv = document.createElement('div');
      _titleDiv.id = 'mapTitle';
      _titleDiv.innerHTML = '<h1>' + _title + '</h1>';
      containerHeaderElement.appendChild(_titleDiv);
  
      const _subTitleDiv = document.createElement('div');
      _subTitleDiv.id = 'mapSubtitle';
      _subTitleDiv.innerHTML = _subTitle;
      containerHeaderElement.appendChild(_subTitleDiv);

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
          if (this.sidebar.aggregators.length === 0 || (this.getSelectedAggregator() &&
                                                        this.getSelectedAggregator().agCode == this.baseGeoJsonId)) {
            
            result.features.forEach((feature) => {

              // Get ID from the feature's attributes
              var _id = feature.attributes[this.baseGeoJsonId];
              
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

              var compareType = document.getElementById('selectCompareType');
              this.modeCompare = compareType ? compareType.selectedOption.value : null;

              // calculate final display value based on selection (absolute or change)
              try {
                if (this.modeCompare=='abs') { // absolute change
                _valueDisp = _valueMain - _valueComp;
                } else if (this.modeCompare=='pct') { // percent change
                  if (_valueComp>0) _valueDisp = ((_valueMain - _valueComp) / _valueComp);
                }
              } catch(err) {
                _valueDisp = _valueMain;
              }

              var attributes;

              // If there's a display value for the given SEGID in the _dataMain object, set it
              if (_valueMain !== 0 || _valueComp !== 0) {
                attributes = {
                  ...feature.attributes,
                  idLabel: _id,
                  dVal: _valueDisp  // Add the dVal to attributes
                };
              } else {
                attributes = {
                  ...feature.attributes,
                  idLabel: _id,
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
            const _wtCode = this.sidebar.getWeightCode() || "";

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
                
                const _idFt = baseFt.properties[this.baseGeoJsonId];

                // main value
                if (_dataMain !== undefined) {
                  if (_dataMain[_idFt]) {
                    if (_dataMain[_idFt][_aCode]) {
                      if (!_wtCode) {
                        _valueMain += _dataMain[_idFt][_aCode];
                      } else {
                        try {
                          var _wtMain = _dataWeightMain[_idFt][_wtCode];
                          if (_wtMain) {
                            _valueMainXWt += _dataMain[_idFt][_aCode] * _wtMain;
                            _valueMainSumWt += _wtMain;
                          }
                        } catch (error) {
                          //console.error("An error occurred while processing the weight:", error);
                          // Handle the error or perform error recovery
                          _valueMainXWt += 0;
                          _valueMainSumWt += 0;
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
                        try {
                          var _wtComp = _dataWeightComp[_idFt][_wtCode];
                          if (_wtComp) {
                            _valueCompXWt += _dataComp[_idFt][_aCode] * _wtComp;
                            _valueCompSumWt += _wtComp;
                          }  
                        } catch (error) {
                          _valueCompXWt += 0;
                          _valueCompSumWt += 0;
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

              var compareType = document.getElementById('selectCompareType');
              this.modeCompare = compareType ? compareType.selectedOption.value : null;

              // calculate final display value based on selection (absolute or change)
              try {
                if (this.modeCompare=='abs') { // absolute change
                _valueDisp = _valueMain - _valueComp;
                } else if (this.modeCompare=='pct') { // percent change
                  if (_valueComp>0) _valueDisp = ((_valueMain - _valueComp) / _valueComp);
                }
              } catch(err) {
                _valueDisp = _valueMain;
              }
              
              // If there's a display value for the given SEGID in the _dataMain object, set it
              let attributes = {
                ...feature.attributes,
                idLabel: _idAg,
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
                vizMapInstance.sidebar.updateFilterDisplay();
                vizMapInstance.sidebar.updateAggregations();

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

  }
  
  // Export ModelEntity to the global scope
  // Exporting to Global Scope (Not recommended but works): If you want to make the ModelEntity class globally accessible (not a good practice but will solve the immediate issue):
  window.VizMap = VizMap;

});