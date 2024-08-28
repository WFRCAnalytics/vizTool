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
        if (!configAt || !configAt.aDisplayName) {
          console.error(`Error: Missing configuration or title text for attribute code: ${agCode}`);
          return { value: attributeCode, label: 'Unknown' }; // Provide a default value in case of error
        }
        return { value: attributeCode, label: configAt.aDisplayName };
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
                                            [_nothing, ...this.dividers.map(item => ({ value: item.attributeCode, label: item.aDisplayName }))],
                                            this);
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
          parentDiv.appendChild(containerDiv);
          return containerDiv;
      }
    }

    // Define the elements to process
    const elements = [
      { name: "Attributes"       , render: () => this.attributeSelect ? this.attributeSelect.render() : null   },
      { name: "AttributeFilters" , render: () => this.filters.map(filter => filter.render())                   },
      { name: "Aggregator"       , render: () => this.aggregatorSelect ? this.aggregatorSelect.render() : null },
      { name: "AggregatorFilters", render: () => this.aggregatorFilter ? this.aggregatorFilter.render() : null },
      { name: "Dividers"         , render: () => this.dividerSelect ? this.dividerSelect.render() : null       },
      { name: "DividerFilters"                                                                                 }
    ];

    // Process each element
    elements.forEach(element => {
      const divId = this.getDiv(element.name);
      const container = createAndAppendContainer(divId, `container${element.name}`);
      var divElement = document.getElementById(divId);
      if (divElement) {
        if ((element.name==="Aggregator" || element.name==="AggregatorFilters") && (!this.aggregatorSelect)) {
          divElement.style.display='none';
        } else {
          divElement.style.display='block';
        }
      }

      if (container && element.render) {
          const content = element.render();
          if (Array.isArray(content)) {
              content.forEach(child => container.appendChild(child));
          } else if (content) {
              container.appendChild(content);
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

  getSelectedOptionsAsLongText() {
    return this.filters.filter(filter => filter.isVisible()).map(filter => '<b>' + filter.filterWij.title + ':</b> ' + filter.getSelectedOptionsAsListOfLabels()).join('; ');
  }
  

  // get the attribute code that is selected
  getACode() {
    return this.attributeSelect.selected;
  }

  // get the divider code that is selected
  getDCode() {
    return this.dividerSelect.selected;
  }

  getADisplayName() {
    const attributeCode = this.getACode();
    const item = this.attributes.find(item => item.attributeCode === attributeCode);
  
    if (item && item.aDisplayName) {
      return item.aDisplayName;
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

  //// get the current filter
  //getFilter() {
  //  
  //  var _filterGroup = [];
  //
  //  _filterGroup = this.vizLayout.getFilterGroup();
  //
  //  // Check if _filterGroup is not undefined
  //  if (_filterGroup) {
  //    // Split the _filterGroup by "_"
  //    const _filterArray = _filterGroup.split("_");
  //    
  //    // Map selected options to an array and join with "_"
  //    const _filter = _filterArray
  //      .map(filterItem => {
  //        var _fItem = this.filters.find(item => item.id === filterItem + '_' + this.id);
  //        return _fItem ? _fItem.filterWij.selected : "";
  //      })
  //      .join("_");
  //
  //    return _filter;
  //  }
  //
  //  return ""; // Return an empty string or a default value if _filterGroup is undefined
  //
  //}


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
    this.updateAggregations();
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
  
  updateAggregations() {
    console.log('vizsidebar:updateAggregations');
    
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

  hideLayers() {
    this.layerDisplay.visible = false;
    
    if (this.legend) {
      mapView.ui.remove(this.legend);
    }
  }
  

}
