class VizSidebar {
  constructor(attributes, attributeSelected, attributeTitle, attributeInfoTextHtml, filters, aggregators, aggregatorSelected, aggregatorTitle, dividers, dividerSelected, dividerTitle, vizLayout) {
    this.id = this.generateIdFromText(attributeTitle) + "-sidebar"; // use provided id or generate one if not provided

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

      this.attributeSelect   = new WijRadio(this.id + "-attribute-selector",
                                            attributeTitle,
                                            attributeSelected,
                                            attributeOptions,
                                            this,
                                            attributeInfoTextHtml);
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

      this.aggregatorSelect = new WijSelect(this.id + "_aggregator-selector",
                                            aggregatorTitle,
                                            aggregatorSelected,
                                            aggregatorOptions,
                                            this);
      if (vizLayout.modelEntity.template==='vizTrends') {
        this.aggregatorFilter = new Filter (null, this.vizLayout, (this.aggregators.find(item => item.agCode === aggregatorSelected) || []).filterData);
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
      { name: "Attributes", render: () => this.attributeSelect ? this.attributeSelect.render() : null },
      { name: "AttributeFilters", render: () => this.filters.map(filter => filter.render()) },
      { name: "Aggregator", render: () => this.aggregatorSelect ? this.aggregatorSelect.render() : null },
      { name: "AggregatorFilters", render: () => this.aggregatorFilter ? this.aggregatorFilter.render() : null },
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
            divElement.style.display = 'none';
          }
        }
      }
    });
  
    this.updateFilterDisplay();
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

  getSelectedOptionsAsLongText() {
    return this.filters.filter(filter => filter.isVisible()).map(filter => '<b>' + filter.filterWij.title + ':</b> ' + filter.getSelectedOptionsAsListOfLabels()).join('; ');
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

  // Function to be called when checkbox status changes
  toggleLabels() {
    var labelCheckbox = document.getElementById('vizsidebar:toggleLabels');
    
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
    this.updateFilterDisplay();
    this.vizLayout.afterUpdateSidebar();
  }

  afterUpdateAggregator() {
    if (this.vizLayout.modelEntity.template==='vizTrends') {
      this.aggregatorFilter = new Filter (null, this.vizLayout, (this.aggregators.find(item => item.agCode === this.aggregatorSelect.selected) || []).filterData);
    }
    this.vizLayout.afterUpdateAggregator();
  }

  updateFilterDisplay() {
    console.log('vizsidebar:updateFilterDisplay');
  
    // Check if the getFilterGroupArray function exists
    if (typeof this.vizLayout.getFilterGroupArray === 'function') {
      var _filterGroupArray = this.vizLayout.getFilterGroupArray();
  
      if (_filterGroupArray) {
        this.filters.forEach(filterObject => {
          const containsFilterText = _filterGroupArray.some(filterText => filterObject.id.includes(filterText + '-filter'));
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
  }

  hideLayers() {
    this.layerDisplay.visible = false;
    
    if (this.legend) {
      mapView.ui.remove(this.legend);
    }
  }
  

}
