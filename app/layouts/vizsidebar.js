class VizSidebar {
  constructor(attributes, attributeSelected, attributeTitle, filters, aggregators, aggregatorSelected, aggregatorTitle, dividers, dividerSelected, dividerTitle, vizLayout) {
    // Several unrelated model entities happen to share the same attributeTitle (e.g. "Special
    // Trips" and "Special Trip Trends" are both "Trip Gen Attribute"), so an id derived from
    // attributeTitle alone collides across entities - every widget built off this.id (the
    // attribute radio group, filter checkboxes/selects, etc.) then shares a DOM id/name with
    // the other entity's equivalent widget, and calcite's native-radio-style "one checked per
    // name" exclusivity fights across the two once both have rendered at least once. Prefer the
    // owning model entity's submenuText instead - that's guaranteed unique (it's what the menu
    // and URL restore already key off of) - falling back to attributeTitle only if it's ever
    // unavailable.
    this.id = this.generateIdFromText(vizLayout?.modelEntity?.submenuText || attributeTitle) + "-sidebar"; // use provided id or generate one if not provided

    // link to parent
    this.vizLayout = vizLayout;
    
    this.attributes       = (attributes  || []).map(item => new Attribute (item));
    this.aggregators      = (aggregators || []).map(item => new Aggregator(item));
    this.dividers         = (dividers    || []).map(item => new Divider   (item));

    if (attributes) {
      
      const attributeOptions = attributes.map(attributeCode => {
        const configAt = configAttributes[attributeCode];
        if (!configAt || !configAt.alias) {
          console.error(`Error: Missing configuration or title text for attribute code: ${agCode}`);
          return { value: attributeCode, label: 'Unknown' }; // Provide a default value in case of error
        }
        return { value: attributeCode, label: configAt.alias };
      });

      // The attribute list's own title/info-icon is dropped now that the "— ATTRIBUTES —"
      // section label sits above the whole column - a "Definitions" button (see
      // renderDefinitionsButton()/openDefinitionsPopup() below) replaces the old inline
      // title+hover, built from each Attribute's own alias/definition (config/attributes.json)
      // rather than a single hand-written HTML blob per model entity.
      this.attributeTitle = attributeTitle;
      this.attributeSelect   = new WijRadio(this.id + "-attribute-selector",
                                            attributeTitle,
                                            attributeSelected,
                                            attributeOptions,
                                            this,
                                            "",
                                            false,
                                            false,
                                            false);
      this.filters = (filters || []).map(item => new Filter (item, this.vizLayout));
    }

    if (aggregators) {

      const aggregatorOptions = aggregators.map(agCode => {
        const configAg = configAggregators[agCode];
        if (!configAg || !configAg.agTitleText) {
          console.error(`Error: Missing configuration or title text for aggregator code: ${agCode}`);
          return { value: agCode, label: 'Unknown' }; // Provide a default value in case of error
        }
        return { value: agCode, label: configAg.agTitleText };
      });

      const currentAggregator = this.aggregators.find(item => item.agCode === aggregatorSelected) || [];

      this.aggregatorSelect = new WijSelect(this.id + "_aggregator-selector",
                                            aggregatorTitle,
                                            aggregatorSelected,
                                            aggregatorOptions,
                                            this);
      if (this.usesAggregatorFilter()) {
        this.aggregatorFilter = new Filter (null, this.vizLayout, this.buildAggregatorFilterData(currentAggregator.filterData), {agGeoJsonKey: currentAggregator.agGeoJsonKey, agCode: currentAggregator.agCode, agCodeLabelField: currentAggregator.agCodeLabelField});
      }

    }

    if (this.dividers.length>0) {
      if (dividerSelected=="") {
        dividerSelected = "Nothing";
      }
      const _nothing = { value: "Nothing", label: "----------" };
      this.dividerSelect    = new WijSelect(this.id + "_divider-selector",
                                            dividerTitle,
                                            dividerSelected,
                                            [_nothing, ...this.dividers.map(item => ({ value: item.attributeCode, label: item.alias }))],
                                            this,
                                            false);
      //this.dividerFilters = (dividerFilters || []).map(item => new Filter (item, vizLayout));
    }

  }

  render() {
    console.log('vizsidebar:render:' + this.id);
  
    // Function to create and append a container
    function createAndAppendContainer(parentId, containerId) {
      const parentDiv = document.getElementById(parentId);
      if (parentDiv) {
        parentDiv.innerHTML = '';
        const containerDiv = document.createElement('div');
        containerDiv.id = containerId;
        return containerDiv;
      }
      return null;
    }
  
    // Define the elements to process
    const elements = [
      { name: "Attributes", render: () => {
          if (!this.attributeSelect) return null;
          const parts = [this.attributeSelect.render()];
          if (this.attributes.some(item => item.definition)) parts.push(this.renderDefinitionsButton());
          return parts;
        }
      },
      { name: "AttributeFilters", render: () => this.filters ? this.filters.map(filter => filter.render()) : null},
      // With only one possible aggregator (e.g. Total Trips Trends' aggregators:["SUBAREAID"]),
      // there's nothing to pick between - same reasoning AggregatorFilters already uses for its
      // own single-option case just below.
      { name: "Aggregator", render: () => (this.aggregatorSelect && this.aggregators.length > 1) ? this.aggregatorSelect.render() : null },
      { name: "AggregatorFilters", render: () => (this.aggregatorFilter && !this.aggregatorFilterHasSingleOption) ? this.aggregatorFilter.render() : null },
      { name: "Dividers", render: () => this.dividerSelect ? this.dividerSelect.render() : null },
      { name: "DividerFilters" }
    ];
  
    // Process each element
    elements.forEach(element => {
      const divId = this.getDiv(element.name);
  
      // Only create and append a container if there is content to render
      if (element.render) {
        const content = element.render();

        if (content) {
          const container = createAndAppendContainer(divId, `container${element.name}`);
    
          if (container) {
            const divElement = document.getElementById(divId);
            if (divElement) {
              if ((element.name === "Aggregator" || element.name === "AggregatorFilters") && (!this.aggregatorSelect)) {
                divElement.style.display = 'none';
              } else {
                divElement.style.display = 'block';
              }
            }
    
            if (Array.isArray(content)) {
              content.forEach(child => container.appendChild(child));
            } else if (content) {
              container.appendChild(content);
            }
            // Append the container only if it contains content
            const parentDiv = document.getElementById(divId);
            if (parentDiv && container.hasChildNodes()) {
              parentDiv.appendChild(container);
            }
          }
        } else {
          const divElement = document.getElementById(divId);
          if (divElement) {
            // Clear any content from a previous render (e.g. switching from a multi-option
            // aggregator to a single-option one, where AggregatorFilters now renders null) -
            // otherwise it'd stay in the DOM just hidden, which the adjacent-sibling
            // :not(:empty) CSS merge rule (styles.css) would still see as non-empty.
            divElement.innerHTML = '';
            divElement.style.display = 'none';
          }
        }
      }
    });
  
    this.updateFilterDisplay();
  }

  // Sits below the attribute list (see the "Attributes" element in render() above), opening a
  // floating popup - built the same way as a Filter's "Reference Map" button/#mapPopup - listing
  // every attribute in this sidebar's list that has a "definition" in config/attributes.json.
  renderDefinitionsButton() {
    const btn = document.createElement('calcite-button');
    btn.innerText = "Definitions";
    btn.classList.add('reference-map-button'); // same pill styling as Reference Map/Check All
    btn.round = true;
    btn.onclick = () => this.openDefinitionsPopup();

    const container = document.createElement('div');
    container.appendChild(btn);
    return container;
  }

  openDefinitionsPopup() {
    const popup = document.getElementById("definitionsPopup");
    if (!popup) return;

    // Cheap to rebuild every time (plain text, no ArcGIS view to keep alive like #mapPopup),
    // so no init-once caching - always reflects this sidebar's current attribute list.
    popup.innerHTML = "";

    const header = document.createElement("div");
    header.className = "definitions-popup-header";
    const heading = document.createElement("h1");
    heading.innerText = "Definitions";
    const closeBtn = document.createElement("span");
    closeBtn.className = "modal-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => this.closeDefinitionsPopup();
    header.appendChild(heading);
    header.appendChild(closeBtn);
    popup.appendChild(header);

    const body = document.createElement("div");
    body.className = "definitions-popup-body";
    this.attributes.filter(item => item.definition).forEach(item => {
      const entry = document.createElement("p");
      entry.innerHTML = `<b>${item.alias}</b> ${item.definition}`;
      body.appendChild(entry);
    });
    popup.appendChild(body);

    makeDraggable(header, popup);

    popup.style.display = "flex"; // #definitionsPopup is a flex column (header + scrolling body)
  }

  closeDefinitionsPopup() {
    const popup = document.getElementById("definitionsPopup");
    if (popup) popup.style.display = "none";
  }

  hideLayout() {
    console.log('vizsidebar:hideLayout');
  }
  
  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  getDiv(suffix) {
    return this.vizLayout.constructor.name.charAt(0).toLowerCase() + this.vizLayout.constructor.name.slice(1) + suffix;
  }
  
  findAllCombinationsOfLists(lists, prefix = '', separator = '_') {
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
        combinations = combinations.concat(this.findAllCombinationsOfLists(remainingLists, newPrefix, separator));
    });

    return combinations;
  }

  getListOfSelectedFilterOptions() {
    const _listsOfEachFilter = this.filters
                                   .filter(filter => filter.isVisible()) // Only include filters where isVisible is false
                                   .map(filter => filter.getSelectedOptionsAsList())
    return this.findAllCombinationsOfLists(_listsOfEachFilter);
  }

  getListOfSelectedFilterOptionsWithLock(lockedFCode, lockedValue) {
    // Get the list of filters excluding the lockedFilter

    const _fCodeList = this.filters
                                   .filter(filter => filter.isVisible()) // Only include filters where isVisible is false
                                   .map(filter => filter.fCode)

    const _lockedFCodeIndex = _fCodeList.indexOf(lockedFCode);

    const _listsOfEachFilter = this.filters
                                     .filter(filter => filter.isVisible() && filter.fCode !== lockedFCode) // Exclude locked filter
                                     .map(filter => filter.getSelectedOptionsAsList());
  

    // Insert the locked filter's value as a single-item list at the locked filter's index
    if (_lockedFCodeIndex !== -1) {
      _listsOfEachFilter.splice(_lockedFCodeIndex, 0, [lockedValue]); // Insert as a single item list
    }
  
    return this.findAllCombinationsOfLists(_listsOfEachFilter);
  }

  // Same as getListOfSelectedFilterOptions(), but membership is decided by an explicit
  // filterGroupArray (the real filter codes behind the current attribute's data key for one
  // specific scenario) instead of filter.isVisible(). Needed by vizTrends: a chart can span
  // scenarios from different model versions whose filter groups for the same attribute code
  // differ (e.g. a CVM refactor added/renamed a filter dimension), so which filters belong in
  // the lookup key can't be decided once globally off whichever filters happen to be shown.
  getListOfSelectedFilterOptionsForGroup(filterGroupArray) {
    const _fGroup = filterGroupArray || [];
    const _listsOfEachFilter = this.filters
                                   .filter(filter => _fGroup.includes(filter.fCode))
                                   .map(filter => filter.getSelectedOptionsAsList())
    return this.findAllCombinationsOfLists(_listsOfEachFilter);
  }

  // Same as getListOfSelectedFilterOptionsWithLock(), but membership is decided by an explicit
  // filterGroupArray instead of filter.isVisible() - see getListOfSelectedFilterOptionsForGroup().
  getListOfSelectedFilterOptionsWithLockForGroup(filterGroupArray, lockedFCode, lockedValue) {
    const _fGroup = filterGroupArray || [];

    const _fCodeList = this.filters
                                   .filter(filter => _fGroup.includes(filter.fCode))
                                   .map(filter => filter.fCode)

    const _lockedFCodeIndex = _fCodeList.indexOf(lockedFCode);

    const _listsOfEachFilter = this.filters
                                     .filter(filter => _fGroup.includes(filter.fCode) && filter.fCode !== lockedFCode)
                                     .map(filter => filter.getSelectedOptionsAsList());

    // Insert the locked filter's value as a single-item list at the locked filter's index
    if (_lockedFCodeIndex !== -1) {
      _listsOfEachFilter.splice(_lockedFCodeIndex, 0, [lockedValue]); // Insert as a single item list
    }

    return this.findAllCombinationsOfLists(_listsOfEachFilter);
  }

  getSelectedOptionsAsLongText() {
    return this.filters.filter(filter => filter.isVisible()).map(filter => '<b>' + filter.filterWij.title + ':</b> ' + filter.getSelectedOptionsAsListOfLabels()).join('; ');
  }

  // The aggregator's own checkbox sub-filter (e.g. "Select Summary Geography" -> "Plan Area":
  // MAG, WFRC). Kept separate from getSelectedOptionsAsLongText() above since that method's
  // existing callers (vizMap/vizMatrix/vizTrends) use aggregatorFilter for a different purpose
  // (vizTrends' zone series picker) - this is specifically for vizDashboard's subtitle.
  getSelectedAggregatorFilterText() {
    if (!this.aggregatorFilter) return '';
    return '<b>' + this.aggregatorFilter.filterWij.title + ':</b> ' + this.aggregatorFilter.getSelectedOptionsAsListOfLabels();
  }


  // get the attribute code that is selected
  getACode() {
    return this.attributeSelect.selected;
  }

  // get the divider code that is selected
  getDCode() {
    return this.dividerSelect?.selected ?? "Nothing";
  }

  getADisplayName() {
    const attributeCode = this.getACode();
    const item = this.attributes.find(item => item.attributeCode === attributeCode);
  
    if (item && item.alias) {
      return item.alias;
    }
  
    return ""; // Or return a default value or `undefined` as needed
  }

  getWeightCode() {
    const attributeCode = this.getACode();
    const item = this.attributes.find(item => item.attributeCode === attributeCode);
  
    if (item && item.agWeightCode) {
      return item.agWeightCode;
    }
  
    return ""; // Or return a default value or `undefined` as needed
  }

  getWeightCodeFilter() {
    const attributeCode = this.getACode();
    const item = this.attributes.find(item => item.attributeCode === attributeCode);
  
    if (item && item.agWeightCodeFilter) {
      return item.agWeightCodeFilter;
    }
  
    return ""; // Or return a default value or `undefined` as needed
  }

  getAgFilterOptionsMethod() {
    const attributeCode = this.getACode();
    const item = this.attributes.find(item => item.attributeCode === attributeCode);
  
    if (item && item.agFilterOptionsMethod) {
      return item.agFilterOptionsMethod;
    }
  
    return ""; // Or return a default value or `undefined` as needed
  }
  
  getSelectedAggregator() {
    let foundAggregator = this.aggregators.find(obj => obj.agCode === this.aggregatorSelect.selected);
    if (foundAggregator) {
      return foundAggregator;
    }
  }

  getAttributeRendererCollection() {
    return this.attributes.find(item => item.attributeCode === this.getACode()).rendererCollection;
  }

  getAttributeLabelStatus() {
    return this.attributes.find(item => item.attributeCode === this.getACode()).labelsOn;
  }
  
  setAttributeLabelStatus(status) {
    this.attributes.find(item => item.attributeCode === this.getACode()).labelsOn = status;
  }
  
  afterUpdateSidebar() {
    this.updateFilterDisplay();
    this.vizLayout.afterUpdateSidebar();
  }

  afterUpdateAggregator() {
    if (this.usesAggregatorFilter()) {
      const selectedAggregator = this.getSelectedAggregator();
      this.aggregatorFilter = new Filter(
          null,
          this.vizLayout,
          this.buildAggregatorFilterData((this.aggregators.find(item => item.agCode === this.aggregatorSelect.selected) || []).filterData),
          {
              agGeoJsonKey: selectedAggregator.agGeoJsonKey,
              agCode: selectedAggregator.agCode,
              agCodeLabelField: selectedAggregator.agCodeLabelField
          }
      );
      // #mapPopup is only ever created lazily, the first time a Filter's "Reference Map"
      // button is actually clicked (see Filter.openMapPopup()) - if that's never happened
      // yet in this session, it doesn't exist, and dereferencing it unconditionally used to
      // throw here, aborting this method before reaching afterUpdateAggregator() below (the
      // call that actually re-renders the sidebar) - which is why picking a new aggregator
      // looked like it did nothing. Guarded the same way Filter.closeMapPopup() already is.
      const mapPopup = document.getElementById("mapPopup");
      if (mapPopup) mapPopup.style.display = "none";
    }
    // "Select Zone Geography" should be the same no matter which view you're on - push this
    // choice out to every other view's aggregator picker too (where it's a valid option).
    syncSelectedZoneGeography(this.aggregatorSelect.selected, this);
    this.vizLayout.afterUpdateAggregator();
  }

  // vizTrends and vizMatrix both offer a "Select Zone Geography" aggregator whose options are
  // real map geometry (TAZ, district, etc.) - a Reference Map showing that geometry helps in
  // both. vizMap doesn't need it since it already IS the map.
  usesAggregatorFilter() {
    return this.vizLayout.modelEntity.template === 'vizTrends' || this.vizLayout.modelEntity.template === 'vizMatrix' || this.vizLayout.modelEntity.template === 'vizDashboard';
  }

  // vizTrends uses the aggregatorFilter's checkbox list as a real series picker (which zones
  // to plot - see VizTrends.buildChart()/updateAllChartData()) - starting empty there is
  // correct, since plotting every zone as its own line by default would be unreadable.
  // vizMatrix uses it to scope the PA table to just the checked origin zones (see
  // VizMatrix.getMatrixData()/filterMatrixDataByAggregatorFilter()) - there, empty should mean
  // "nothing selected yet" while still showing the full table until someone actually narrows
  // it down, so it starts all-checked instead of Aggregator's own empty default.
  buildAggregatorFilterData(filterData) {
    let result = filterData;
    if (this.vizLayout.modelEntity.template === 'vizMatrix' && result && result.fOptions) {
      result = { ...result, fSelected: result.fOptions.map(option => option.value) };
    }

    // With only one possible geography (e.g. SUBAREAID's single "Wasatch Front Model Area"),
    // there's nothing meaningful to filter - the "AggregatorFilters" render() branch below
    // hides the checklist entirely in that case, but only after this guarantees that one
    // option is actually selected, since hidden-and-unselected would silently produce no data.
    this.aggregatorFilterHasSingleOption = !!(result && result.fOptions && result.fOptions.length === 1);
    if (this.aggregatorFilterHasSingleOption) {
      result = { ...result, fSelected: [result.fOptions[0].value] };
    }

    return result;
  }

  updateFilterDisplay() {
    console.log('vizsidebar:updateFilterDisplay');
  
    // Check if the getFilterGroupArray function exists
    if (typeof this.vizLayout.getFilterGroupArray === 'function') {
      var _filterGroupArray = this.vizLayout.getFilterGroupArray();
  
      if (_filterGroupArray) {
        this.filters.forEach(filterObject => {
          // Ensure _filterGroupArray is an array and filterObject.id is defined and a string
          const containsFilterText = Array.isArray(_filterGroupArray) &&
                                    typeof filterObject.id === 'string' &&
                                    _filterGroupArray.some(filterText => 
                                        typeof filterText === 'string' && filterObject.id.includes(filterText + '-filter')
                                    );
          if (containsFilterText) {
            if (!filterObject.isVisible()) {
              filterObject.show();
            }
          } else {
            if (filterObject.isVisible()) {
              filterObject.hide();
            }
          }
        });
      } else {
        // Hide all divs if _filterGroupArray is null or undefined
        this.filters.forEach(filterObject => {
          if (filterObject.isVisible()) {
            filterObject.hide();
          }
        });
      }
    }

    this.updateNoFiltersPlaceholder();
  }

  // Some attribute/filter combinations leave every filter card hidden (e.g. this attribute's
  // data key doesn't include any of the filters configured for this view) - without this, the
  // "— FILTERS —" column just goes blank with nothing explaining why. Appended to the outer
  // static div (not the inner "containerAttributeFilters" render() rebuilds from scratch each
  // time) so it isn't wiped out by the next render() before this runs again.
  updateNoFiltersPlaceholder() {
    if (!this.filters) return;
    const container = document.getElementById(this.getDiv('AttributeFilters'));
    if (!container) return;

    const anyVisible = this.filters.some(filterObject => filterObject.isVisible());
    let placeholder = container.querySelector('.no-filters-message');

    if (anyVisible) {
      if (placeholder) placeholder.remove();
      return;
    }

    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'no-filters-message';
      placeholder.textContent = 'No Filters';
      container.appendChild(placeholder);
    }
  }

  hideLayers() {
    this.layerDisplay.visible = false;
    
    if (this.legend) {
      mapView.ui.remove(this.legend);
    }
  }
  
  hideTrendSelector() {
    const trendSelector = document.getElementById("trendSelector");
    trendSelector.style.display = 'none';
  }

  showTrendSelector() {
    const trendSelector = document.getElementById("trendSelector");
    trendSelector.style.display = 'block';
  }

}
