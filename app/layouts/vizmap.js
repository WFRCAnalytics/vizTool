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
  "esri/widgets/Swipe"
], function(GeoJSONLayer, Graphic, FeatureLayer, SimpleRenderer, ColorVariable, Color, PopupTemplate, Legend, Query, Swipe) {
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
      // Remembers the user's own "Show all"/"Show less" pick for #mapAppliedFilters (setRendererAndLegend()
      // below rebuilds that whole element from scratch on every render - a new filter selection
      // would otherwise silently snap it back to collapsed every time, right as the thing that
      // makes it worth expanding - a long value - is what just changed).
      this.mapSubtitleExpanded = false;
      // The feature layers' own opacity (sidebar's "Map Element Visibility" slider, app.js) -
      // reapplied in initializeLayer() every render (it rebuilds this.layerDisplay/
      // layerDisplayComp from scratch each time, same reasoning as every other per-render
      // rebuild in this file), not just set once from the slider's own handler, or it would
      // silently snap back to fully opaque the next time anything else triggers a re-render.
      this.layerOpacity = 1;
      this.layerDisplay = new FeatureLayer();
      this.mode = 'main'; //default is main  other option is compare
      this.modeCompare = 'diff' //default is abs  other option is pct

      // Non-overlay compare (see getAttributeRendererPath(), updateDisplay() and
      // setCompRendererAndShow()): a second FeatureLayer holding the comp scenario's own
      // natural-value features instead of a diff/pct-diff. Where it lives depends on
      // this.compareView - 'sidebyside' adds it to app.js's separate mapComp (its own
      // MapView, synced with the main one - see vizmap.html's #mapViewRow comment); 'swipe'
      // adds it to the SAME shared map instead, clipped against layerDisplay by an Esri Swipe
      // widget (this.swipeWidget). Only built at all when this.mode === 'compare' and
      // this.compareView is one of those two.
      this.layerDisplayComp = new FeatureLayer();
      this.compareView = 'overlay'; // 'overlay' (default, single diff/pctdiff map), 'sidebyside', or 'swipe'
      this.swipeWidget = null;

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
      // afterUpdateAggregator() ever having run. this.baseGeoJsonId (not data.aggregatorSelected)
      // - the dummy layer built just above is always the BASE geometry regardless of what the
      // config's own default aggregator is, so that's what this needs to say "currently loaded"
      // for updateDisplay()'s very first mismatch check to actually catch a config whose default
      // aggregator differs from its base geometry (previously masked - every existing entity's
      // own default aggregator happened to equal its base, so this was never wrong before now).
      this._loadedAggregatorAgCode = this.baseGeoJsonId;
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

    // this.geometryType is the entity's own native shape (e.g. "point" for Transit Stops) and
    // never changes - but every real aggregator target in this app (city/plan area/district/
    // etc.) is itself a polygon, regardless of what's being aggregated. An entity whose base
    // and aggregate levels are the same shape (every polygon-based entity so far) sees no
    // difference here; one whose base is a different shape (points aggregated up to zone
    // polygons) needs the layer/dummy-geometry/labeling below built for whichever shape is
    // actually on screen right now, not always the native one. getDummyGeometry()/
    // getLabelingInfoConfig()/getPlaceholderRenderer() all key off this instead of
    // this.geometryType directly for that reason.
    getEffectiveGeometryType() {
      const _selectedAggregator = this.getSelectedAggregator();
      if (!_selectedAggregator || _selectedAggregator.agCode === this.baseGeoJsonId) {
        return this.geometryType;
      }
      return 'polygon';
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

      if (this.layerDisplayComp) {
        this.layerDisplayComp.visible = false;
      }
      this.teardownCompareExtras();

      if (this.legend) {
        this.legend.destroy();
        this.legend = null;
      }
    }

    // Hides the side-by-side split (app.js's setMapCompareSplitVisible()) AND destroys the
    // Esri Swipe widget, whichever of the two (if either) is currently showing for this view -
    // called whenever this view stops being the active one (hideLayers()) and whenever a
    // render leaves BOTH non-overlay compare modes (updateDisplay()), so neither lingers after
    // the mode that opened it is gone.
    teardownCompareExtras() {
      if (typeof setMapCompareSplitVisible === 'function') {
        setMapCompareSplitVisible(false);
      }
      if (typeof setMapCompareScenarioLabels === 'function') {
        setMapCompareScenarioLabels(null);
      }
      this.teardownEsriSwipeWidget();
    }

    // Just the Swipe-widget half of teardownCompareExtras() - also called on its own from
    // initializeLayer() whenever a render is NOT in 'swipe' mode specifically (even if it IS in
    // 'sidebyside' mode, which must keep the split visible that teardownCompareExtras() would
    // otherwise hide).
    teardownEsriSwipeWidget() {
      if (this.swipeWidget) {
        mapView.ui.remove(this.swipeWidget);
        this.swipeWidget.destroy();
        this.swipeWidget = null;
      }
    }
    
    getLabelInfo() {
      let attributeRenderer = this.getAttributeRendererPath();
      return attributeRenderer ? attributeRenderer.labelExpressionInfo : null;
    }
    
    getRenderer() {
      let attributeRenderer = this.getAttributeRendererPath();
      let renderer = attributeRenderer ? attributeRenderer.renderer : null;
      // A point/line entity's own renderer (attributes.json) is built with marker/line symbols -
      // once aggregated to zone polygons (getEffectiveGeometryType()), those wouldn't render
      // meaningfully on polygon features. Converts generically (same colors/breakpoints/legend,
      // just simple-fill symbols) instead of requiring a whole second, polygon-specific renderer
      // definition per attribute.
      if (renderer && this.geometryType !== 'polygon' && this.getEffectiveGeometryType() === 'polygon') {
        renderer = this.toPolygonFillRenderer(renderer);
      }
      return renderer;
    }

    // Rebuilds a ClassBreaksRenderer's own symbols as simple-fill polygons, keeping every other
    // piece (field, each break's own min/max/label, defaultLabel, legendOptions) identical. Starts
    // from renderer.clone() (not a fresh ClassBreaksRenderer - avoids importing that class here
    // just for this) and only replaces classBreakInfos/defaultSymbol, since those are the only
    // pieces whose symbol objects need converting - and builds NEW symbol objects rather than
    // mutating the originals, since those come from shared style templates
    // (attribute-templates.json) other attributes/renders also reference.
    toPolygonFillRenderer(renderer) {
      const toFillSymbol = (symbol) => ({
        type: "simple-fill",
        color: symbol.color,
        outline: { color: [255, 255, 255], width: 0.3 }
      });
      const polygonRenderer = renderer.clone();
      polygonRenderer.classBreakInfos = renderer.classBreakInfos.map((cb) => ({
        minValue: cb.minValue,
        maxValue: cb.maxValue,
        label: cb.label,
        symbol: toFillSymbol(cb.symbol)
      }));
      if (renderer.defaultSymbol) {
        polygonRenderer.defaultSymbol = toFillSymbol(renderer.defaultSymbol);
      }
      return polygonRenderer;
    }

    getLayerTitle() {
      let attributeRenderer = this.getAttributeRendererPath();
      return attributeRenderer ? attributeRenderer.title : null;
    }
    
    getAttributeRendererPath() {

      var compareType = document.getElementById('selectCompareType');
      this.modeCompare = compareType ? compareType.value : null; // calcite-segmented-control -
      // no .selectedOption wrapper (unlike the calcite-select it used to be)

      var compareView = document.getElementById('selectCompareView');
      this.compareView = compareView ? compareView.value : 'overlay'; // calcite-segmented-control
      // (not calcite-select, unlike selectCompareType above) - its own current pick is just
      // .value, no .selectedOption wrapper.

      const collection = this.sidebar.getAttributeRendererCollection();

      // The natural (non-diff) classification - used for mode 'main', and also for BOTH
      // sides of a sidebyside/swipe compare, since each side shows a single scenario's own
      // value rather than a computed difference between the two.
      const _naturalRendererPath = () => {
        if (this.dCode !== "Nothing") {
          const _selectedDivider = this.sidebar.dividers.find(divider => divider.attributeCode === this.dCode) || null;
          return _selectedDivider && _selectedDivider.dCode in collection.main_divide_by
            ? collection.main_divide_by[_selectedDivider.dCode]
            : collection.main_divide_by["default"];
        } else {
          return collection.main;
        }
      };

      const _isTwoLayerCompare = this.compareView === 'sidebyside' || this.compareView === 'swipe';
      if (this.mode === 'main' || (this.mode === 'compare' && _isTwoLayerCompare)) {
        return _naturalRendererPath();
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

    // Dummy feature geometry, keyed by geometryType - just enough for the FeatureLayer
    // constructor to infer a geometry type before real features are swapped in via
    // applyEdits() (see updateDisplay()). Factored out of initializeLayer() so the comp
    // layer (side-by-side swipe compare) can be seeded with the exact same shape.
    getDummyGeometry() {
      const _effectiveGeometryType = this.getEffectiveGeometryType();
      if (_effectiveGeometryType === 'polyline') {
        return {
          type: "polyline",
          paths: [
            [-111.8910, 40.7608],
            [-111.8911, 40.7609]
          ],
          spatialReference: { wkid: 4326 }
        };
      } else if (_effectiveGeometryType === 'polygon') {
        return {
          type: "polygon",
          rings: [
            [-111.8910, 40.7608],
            [-111.8911, 40.7609],
            [-111.8912, 40.7610],
            [-111.8910, 40.7608]
          ],
          spatialReference: { wkid: 4326 }
        };
      } else if (_effectiveGeometryType === 'point') {
        return {
          type: "point",
          longitude: -111.8910,
          latitude: 40.7608,
          spatialReference: { wkid: 4326 }
        };
      }
    }

    // FeatureLayer field declarations - identical regardless of geometryType, so both
    // layerDisplay and (when swiping) layerDisplayComp can share this.
    getFieldDefs(dValFieldType) {
      return [
        { name: this.baseGeoJsonId, type: "oid" },  // Object ID field
        { name: "idLabel", type: "string"},
        { name: "dVal", type: dValFieldType, alias: this.aCode },
        { name: "mVal", type: dValFieldType, alias: this.getMainScenarioDisplayName()},
        { name: "cVal", type: dValFieldType, alias: this.getCompScenarioDisplayName()},
        ...this.getPopupExtraFieldDefs()
      ];
    }

    // Also identical regardless of geometryType. The comp layer reuses the same popup
    // (still showing both scenarios' values via mVal/cVal) rather than a single-scenario
    // one - simplest option, and clicking either side of the swipe still shows the full
    // Main vs. Comp comparison.
    getPopupTemplateConfig() {
      return {
        title: this.getPopupTitle(),
        content: this.popupContent,
        expressionInfos: this.expressionInfos
      };
    }

    // Only the font size/label placement vary by geometryType (lines get a smaller,
    // along-the-line label; polygons/points get a larger, horizontal one). layerDisplay and
    // layerDisplayComp each live in their own MapView in 'sidebyside' mode (see vizmap.html's
    // #mapViewRow comment), so there's no cross-layer label competition to work around here -
    // each one just labels itself normally, same as the regular single-map view. 'swipe' mode
    // forces labelingInfo to [] instead of calling this (see initializeLayer()) since the two
    // layers share one MapView there and Esri's Swipe widget suppresses most of the trailing
    // layer's labels regardless of this config - see the Swipe widget comment further down.
    getLabelingInfoConfig() {
      const _isLine = this.getEffectiveGeometryType() === 'polyline';
      return [{
        symbol: {
          type: "text",
          color: [50, 50, 50],
          haloColor: "white",
          haloSize: "2px",
          font: {
            family: "sans-serif",
            size: _isLine ? 9 : 10,
            weight: "normal"
          }
        },
        labelPlacement: _isLine ? "center-along" : "always-horizontal",
        labelExpressionInfo: { expression: this.getLabelInfo() }
      }];
    }

    // Placeholder "no data yet" renderer a freshly (re)built layer starts with, before
    // setRendererAndLegend()/setCompRendererAndShow() assign the real attribute renderer.
    getPlaceholderRenderer() {
      const _effectiveGeometryType = this.getEffectiveGeometryType();
      if (_effectiveGeometryType === 'polyline') {
        return {
          type: "simple",
          symbol: { type: 'simple-line', color: [255, 255, 255], width: 0.2 }
        };
      } else if (_effectiveGeometryType === 'polygon') {
        return {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [0, 0, 0, 0],
            outline: { color: [255, 255, 255], width: 0.2 }
          }
        };
      } else if (_effectiveGeometryType === 'point') {
        return {
          type: "simple",
          symbol: {
            type: "simple-marker",
            color: [0, 0, 0, 0],
            size: 6,
            outline: { color: [255, 255, 255], width: 0.5 }
          }
        };
      }
      return null;
    }

    initializeLayer() {

      // MANUALLY SET SCENARIO -- REPLACE WITH PROGRAMATIC SOLUTION
      const dValFieldType = (this.aCode === 'aFtClass') ? "string" : "double";

      this.dummyFeature = {
        geometry: this.getDummyGeometry(),
        attributes: {
          id: 0,
          idLabel: "",
          dVal: null,
          mVal: null,
          cVal: null,
          ...this.getPopupExtraFieldDefaults()
        }
      };

      const _isSideBySide = (this.mode === 'compare' && this.compareView === 'sidebyside');
      const _isSwipeMode = (this.mode === 'compare' && this.compareView === 'swipe');

      const _layerConfig = {
        source: [this.dummyFeature],
        fields: this.getFieldDefs(dValFieldType),
        popupTemplate: this.getPopupTemplateConfig(),
        // 'swipe' shares one MapView between layerDisplay/layerDisplayComp, and Esri's Swipe
        // widget suppresses most of the trailing layer's labels regardless of any labeling
        // config - rather than show a misleadingly-partial set of labels, turn labels off
        // entirely for both layers while swipe mode is active.
        labelingInfo: _isSwipeMode ? [] : this.getLabelingInfoConfig(),
        renderer: this.getPlaceholderRenderer()
      };

      this.layerDisplay = new FeatureLayer(_layerConfig);
      this.layerDisplay.opacity = this.layerOpacity;
      map.add(this.layerDisplay);

      // Second, parallel layer sharing the same geometry/fields/popup as layerDisplay, which
      // updateDisplay() populates with the comp scenario's own values (via
      // getAttributeRendererPath()'s natural renderer and the dVal swap in updateDisplay())
      // instead of a diff/pct-diff. 'sidebyside' puts it in app.js's separate mapComp (its own
      // MapView - see vizmap.html's #mapViewRow comment); 'swipe' puts it in the same shared
      // map instead, for setCompRendererAndShow()'s Esri Swipe widget to clip against
      // layerDisplay. Torn down in teardownCompareExtras()/hideLayers() when neither applies.
      if (_isSideBySide || _isSwipeMode) {
        this.layerDisplayComp = new FeatureLayer({ ..._layerConfig, source: [this.dummyFeature] });
        this.layerDisplayComp.opacity = this.layerOpacity;
        (_isSideBySide ? mapComp : map).add(this.layerDisplayComp);
      } else if (this.layerDisplayComp) {
        mapComp.remove(this.layerDisplayComp);
        map.remove(this.layerDisplayComp);
      }
      if (typeof setMapCompareSplitVisible === 'function') {
        setMapCompareSplitVisible(_isSideBySide);
      }
      if (!_isSwipeMode) {
        this.teardownEsriSwipeWidget();
      }
      // The real two-scenario label text is set once setCompRendererAndShow() has the comp
      // layer's data ready - for every other render (overlay, or no compare), show the label
      // here instead (every map gets one, not just while comparing) - Main alone outside compare
      // mode, "Main vs. Comp" in overlay compare (setMapCompareScenarioLabels's own 'overlay'
      // branch, app.js, only adds the "vs." part when a comp name is actually passed).
      if (!_isSideBySide && !_isSwipeMode && typeof setMapCompareScenarioLabels === 'function') {
        setMapCompareScenarioLabels('overlay', this.getMainScenarioDisplayName(), this.mode === 'compare' ? this.getCompScenarioDisplayName() : null);
      }
    }

    // Function to be called when the label toggle button's active state changes
    toggleLabels() {
      console.log('vizmap:toggleLabels')
      var labelToggle = document.getElementById('vizMapLabelToggle');
      if (this.layerDisplay) {
        this.sidebar.setAttributeLabelStatus(labelToggle.active);
        // Labels are forced off for 'swipe' mode (see initializeLayer()'s _isSwipeMode check) -
        // don't let the label toggle override that with the real labelingInfo this.originalLabelInfo
        // may still be holding from a previous, non-swipe render.
        if (this.mode === 'compare' && this.compareView === 'swipe') {
          this.layerDisplay.labelingInfo = [];
          this.layerDisplay.refresh();
          if (this.layerDisplayComp && this.layerDisplayComp.loaded) {
            this.layerDisplayComp.labelingInfo = [];
            this.layerDisplayComp.refresh();
          }
          return;
        }
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

        // Keep the comp view's labels in lockstep with the main one's on/off state.
        if (this.layerDisplayComp && this.layerDisplayComp.loaded) {
          this.layerDisplayComp.labelingInfo = this.layerDisplay.labelingInfo;
          this.layerDisplayComp.refresh();
        }
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
      map.remove(this.layerDisplayComp); // may be here ('swipe') or in mapComp ('sidebyside') - removing from both is a safe no-op either way
      if (mapComp) mapComp.remove(this.layerDisplayComp);

      // get main data
      var _dataMain = this.getDataMain();
      // get data for weighting
      if (this.sidebar.getWeightCode()) {
        var _dataWeightMain = this.getDataWeightMain();
      }


      // get compare data
      if (document.getElementById('comparisonScenario').open & this.getComp() !== null) {
        this.mode = 'compare';
        var compareViewSelect = document.getElementById('selectCompareView');
        this.compareView = compareViewSelect ? compareViewSelect.value : 'overlay'; // calcite-segmented-control
        var _dataComp = this.getDataComp();
        // get data for weighting
        if (this.sidebar.getWeightCode()) {
          var _dataWeightComp = this.getDataWeightComp();
        }
      } else {
        this.mode = 'main';
        this.compareView = 'overlay';
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

        // Diff/pct-diff coloring (red = Main higher, blue = Main lower, or possibly reversed -
        // see updateMapCompareColorHint()'s own comment, app.js) only ever applies in overlay
        // mode - sidebyside/swipe each show a natural single-scenario renderer instead (see
        // getAttributeRendererPath()'s _isTwoLayerCompare branch), so the hint has nothing to
        // explain there.
        if (typeof updateMapCompareColorHint === 'function') {
          updateMapCompareColorHint(this.mode === 'compare' && this.compareView === 'overlay' ? this.layerDisplay.renderer : null, this.getMainScenarioDisplayName());
        }

        this.layerDisplay.refresh();
        this.layerDisplay.visible = true;
          
        this.layerDisplay.queryFeatures().then(function(results) {
          console.log("Total number of features in layer:", results.features.length);
        });

        // Lives in the right sidebar (#mapSidebarRightLegend) now, not floating over the map.
        // Esri widgets' destroy() removes their own container node from the DOM entirely, not
        // just its content - mounting straight into #mapSidebarRightLegend itself would delete
        // that div the first time a prior legend gets destroyed, permanently breaking every
        // render after (and its "LEGEND" heading, styles.css's ::before on that same id). Mount
        // into a fresh inner wrapper each time instead, so the outer div survives forever.
        if (this.legend) {
          this.legend.destroy();
        }
        // Belt-and-suspenders beyond this.legend.destroy() above: switching between two
        // different model entities (not just between aggregators within this same one) can
        // reach this point for the NEW entity's VizMap instance before the OLD one's own
        // hideLayers() has actually run against IT, since #mapSidebarRightLegend is one shared,
        // permanent DOM node every entity's instance points its own this.legend at - leaving a
        // previous entity's own legendInner (and its now-stale "— LEGEND —" caption/colors)
        // stacked in here alongside the new one instead of replaced by it. Clearing every
        // sibling but the permanent header row (setupLegendPopout(), app.js) guarantees exactly
        // one legendInner ever exists here, regardless of which instance's this.legend is stale.
        const legendContainer = document.getElementById('mapSidebarRightLegend');
        Array.from(legendContainer.children).forEach((child) => {
          if (!child.classList.contains('map-legend-header-row')) child.remove();
        });

        if (this.dCode!="Nothing") {
          if (this.layerDisplay.renderer.visualVariables) {
            this.layerDisplay.renderer.visualVariables.forEach((visualVariable) => {
              visualVariable.legendOptions = {
                title: this.getLayerDisplayName()
              }
            });
          }
        }

        const legendInner = document.createElement('div');
        legendContainer.appendChild(legendInner);

        // No title here anymore - setMapCompareScenarioLabels() (app.js) puts the same scenario
        // name(s) this used to build in a corner label over the map itself, in every mode (not
        // just compare), so repeating it as the legend's own title was now just redundant.
        this.legend = new Legend({
          view: mapView,
          container: legendInner,
          layerInfos: [{
            layer: this.layerDisplay
          }]
        });

        // toggle labels based on persisted per-attribute status
        this.originalLabelInfo = this.layerDisplay.labelingInfo;

        var labelToggle = document.getElementById('vizMapLabelToggle');
        labelToggle.active = this.sidebar.getAttributeLabelStatus();
        updateLabelToggleTooltip(labelToggle);
        this.toggleLabels();

        // Same reasoning as the label toggle above - this.layerOpacity (app.js's opacity
        // slider) is per-VizMap-instance, so switching to a different model entity needs the
        // slider's own displayed value resynced to match whatever THIS instance's opacity
        // actually is, not left showing whatever the previously active entity's was.
        var opacitySlider = document.getElementById('vizMapOpacitySlider');
        if (opacitySlider) opacitySlider.value = this.layerOpacity;

      };

      // No separate title here - mapScenarioLabelMain (app.js's setMapCompareScenarioLabels())
      // already floats the same scenario name(s)/"vs." phrasing over the map's own top-left
      // corner, so a second one here would just be duplicate text. #mapFooter keeps just the
      // filter-selection breadcrumb.
      const footerElement = document.getElementById('mapFooter');
      footerElement.innerHTML = '';

      const _subTitleDiv = document.createElement('div');
      _subTitleDiv.id = 'mapAppliedFilters';
      _subTitleDiv.innerHTML = this.sidebar.getSelectedOptionsAsLongText();
      footerElement.appendChild(_subTitleDiv);

      // Collapsed to 2 lines (-webkit-line-clamp, styles.css) by default - some filters (e.g.
      // Route Name, with many values checked at once) can produce enough text to need more than
      // that. Measured here, before .expanded (below) ever gets applied - once that class is on,
      // #mapAppliedFilters wraps freely instead of clamping, so scrollHeight stops being a meaningful
      // truncation test.
      const _isTruncated = _subTitleDiv.scrollHeight > _subTitleDiv.clientHeight + 1;

      // Starts from this.mapSubtitleExpanded (not always collapsed) - this whole element gets
      // rebuilt from scratch on every render (a new filter selection included), which would
      // otherwise silently re-collapse it right as a new, possibly longer, value is what just
      // changed.
      _subTitleDiv.classList.toggle('expanded', this.mapSubtitleExpanded);

      if (_isTruncated || this.mapSubtitleExpanded) {
        const _expandBtn = document.createElement('button');
        _expandBtn.className = 'map-subtitle-expand-btn';
        _expandBtn.type = 'button';
        _expandBtn.textContent = this.mapSubtitleExpanded ? 'Show less' : 'Show all';
        _expandBtn.addEventListener('click', () => {
          this.mapSubtitleExpanded = !this.mapSubtitleExpanded;
          _subTitleDiv.classList.toggle('expanded', this.mapSubtitleExpanded);
          _expandBtn.textContent = this.mapSubtitleExpanded ? 'Show less' : 'Show all';
        });
        footerElement.appendChild(_expandBtn);
      }

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
              this.modeCompare = compareType ? compareType.value : null; // calcite-segmented-control

              // calculate final display value based on selection (absolute or change)
              try {
                if (this.mode==='compare') {
                  if (this.compareView==='sidebyside' || this.compareView==='swipe') { // two-layer compare: main layer shows its own natural value
                    _valueDisp = _valueMain;
                  } else if (this.modeCompare=='diff') { // absolute change
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
                this.modeCompare = compareType ? compareType.value : null; // calcite-segmented-control

                // calculate final display value based on selection (absolute or change)
                try {
                  if (this.mode==='compare' && (this.compareView==='sidebyside' || this.compareView==='swipe')) { // two-layer compare: main layer shows its own natural value
                    _valueDisp = _valueMain;
                  } else if (this.modeCompare=='diff') { // absolute change
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

          // Non-overlay compare (sidebyside or swipe): clone each graphic for the second
          // layer, swapping in the comp scenario's own value (cVal, computed above alongside
          // mVal) as its dVal - see getAttributeRendererPath() for the matching
          // natural-symbology renderer both sides use instead of a diff/pct-diff one.
          const _buildCompLayer = (vizMapInstance.mode === 'compare' &&
            (vizMapInstance.compareView === 'sidebyside' || vizMapInstance.compareView === 'swipe'));
          const graphicsToAddComp = _buildCompLayer
            ? graphicsToAdd.map(g => new Graphic({ geometry: g.geometry, attributes: { ...g.attributes, dVal: g.attributes.cVal } }))
            : [];

          // Source modifications will not propagate after layer has been loaded. Please use .applyEdits() instead
          vizMapInstance.layerDisplay.applyEdits({ addFeatures: graphicsToAdd })
            .then(function(editsResult) {
              if (editsResult.addFeatureResults.length > 0) {
                console.log("Number of features added:", editsResult.addFeatureResults.length);
                // Call this AFTER adding graphics to the feature layer
                setRendererAndLegend();

                // update agg table
                vizMapInstance.sidebar.updateFilterDisplay();

                if (_buildCompLayer && vizMapInstance.layerDisplayComp) {
                  vizMapInstance.layerDisplayComp.applyEdits({ addFeatures: graphicsToAddComp })
                    .then(function() {
                      vizMapInstance.setCompRendererAndShow();
                    })
                    .catch(function(error) {
                      console.error("Error applying edits to comp layer:", error);
                    });
                } else {
                  // Left both non-overlay modes (or never entered either) since the last
                  // render - make sure no leftover split/widget/comp layer is still showing.
                  vizMapInstance.teardownCompareExtras();
                  if (vizMapInstance.layerDisplayComp) {
                    vizMapInstance.layerDisplayComp.visible = false;
                  }
                  // teardownCompareExtras() just hid both labels outright - show the label back
                  // again, same as initializeLayer() does for this same overlay case.
                  if (typeof setMapCompareScenarioLabels === 'function') {
                    setMapCompareScenarioLabels('overlay', vizMapInstance.getMainScenarioDisplayName(), vizMapInstance.mode === 'compare' ? vizMapInstance.getCompScenarioDisplayName() : null);
                  }
                }
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

    // Styles the comp layer with the same natural renderer as the main layer and makes it
    // visible - called once the comp layer's own applyEdits() (updateDisplay()) has resolved.
    // For 'sidebyside', that's all that's needed - the split itself (two independent MapViews,
    // not Esri's Swipe widget) was already shown by initializeLayer()'s
    // setMapCompareSplitVisible(true) earlier in this same render. For 'swipe', this also
    // (re)builds the Esri Swipe widget clipping the two layers against each other in the
    // single shared mapView - see vizmap.html's #mapViewRow comment for why 'sidebyside' exists
    // as a separate, labels-safe alternative to this one.
    setCompRendererAndShow() {
      if (!this.layerDisplayComp) return;

      this.layerDisplayComp.renderer = this.getRenderer();
      if (this.compareView === 'swipe') {
        // Keep labels off on both sides - see initializeLayer()'s _isSwipeMode comment.
        this.layerDisplay.labelingInfo = [];
        this.layerDisplayComp.labelingInfo = [];
      } else {
        this.layerDisplayComp.labelingInfo = this.layerDisplay.labelingInfo;
      }
      this.layerDisplayComp.refresh();
      this.layerDisplayComp.visible = true;

      if (typeof setMapCompareScenarioLabels === 'function') {
        setMapCompareScenarioLabels(this.compareView, this.getMainScenarioDisplayName(), this.getCompScenarioDisplayName());
      }

      if (this.compareView !== 'swipe') return;

      this.teardownEsriSwipeWidget();
      this.swipeWidget = new Swipe({
        view: mapView,
        // "Compare to:" (layerDisplayComp) on the left/leading side, Main (layerDisplay) on
        // the right/trailing side - see the matching legend title order below.
        leadingLayers: [this.layerDisplayComp],
        trailingLayers: [this.layerDisplay],
        direction: "horizontal",
        position: 50
      });
      mapView.ui.add(this.swipeWidget);
    }

  }
  
  // Export ModelEntity to the global scope
  // Exporting to Global Scope (Not recommended but works): If you want to make the ModelEntity class globally accessible (not a good practice but will solve the immediate issue):
  window.VizMap = VizMap;

});