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
      // Several unrelated entities share the same attributeTitle (e.g. "Special Trips" and
      // "Special Trip Trends" are both "Trip Gen Attribute"), so an id derived from it alone
      // would collide across entities - Filter.id (filter.js) is built from this.id, so a
      // collision means two different entities' filter checkboxes/selects end up with the same
      // DOM id/name once both have rendered at least once. modelEntity.submenuText is
      // guaranteed unique (it's what the menu and URL restore already key off of).
      this.id = data.id || this.generateIdFromText(modelEntity.submenuText || data.attributeTitle) + '-vizmap'; // use provided id or generate one if not provided
      console.log('vizmap:construct:' + this.id);
      
      // link to parent
      this.modelEntity = modelEntity;

      this.jsonName = data.jsonName;
      this.baseGeoJsonKey = data.baseGeoJsonKey;
      this.baseGeoJsonId = data.baseGeoJsonId;
      this.geometryType = data.geometryType;
      if (data.popupTitle !== undefined) {
        this.popupTitle = data.popupTitle;
      } else {
        this.popupTitle = this.modelEntity.submenuText;
      }
      this.layerTitle = layerTitle;
      this.layerDisplay = new FeatureLayer();
      this.mode = 'main'; //default is main  other option is compare
      this.modeCompare = 'diff' //default is abs  other option is pct

      // Opt-in (see getPopupExtraAttributes()): shows every other same-filter-group attribute
      // in the popup alongside the one currently selected, but only outside compare mode -
      // there's no second scenario's value to show it next to, and mVal/cVal are single-valued.
      this.popupShowRelatedAttributes = !!data.popupShowRelatedAttributes;

      // Global variable to store original label info
      this.originalLabelInfo = null;

      // Bumped at the start of every updateDisplay() call so an older, still-loading call can
      // tell it's been superseded and bail out instead of clobbering a newer render.
      this._renderGen = 0;

      // sidebar
      this.sidebar = new VizSidebar(data.attributes,
                                    data.attributeSelected,
                                    data.attributeTitle,
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

      // Tracks which aggregator's geometry this.geojsonLayer currently holds, so
      // updateDisplay() can tell if it's gone stale relative to sidebar.aggregatorSelect -
      // see the note in updateDisplay() for why that can happen without this view's own
      // afterUpdateAggregator() ever having run.
      this._loadedAggregatorAgCode = data.aggregatorSelected;
    }

    // The GeoJSONLayer swap that afterUpdateAggregator() does, factored out so
    // updateDisplay() can also call it defensively (see there) without duplicating it.
    swapGeometryLayerForSelectedAggregator() {
      if (this.geojsonLayer) {
        map.remove(this.geojsonLayer);
      }
      const _selectedAggregator = this.getSelectedAggregator();
      const _agGeoJsonKey = _selectedAggregator ? _selectedAggregator.agGeoJsonKey : this.baseGeoJsonKey;
      this.geojsonLayer = new GeoJSONLayer({
        url: 'geo-data/' + this.getScenarioMain().getGeoJsonFileNameFromKey(_agGeoJsonKey),
        title: "Aggregator Layer"
      });
      map.add(this.geojsonLayer);
      this.geojsonLayer.visible = false;
      this._loadedAggregatorAgCode = _selectedAggregator ? _selectedAggregator.agCode : this.baseGeoJsonId;
    }
    
    // Define reusable popup content and expression info
    get popupContent() {
      const baseContent = [];

      // When there's a static popupTitle (e.g. "Roadway Segments"), the feature id still
      // needs its own line here. When popupTitle is "", initializeLayer() puts the feature
      // id in the title bar instead (see getPopupTitle()), so repeating it here would just
      // duplicate it under a blank header.
      if (this.popupTitle) {
        baseContent.push({
          type: "text",
          text: `<b>${this.getPopupLayerName()}:</b> {expression/featureName}`
        });
      }

      baseContent.push({
        type: "text",
        text: `<b>${this.getLayerDisplayName()}:</b> {expression/formatDisplayValue}`
      });

      if (this.mode === 'compare') {
        baseContent.push({
          type: "text",
          text: `<hr/><b>${this.getMainScenarioDisplayName()}:</b> {expression/formatMainValue}<br/><b>${this.getCompScenarioDisplayName()}:</b> {expression/formatCompValue}`
        });
      } else if (this.popupShowRelatedAttributes) {
        const _extraAttributes = this.getPopupExtraAttributes();
        if (_extraAttributes.length > 0) {
          const _extraLines = _extraAttributes.map(attr =>
            `<b>${attr.rendererCollection.main.title}:</b> {expression/${this.getPopupExtraExpressionName(attr.attributeCode)}}`
          ).join('<br/>');
          baseContent.push({
            type: "text",
            text: `<hr/>${_extraLines}`
          });
        }
      }

      return baseContent;
    }

    // Popup title: falls back to the feature id (e.g. "TAZ 1175") when no static
    // popupTitle is configured, instead of leaving the popup header blank - see popupContent().
    getPopupTitle() {
      return this.popupTitle || `${this.getPopupLayerName()} {expression/featureName}`;
    }

    // Other attributes from this entity's own attribute list, excluding the one currently
    // selected. Attributes with a filterOverride (e.g. Truck Percent) are excluded because they
    // depend on a filter dimension (e.g. Truck Type) that isn't one of the filters currently
    // shown/chosen by the user for the selected attribute - showing them would silently pull in
    // a value filtered by whatever that hidden filter's default selection happens to be, not by
    // what the user actually picked. Only meaningful outside compare mode - see
    // popupShowRelatedAttributes above.
    getPopupExtraAttributes() {
      return this.sidebar.attributes.filter(attr =>
        attr.attributeCode !== this.aCode && !attr.filterOverride
      );
    }

    // Field name used to carry a related attribute's value on the display feature (updateDisplay())
    getPopupExtraFieldName(attributeCode) {
      return 'extra_' + attributeCode;
    }

    // Expression name used to format a related attribute's value in the popup (popupContent())
    getPopupExtraExpressionName(attributeCode) {
      return 'formatExtra_' + attributeCode;
    }

    // A related attribute isn't necessarily keyed by the same filter combination as the
    // currently selected one - e.g. Lanes isn't time-of-day/vehicle-type dependent the way
    // Volume is, so its value simply isn't present under Volume's filter key(s) in _dataMain.
    // Resolve the attribute's own filter group/selected options (same machinery getFilterGroup()
    // uses for the selected attribute) and fetch its data independently.
    getPopupExtraAttributeData(attr) {
      const _scenario = this.getScenarioMain();
      if (!_scenario) return {};
      const _filterGroup = this.getFilterGroupForAttributeCode(attr.attributeCode);
      const _filterGroupArray = _filterGroup ? _filterGroup.split('_') : [];
      const _filterOptions = this.sidebar.getListOfSelectedFilterOptionsForGroup(_filterGroupArray);
      return _scenario.getDataForFilterOptionsList(this.jsonName, _filterOptions, attr.agFilterOptionsMethod) || {};
    }

    // FeatureLayer field declarations for the related attributes (initializeLayer())
    getPopupExtraFieldDefs() {
      return this.getPopupExtraAttributes().map(attr => ({
        name: this.getPopupExtraFieldName(attr.attributeCode),
        type: "double",
        alias: attr.alias
      }));
    }

    // Matching null defaults for the dummy feature initializeLayer() seeds the layer with
    getPopupExtraFieldDefaults() {
      const _defaults = {};
      this.getPopupExtraAttributes().forEach(attr => {
        _defaults[this.getPopupExtraFieldName(attr.attributeCode)] = null;
      });
      return _defaults;
    }

    get expressionInfos() {
      const baseExpressions = [
        {
          name: "featureName",
          title: "Feature Name",
          expression: "$feature.idLabel"
        },
        {
          name: "formatDisplayValue",
          title: "Formatted Display Value",
          expression: this.getLabelInfo()
        }
      ];

      if (this.mode === 'compare') {
        baseExpressions.push(
          {
            name: "formatMainValue",
            title: "Formatted Main Value",
            // Match the comma/trimmed-decimal style already used for the diff value
            // (formatDisplayValue) so the two scenario rows don't show raw unformatted numbers.
            expression: "IIF(IsEmpty($feature.mVal), '', Text(Round($feature.mVal, 2), '#,###.##'))"
          },
          {
            name: "formatCompValue",
            title: "Formatted Comp Value",
            expression: "IIF(IsEmpty($feature.cVal), '', Text(Round($feature.cVal, 2), '#,###.##'))"
          }
        );
      } else if (this.popupShowRelatedAttributes) {
        this.getPopupExtraAttributes().forEach(attr => {
          const _fieldName = this.getPopupExtraFieldName(attr.attributeCode);
          // Reuse that attribute's own "main" formatting (e.g. comma/decimal rules), just
          // pointed at its extra_<code> field instead of dVal.
          const _expression = (attr.rendererCollection.main.labelExpressionInfo || '$feature.dVal')
                                 .split('$feature.dVal').join('$feature.' + _fieldName);
          baseExpressions.push({
            name: this.getPopupExtraExpressionName(attr.attributeCode),
            title: 'Formatted ' + attr.rendererCollection.main.title,
            expression: _expression
          });
        });
      }

      return baseExpressions;
    }

    getPopupLayerName() {
      if (this.sidebar.aggregators.length>0) {
        return this.sidebar.getSelectedAggregator().agTitleText;
      } else {
        return this.baseGeoJsonId;
      }
    }

    updateScenarioSelector() {
      
    }

    afterUpdateSidebar() {
      console.log('vizmap:afterUpdateSidebar');
      this.updateDisplay();
    }

    afterUpdateAggregator() {
      console.log('vizmap:afterUpdateAggregator');
      this.swapGeometryLayerForSelectedAggregator();
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
        return _scenario.getDataForFilterOptionsList(this.jsonName, this.sidebar.getListOfSelectedFilterOptions(), this.sidebar.getAgFilterOptionsMethod());
      }
    }

    getDataWeightMain() {
      const _scenario = this.getMain()
      if (_scenario) {
        return _scenario.getDataForFilter(this.jsonName, this.sidebar.getWeightCodeFilter());
      }
    }

    getDataComp() {
      const _scenario = this.getComp()
      if (_scenario) {
        return _scenario.getDataForFilterOptionsList(this.jsonName, this.sidebar.getListOfSelectedFilterOptions(), this.sidebar.getAgFilterOptionsMethod());
      }
    }
    
    getDataWeightComp() {
      const _scenario = this.getComp()
      if (_scenario) {
        return _scenario.getDataForFilter(this.jsonName, this.sidebar.getWeightCodeFilter());
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

    get aCode() {
      return this.sidebar.getACode();
    }

    getADisplayName() {
      return this.sidebar.getADisplayName();
    }

    getLayerDisplayName() {
      if (this.dCode!="Nothing") {
        return this.getLayerTitle() + this.sidebar.dividers.find(divider => divider.attributeCode === this.dCode).legendSuffix;
      } else {
        return this.getLayerTitle();
      }
    }

    // get the divider code that is selected
    get dCode() {
      return this.sidebar.getDCode();
    }
  
    getSelectedAggregator()  {
      return this.sidebar.getSelectedAggregator();
    }

    getFilterGroup() {
      return this.getFilterGroupForAttributeCode(this.aCode);
    }

    // Generalizes getFilterGroup() to an arbitrary attribute code - needed by
    // getPopupExtraAttributeData() since a related attribute can depend on a different set of
    // filter dimensions than the currently selected one (e.g. Lanes isn't time-of-day/vehicle-type
    // dependent the way Volume is), so its filter group has to be resolved separately.
    getFilterGroupForAttributeCode(attributeCode) {
      const _scenario = this.getScenarioMain();
      if (_scenario) {
        let _baseFilterGroup = _scenario.getFilterGroupForAttribute(this.jsonName, attributeCode);
        let _attribute = this.sidebar.attributes.find(attribute =>
          attribute.attributeCode == attributeCode
        ) || null;
        if (_attribute) {
          if (_attribute.filterOverride) {
            console.log('There is a filter override');
            // Loop through the filterOverride and replace filterIn with filterOut in the string
            _attribute.filterOverride.forEach(item => {
              // Use a global replace for each filterOut to filterIn
              _baseFilterGroup = _baseFilterGroup.replace(item.filterOut, item.filterIn);
            });
          }
        }
        return _baseFilterGroup;
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
    
    getLayerTitle() {
      let attributeRenderer = this.getAttributeRendererPath();
      return attributeRenderer ? attributeRenderer.title : null;
    }
    
    getAttributeRendererPath() {

      var compareType = document.getElementById('selectCompareType');
      this.modeCompare = compareType ? compareType.selectedOption.value : null;

      const collection = this.sidebar.getAttributeRendererCollection();
      if (this.mode === 'main') {
        if (this.dCode !== "Nothing") {
          const _selectedDivider = this.sidebar.dividers.find(divider => divider.attributeCode === this.dCode) || null;
          return _selectedDivider && _selectedDivider.dCode in collection.main_divide_by
            ? collection.main_divide_by[_selectedDivider.dCode]
            : collection.main_divide_by["default"];
        } else {
          return collection.main;
        }
      } else if (this.mode === 'compare') {
        return this.modeCompare === 'diff' ? collection.compare_abs :
               this.modeCompare === 'pctdiff' ? collection.compare_pct : null;
      }
      return null;
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
      
      let dValFieldType;

      // MANUALLY SET SCENARIO -- REPLACE WITH PROGRAMATIC SOLUTION
      if (this.aCode === 'aFtClass') {
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
            dVal: null, // Assuming you want a displayValue, you can set any initial value
            mVal: null,
            cVal: null,
            ...this.getPopupExtraFieldDefaults()
          }
        };


        this.layerDisplay = new FeatureLayer({
          source: [this.dummyFeature],
          //objectIdField: this.baseGeoJsonId,
          fields: [
            // ... your other fields
            { name: this.baseGeoJsonId, type: "oid" },  // Object ID field
            { name: "idLabel", type: "string"},
            { name: "dVal", type: dValFieldType, alias: this.aCode },
            { name: "mVal", type: dValFieldType, alias: this.getMainScenarioDisplayName()},
            { name: "cVal", type: dValFieldType, alias: this.getCompScenarioDisplayName()},
            ...this.getPopupExtraFieldDefs()

          ],
          popupTemplate: {
            title: this.getPopupTitle(),
            content: this.popupContent,
            expressionInfos: this.expressionInfos
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
            dVal: null,
            mVal: null,
            cVal: null,
            ...this.getPopupExtraFieldDefaults()
          }
        };

        this.layerDisplay = new FeatureLayer({
          source: [this.dummyFeature],
          fields: [
            // ... your other fields
            { name: this.baseGeoJsonId, type: "oid" },  // Object ID field
            { name: "idLabel", type: "string"},
            { name: "dVal", type: dValFieldType, alias: this.aCode },
            { name: "mVal", type: dValFieldType, alias: this.getMainScenarioDisplayName()},
            { name: "cVal", type: dValFieldType, alias: this.getCompScenarioDisplayName()},
            ...this.getPopupExtraFieldDefs()
          ],
          popupTemplate: {
            title: this.getPopupTitle(),
            content: this.popupContent,
            expressionInfos: this.expressionInfos
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
      } else if (this.geometryType=='point') {
        // Dummy point feature
        this.dummyFeature = {
          geometry: {
            type: "point",
            longitude: -111.8910,  // Use longitude instead of coordinates
            latitude: 40.7608,     // Use latitude instead of coordinates
            spatialReference: { wkid: 4326 }  // Specify WGS 84 spatial reference
          },
          attributes: {
            id: 0,
            idLabel: "",
            dVal: null,
            mVal: null,
            cVal: null,
            ...this.getPopupExtraFieldDefaults()
          },
          reunderer: {
            "type": "simple-marker",
            "color": "#EEEEEE",
            "size":  1,
            "outline": {
              "color": "#CCCCCC",
              "width": 0.2
            }
          }
        };

        this.layerDisplay = new FeatureLayer({
          source: [this.dummyFeature],
          fields: [
            // ... your other fields
            { name: this.baseGeoJsonId, type: "oid" },  // Object ID field
            { name: "idLabel", type: "string"},
            { name: "dVal", type: dValFieldType, alias: this.aCode },
            { name: "mVal", type: dValFieldType, alias: this.getMainScenarioDisplayName()},
            { name: "cVal", type: dValFieldType, alias: this.getCompScenarioDisplayName()},
            ...this.getPopupExtraFieldDefs()
          ],
          popupTemplate: {
            title: this.getPopupTitle(),
            content: this.popupContent,
            expressionInfos: this.expressionInfos
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
              type: "simple-marker",  // Type of symbol (point marker)
              color: [0, 0, 0, 0],  // No fill color (transparent)
              size: 6,  // Marker size (adjust as needed)
              outline: {  // Define the outline of the marker
                color: [255, 255, 255],  // White outline color
                width: 0.5  // Outline width
              }
            }
          }
        });
        map.add(this.layerDisplay);
      }
    }

    // Function to be called when the label toggle button's active state changes
    toggleLabels() {
      console.log('vizmap:toggleLabels')
      var labelToggle = document.getElementById('vizMapLabelToggle');
      if (this.layerDisplay) {
        this.sidebar.setAttributeLabelStatus(labelToggle.active);
        if (labelToggle.active) {
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

    async updateDisplay() {
      console.log('vizmap:updateDisplay');

      // sidebar.aggregatorSelect.selected can change without this layout's own
      // afterUpdateAggregator() ever running - e.g. syncSelectedZoneGeography() (app.js)
      // mirrors another view's "Zone Geography" choice onto every OTHER view's sidebar too,
      // including ones that aren't the active view and so never get their own geometry
      // swapped for it. Detect that mismatch on every render and self-heal by swapping before
      // reading this.geojsonLayer below - otherwise this view keeps whatever geometry it
      // happened to load last (often still the base zone level) while the sidebar/rendering
      // act like the new aggregator's, producing blank/grey polygons in the wrong shapes the
      // next time this view becomes active.
      if (this.sidebar.aggregators.length > 0) {
        const _currentAgCode = this.getSelectedAggregator()?.agCode ?? this.baseGeoJsonId;
        if (_currentAgCode !== this._loadedAggregatorAgCode) {
          this.swapGeometryLayerForSelectedAggregator();
        }
      }

      // Selections used to render are already final at this point, so URL sync doesn't need
      // to wait for the (partly async) render below to finish.
      if (typeof syncUrlState === 'function') syncUrlState();

      // Scenario data loads lazily (see Scenario.ensureDataLoaded) - make sure whatever this
      // render needs is cached before the rest of this method reads it synchronously below.
      // _renderGen guards against a slower/older call finishing after a newer one already
      // started (e.g. rapid scenario or filter changes) and clobbering its result.
      const _renderGen = ++this._renderGen;
      const _mainScenario = this.getMain();
      const _compScenario = this.getComp();
      const _compareRequested = !!(document.getElementById('comparisonScenario')?.open && _compScenario !== null);
      showDataLoadingIndicator();
      try {
        await Promise.all([
          _mainScenario ? _mainScenario.ensureDataLoaded(this.jsonName) : Promise.resolve(),
          _compareRequested ? _compScenario.ensureDataLoaded(this.jsonName) : Promise.resolve()
        ]);
      } finally {
        hideDataLoadingIndicator();
      }
      if (_renderGen !== this._renderGen) return; // a newer updateDisplay() call has since started

      // _renderGen alone only catches a slower/older call on THIS SAME instance (e.g. rapid
      // filter changes within one view) - it says nothing about whether the user has since
      // switched to a completely different model entity while this await was in flight. That
      // switch already ran hideAllLayoutLayers()/hideLayers() against whatever this.layerDisplay
      // was AT THAT MOMENT, but this call is about to build and show a BRAND NEW layer below
      // (initializeLayer()/setRendererAndLegend() replace this.layerDisplay entirely) - without
      // this check that new layer still gets added and made visible, landing on top of whatever
      // the user actually switched to (reported as "both layers rendered" when clicking fast
      // between vizMap views).
      if (activeLayout !== this) return;

      // getFilterGroupForAttribute (scenario.js) needs this.jsonData[this.jsonName] loaded to
      // know which filters this attribute actually uses - before ensureDataLoaded() resolves it
      // returns "" (logged as an error), and updateFilterDisplay()'s fallback for a falsy
      // filterGroup is to hide EVERY filter (vizsidebar.js), not show them. That first-ever
      // sidebar render always runs before any scenario's data has had a chance to load, so on
      // a fresh view every filter starts hidden - getListOfSelectedFilterOptions() then finds no
      // visible filters to combine into a lookup key, and getDataMain()/getDataComp() below
      // always come back empty regardless of whether the scenario genuinely has data. This used
      // to self-correct by accident: the FeatureLayer's applyEdits().then() callback further
      // down calls updateFilterDisplay() again once graphics exist, fixing visibility for the
      // *next* render - but that callback never runs when there's no data to add, so scenarios
      // with real data got stuck showing "no data" forever once the no-data indicator (above)
      // started returning early here instead of rendering an empty-but-recoverable layer.
      // Recomputing filter visibility here - now that ensureDataLoaded() above is guaranteed
      // done - fixes it at the source instead of relying on that side effect.
      this.sidebar.updateFilterDisplay();

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

      // No data for this scenario/attribute/filter combination - a real, not-just-theoretical
      // gap (some scenarios were built with an older or different export pipeline and are
      // simply missing a given JSON). getDataForFilterOptionsList (scenario.js) always returns
      // an object, even when the underlying JSON never loaded - {} in that case, which is
      // truthy - so a plain !_dataMain check never actually catches this; it has to look at
      // whether anything actually aggregated into it. Previously that meant this case fell
      // through to initializeLayer()/setRendererAndLegend() below and rendered a map with every
      // segment in its "no value" default symbol - visually indistinguishable from broken.
      const _hasMainData = _dataMain && Object.keys(_dataMain).length > 0;
      const _hasCompData = _dataComp && Object.keys(_dataComp).length > 0;
      if (!_hasMainData && !_hasCompData) {
        const _scenarioLabel = _mainScenario ? (_mainScenario.alias || _mainScenario.scnFolder) : 'the selected scenario';
        const _entityLabel = this.modelEntity?.submenuText || 'data';
        showNoDataIndicator(`No ${_entityLabel} data available for ${_scenarioLabel}.`);
        return;
      }
      hideNoDataIndicator();

      this.initializeLayer();

      const setRendererAndLegend = () => {

        this.layerDisplay.renderer = this.getRenderer();

        this.layerDisplay.refresh();
        this.layerDisplay.visible = true;
          
        this.layerDisplay.queryFeatures().then(function(results) {
          console.log("Total number of features in layer:", results.features.length);
        });

        let isLegendExpanded = true; // Default state
        if (this.expandLengend) {
          isLegendExpanded = this.expandLengend.expanded; // Capture the current state
          mapView.ui.remove(this.expandLengend);
        }

        // Proceed to remove the old legend
        if (this.legend) {
          mapView.ui.remove(this.legend);
        }
        
        if (this.dCode!="Nothing") {
          if (this.layerDisplay.renderer.visualVariables) {
            this.layerDisplay.renderer.visualVariables.forEach((visualVariable) => {
              visualVariable.legendOptions = {
                title: this.getLayerDisplayName()
              }
            });
          }
        }

        var _title = "";
        //if (this.sidebar.aggregators.length>0) {
        //  const _aggCode = this.sidebar.getSelectedAggregator();
        //  _title += ' by ' + _aggCode.agTitleText;
        //}
        if (this.mode==='main') {
          _title += this.getMainScenarioDisplayName();
        } else if(this.mode==='compare' & (this.modeCompare==='diff' | this.modeCompare==='pctdiff')) {
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
          expanded: isLegendExpanded, // Use the previous state
          expandTooltip: 'Show Legend',
          group: "bottom-right"
        });

        // Add the Expand widget to the view
        mapView.ui.add(this.expandLengend, "bottom-right");

        // toggle labels based on persisted per-attribute status
        this.originalLabelInfo = this.layerDisplay.labelingInfo;

        var labelToggle = document.getElementById('vizMapLabelToggle');
        labelToggle.active = this.sidebar.getAttributeLabelStatus();
        updateLabelToggleTooltip(labelToggle);
        this.toggleLabels();

      };

      // set map header
      var _title = "";

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

      var _data_divide_main;
      var _geojsondata_divide_main;
  
      var _data_divide_comp;
      var _geojsondata_divide_comp;

      // GET MAP FEATURES

      this.geojsonLayer.when(() => {
        this.geojsonLayer.queryFeatures().then(async (result) => {
          let graphicsToAdd = [];  // Temporary array to hold graphics

          if (this.sidebar.dividers) {
            var _selectedDivider = this.sidebar.dividers.find(divider => divider.attributeCode === this.dCode) || null;
          }

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
            
            if (this.dCode!="Nothing") {
              var _dataMainDivide = this.getMain().getDataForFilter(_selectedDivider.jsonName, _selectedDivider.filter);
              if (this.mode==='compare') {
                var _dataCompDivide = this.getComp().getDataForFilter(_selectedDivider.jsonName, _selectedDivider.filter);
              }
            }

            // Only meaningful outside compare mode - see popupShowRelatedAttributes. Each related
            // attribute's data is fetched separately (not sliced out of _dataMain) since it can
            // depend on a different filter group than the selected attribute - see
            // getPopupExtraAttributeData().
            const _extraAttributes = (this.mode !== 'compare' && this.popupShowRelatedAttributes)
              ? this.getPopupExtraAttributes() : [];
            const _extraAttributeData = {};
            _extraAttributes.forEach(attr => {
              _extraAttributeData[attr.attributeCode] = this.getPopupExtraAttributeData(attr);
            });

            result.features.forEach((feature) => {

              // Get ID from the feature's attributes
              const _id = feature.attributes[this.baseGeoJsonId];

              const _extraValues = {};
              _extraAttributes.forEach(attr => {
                const _attrData = _extraAttributeData[attr.attributeCode];
                const _val = _attrData && _attrData[_id] ? _attrData[_id][attr.attributeCode] : undefined;
                _extraValues[this.getPopupExtraFieldName(attr.attributeCode)] = (_val === undefined) ? null : _val;
              });

              let _valueMain = 0;
              let _valueComp = 0;
              let _valueMainDivide = 0;
              let _valueCompDivide = 0;
              let _valueDisp = 0;

              // main value
              if (_dataMain!==undefined) {
                if (_dataMain[_id]) {
                  _valueMain = _dataMain[_id][this.aCode];
                }
              }

              // comp value
              if (_dataComp!==undefined && (this.mode==='compare') ) {
                if (_dataComp[_id]) {
                _valueComp = _dataComp[_id][this.aCode];
                }
              }
              
              if (this.dCode!="Nothing") {
                // main value
                if (_dataMainDivide!==undefined) {
                  if (_dataMainDivide[_id]) {
                    _valueMainDivide = _dataMainDivide[_id][_selectedDivider.attributeCode];
                  }
                  _valueMain = _valueMainDivide > 0 ? _valueMain / _valueMainDivide : null;
                }

                // comp value
                if (_dataCompDivide!==undefined && (this.mode==='compare') ) {
                  if (_dataCompDivide[_id]) {
                  _valueCompDivide = _dataCompDivide[_id][_selectedDivider.attributeCode];
                  }
                  _valueComp = _valueCompDivide > 0 ? _valueComp / _valueCompDivide : null;
                }
              }

              var compareType = document.getElementById('selectCompareType');
              this.modeCompare = compareType ? compareType.selectedOption.value : null;

              // calculate final display value based on selection (absolute or change)
              try {
                if (this.mode==='compare') {
                  if (this.modeCompare=='diff') { // absolute change
                    _valueDisp = _valueMain - _valueComp;
                  } else if (this.modeCompare=='pctdiff') { // percent change
                    if (_valueComp>0) _valueDisp = ((_valueMain - _valueComp) / _valueComp);
                  }
                } else {
                  _valueDisp = _valueMain;
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
                  dVal: _valueDisp, // Add the dVal to attributes
                  mVal: _valueMain,
                  cVal: _valueComp,
                  ..._extraValues
                };
              } else {
                attributes = {
                  ...feature.attributes,
                  idLabel: _id,
                  dVal: null, // Add the dVal to attributes
                  mVal: null,
                  cVal: null,
                  ..._extraValues
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
          } else {

            let aggregatorKeyFile;

            // Call this.getAggregatorKeyFile() once and store the result
            aggregatorKeyFile = this.getScenarioMain().getAggregatorKeyFile(this.sidebar.getSelectedAggregator(), this.baseGeoJsonKey);

            if (aggregatorKeyFile) {

              const _idAgFieldName = this.getSelectedAggregator().agCode;
              const _wtCode = this.sidebar.getWeightCode() || "";

              // Some attributes (e.g. Area Type - a categorical zone code, not a continuous
              // quantity) don't have a sensible blended value at anything coarser than the base
              // zone geometry - not weighted-average, not plain sum. Rather than compute a
              // number that would misrepresent the data, show "no data" for every feature
              // whenever a real aggregator is active (see the per-feature bypass below).
              const _selectedAttrConfig = this.sidebar.attributes.find(a => a.attributeCode === this.aCode);
              const _isAggregatable = _selectedAttrConfig?.aggregatable !== false;

              if (this.dCode!="Nothing") {
                _data_divide_main = this.getMain().jsonData[_selectedDivider.jsonName].data[_selectedDivider.filter];
                _geojsondata_divide_main = dataGeojsons[this.getMain().geojsons[_selectedDivider.baseGeoJsonKey]];
                if (this.mode==='compare') {
                  _data_divide_comp = this.getComp().jsonData[_selectedDivider.jsonName].data[_selectedDivider.filter];
                  _geojsondata_divide_comp = dataGeojsons[this.getComp().geojsons[_selectedDivider.baseGeoJsonKey]];
                }
              }

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

                if (!_isAggregatable) {
                  graphicsToAdd.push(new Graphic({
                    geometry: feature.geometry,
                    attributes: { ...feature.attributes, idLabel: _idAg, dVal: null, mVal: null, cVal: null }
                  }));
                  return;
                }

                // get associated json records for given aggregator
                const agRecords = aggregatorKeyFile.filter(record =>
                  record[_idAgFieldName] === _idAg
                );

                // aggregate json data for give display feature
                agRecords.forEach((agRecord) => {
                  
                  const _idFt = agRecord[this.baseGeoJsonId];

                  // main value
                  if (_dataMain !== undefined) {
                    if (_dataMain[_idFt]) {
                      if (_dataMain[_idFt][this.aCode]) {
                        if (!_wtCode) {
                          _valueMain += _dataMain[_idFt][this.aCode];
                        } else {
                          try {
                            var _wtMain = getWeightValue(_dataWeightMain[_idFt], _wtCode);
                            if (_wtMain) {
                              _valueMainXWt += _dataMain[_idFt][this.aCode] * _wtMain;
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
                      if (_dataComp[_idFt][this.aCode]) {
                        if (!_wtCode) {
                          _valueComp += _dataComp[_idFt][this.aCode];
                        } else {
                          try {
                            var _wtComp = getWeightValue(_dataWeightComp[_idFt], _wtCode);
                            if (_wtComp) {
                              _valueCompXWt += _dataComp[_idFt][this.aCode] * _wtComp;
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

                if (this.dCode!="Nothing") {
                  
                  var _sumDivideMain = 0;
                  var _sumDivideComp = 0;

                  // get divide features with the same _idAg
                  const filteredRecords_divide_main = aggregatorKeyFile.filter(record => 
                    record[_idAgFieldName]==_idAg
                  );

                  // loop through divide features and baseGeoJsonIds
                  var filteredRecords_divide_main_set = new Set();
                  filteredRecords_divide_main.forEach((record) => {
                    if (record && record[_selectedDivider.baseGeoJsonId]) {
                      filteredRecords_divide_main_set.add(record[_selectedDivider.baseGeoJsonId]);
                    }
                  });

                  const _filteredRecords_divide_main_list = [...filteredRecords_divide_main_set];
    
                  //filter the zonesSeData to only those zones that are within filteredTazList
                  const filtered_geojsondata_divide_main = Object.keys(_geojsondata_divide_main.features)
                    .filter((key) => _filteredRecords_divide_main_list.includes(parseInt(key)))
                    .reduce((result, key) => {
                      result[key] = _geojsondata_divide_main.features[key];
                      return result;
                  }, {});
    
                  //sum up all the "selected divide by attribute"'s  value within the filtered zonesSeData list to get a sum total
                  for (const key in _filteredRecords_divide_main_list) {
                    if (_data_divide_main[_filteredRecords_divide_main_list[key]][this.dCode] !== undefined) {
                      _sumDivideMain += _data_divide_main[_filteredRecords_divide_main_list[key]][this.dCode];
                    }
                  }

                  if (this.mode==='compare') {
                    // get divide features with the same _idAg
                    const filteredRecords_divide_comp = aggregatorKeyFile.filter(record => 
                      record[_idAgFieldName]==_idAg
                    );
    
                    // loop through divide features and baseGeoJsonIds
                    var filteredRecords_divide_comp_set = new Set();
                    filteredRecords_divide_comp.forEach((record) => {
                      if (record && record[_selectedDivider.baseGeoJsonId]) {
                        filteredRecords_divide_comp_set.add(record[_selectedDivider.baseGeoJsonId]);
                      }
                    });
    
                    const _filteredRecords_divide_comp_list = [...filteredRecords_divide_comp_set];
      
                    //filter the zonesSeData to only those zones that are within filteredTazList
                    const filtered_geojsondata_divide_comp = Object.keys(_geojsondata_divide_comp)
                      .filter((key) => _filteredRecords_divide_comp_list.includes(parseInt(key)))
                      .reduce((result, key) => {
                        result[key] = _geojsondata_divide_comp.features[key];
                        return result;
                    }, {});
      
                    //sum up all the "selected divide by attribute"'s  value within the filtered zonesSeData list to get a sum total
                    for (const key in _filteredRecords_divide_comp_list) {
                      if (_data_divide_comp[_filteredRecords_divide_comp_list[key]][this.dCode] !== undefined) {
                        _sumDivideComp += _data_divide_comp[_filteredRecords_divide_comp_list[key]][this.dCode];
                      }
                    }
                  }

                  if (_sumDivideMain>0) {
                    _valueMain /= _sumDivideMain;
                  } else {
                    _valueMain = null;
                  }

                  if (_sumDivideComp>0) {
                    _valueComp /= _sumDivideComp;
                  } else {
                    _valueComp = null;
                  }

                }
                
                var compareType = document.getElementById('selectCompareType');
                this.modeCompare = compareType ? compareType.selectedOption.value : null;

                // calculate final display value based on selection (absolute or change)
                try {
                  if (this.modeCompare=='diff') { // absolute change
                  _valueDisp = _valueMain - _valueComp;
                  } else if (this.modeCompare=='pctdiff') { // percent change
                    if (_valueComp>0) _valueDisp = ((_valueMain - _valueComp) / _valueComp);
                  }
                } catch(err) {
                  _valueDisp = _valueMain;
                }
                
                // If there's a display value for the given SEGID in the _dataMain object, set it
                let attributes = {
                  ...feature.attributes,
                  idLabel: _idAg,
                  dVal: _valueDisp, // Add the dVal to attributes
                  mVal: _valueMain,
                  cVal: _valueComp
                };

                // Create a new graphic with the updated attributes
                var graphic = new Graphic({
                  geometry: feature.geometry,
                  attributes: attributes
                });

                graphicsToAdd.push(graphic);  // Add graphic to the temporary array

                
              });
            }
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
              } else {
                console.log("No features were added.");
              }
          })
          .catch(function(error) {
            console.error("Error applying edits:", error);
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