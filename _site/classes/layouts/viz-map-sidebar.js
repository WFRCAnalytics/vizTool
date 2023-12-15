class VizMapSidebar {
  constructor(attributeTitle, attributes, attributeSelected, hidden, filters, aggregators, aggregatorSelected, aggregatorTitle, vizMap) {
    this.id = this.generateIdFromText(attributeTitle) + "-viz-map-sidebar"; // use provided id or generate one if not provided
    this.dataArrayCode = 
    this.attributeTitle = attributeTitle;
    this.attributeSelect = new WijRadio(this.id & "_attribute-selector", attributes.map(item => ({
      value: item.aCode,
      label: item.aDisplayName
    })), attributeSelected, hidden, attributeTitle, this);
    this.filters = (filters || []).map(item => new Filter(item, this));
    this.aggregators = (aggregators || []).map(item => new Aggregator(item));
    // Check if aggregator exists before initializing aggregatorSelect
    if (aggregators) {
      this.aggregatorSelect = new WijSelect(this.id + "_aggregator-selector", aggregators.map(item => ({
        value: item.agCode,
        label: item.agDisplayName
      })), aggregatorSelected, false, aggregatorTitle, this);
    }
    this.vizMap = vizMap;
  }

  hideLayout() {
    console.log('hideLayout');

  }
  
  generateIdFromText(text) {
    console.log('generateIdFromText');
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
    return this.findAllCombinationsOfLists(this.filters.map(filter => filter.getSelectedOptionsAsList()));
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

  // get the current filter
  getFilter() {
    
    var _filterGroup = [];
  
    _filterGroup = this.vizMap.getFilterGroup();
  
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

  render() {

    // render aggregators, attributes and filters
    const containerAttributes = document.createElement('div');
    const containerAttributeFilters = document.createElement('div');
    
    if (this.aggregatorSelect) {
      containerAttributes.appendChild(this.aggregatorSelect.render());
    }
    containerAttributes.appendChild(this.attributeSelect.render());

    this.filters.forEach(filter => {
      containerAttributeFilters.appendChild(filter.render());
    });

    var divAttributes = document.getElementById("vizMapAttributes");
    divAttributes.innerHTML = '';
    divAttributes.appendChild(containerAttributes);  // Append the new element to the container

    var divAttributeFilters = document.getElementById("vizMapAttributeFilters");
    divAttributeFilters.innerHTML = '';
    divAttributeFilters.appendChild(containerAttributeFilters);  // Append the new element to the container

    // render dividers

    const containerDividers = document.createElement('div');
    const containerDividerFilters = document.createElement('div');

    var divAttributes = document.getElementById("vizMapDividers");
    divAttributes.innerHTML = '';
    divAttributes.appendChild(containerDividers);  // Append the new element to the container

    var divAttributeFilters = document.getElementById("vizMapDividerFilters");
    divAttributeFilters.innerHTML = '';
    divAttributeFilters.appendChild(containerDividerFilters);  // Append the new element to the container

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
    this.vizMap.afterUpdateSidebar();
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
    this.vizMap.afterUpdateSidebar();
  }

  updateFilters() {
    console.log('updateFilters');
    
    var _filterGroup = [];
  
    _filterGroup = this.vizMap.getFilterGroup();
  
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

  hideLayers() {
    this.layerDisplay.visible = false;
    
    if (this.legend) {
      mapView.ui.remove(this.legend);
    }
  }
  

}
