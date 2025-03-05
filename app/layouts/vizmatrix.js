class VizMatrix {
  constructor(data, modelEntity) {
    this.id = data.id || this.generateIdFromText(data.attributeTitle) + '-vizmatrix'; // use provided id or generate one if not provided
    console.log('vizmatrix:construct:' + this.id);
    
    // link to parent
    this.modelEntity = modelEntity;

    this.jsonName = data.jsonName;
    this.baseGeoJsonKey = data.baseGeoJsonKey;
    this.baseGeoJsonId = data.baseGeoJsonId;
    this.mode = 'main'; //default is main  other option is compare
    this.modeCompare = 'diff' //default is abs  other option is pct

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

  }

  updateScenarioSelector() {
    
  }

  afterUpdateSidebar() {
    console.log('vizmatrix:afterUpdateSidebar');
    this.updateDisplay();
  }

  afterUpdateAggregator() {
    console.log('vizmatrix:afterUpdateAggregator');
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
      return _scenario.getMatrixDataForFilteredOptionListWithAggregator(this.jsonName, this.sidebar.getListOfSelectedFilterOptions(), this.aCode, this.getSelectedAggregator(), this.baseGeoJsonKey, this.dCode, this.sidebar.getSelectedDivider(), this.sidebar.getAgFilterOptionsMethod());
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
      return _scenario.getMatrixDataForFilteredOptionListWithAggregator(this.jsonName, this.sidebar.getListOfSelectedFilterOptions(), this.aCode, this.getSelectedAggregator(), this.baseGeoJsonKey, this.dCode, his.sidebar.getSelectedDivider(), this.sidebar.getAgFilterOptionsMethod());
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

  // get the divider code that is selected
  get dCode() {
    return this.sidebar.getDCode();
  }

  getSelectedAggregator()  {
    return this.sidebar.getSelectedAggregator();
  }

  getFilterGroup() {
    const _scenario = this.getScenarioMain();
    if (_scenario) {
      let _baseFilterGroup = _scenario.getFilterGroupForAttribute(this.jsonName, this.aCode);
      let _selectedAttribute = this.sidebar.attributes.find(attribute =>
        attribute.attributeCode == this.aCode
      ) || null;
      if (_selectedAttribute) {
        if (_selectedAttribute.filterOverride) {
          console.log('There is a filter override');
          // Loop through the filterOverride and replace filterIn with filterOut in the string
          _selectedAttribute.filterOverride.forEach(item => {
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

  updateDisplay() {

    // loop through all IDs and get data for each
    var _dataMain = this.getDataMain();

    this.generateTableFromAggregatedData(_dataMain);



  }
 
  generateTableFromAggregatedData(data) {
    if (!data || Object.keys(data).length === 0) {
      console.error("No data available to display.");
      return;
    }
  
    // Extract unique origins and destinations
    let origins = Object.keys(data);
    let destinations = new Set();
  
    // Collect all unique destination keys
    origins.forEach(origin => {
      Object.keys(data[origin]).forEach(dest => destinations.add(dest));
    });
  
    destinations = Array.from(destinations).sort((a, b) => a - b); // Sort numerically
  
    // Create HTML table
    let tableHTML = "<table border='1' style='border-collapse: collapse; text-align: right;'>";
    tableHTML += "<tr><th>Origin \\ Destination</th>";
  
    // Add column headers
    destinations.forEach(dest => {
      tableHTML += `<th>${dest}</th>`;
    });
    tableHTML += "</tr>";
  
    // Fill in table rows
    origins.forEach(origin => {
      tableHTML += `<tr><td><strong>${origin}</strong></td>`; // Origin row header
  
      destinations.forEach(dest => {
        let value = data[origin][dest] !== undefined ? data[origin][dest].toFixed(2) : "-"; // Format numbers
        tableHTML += `<td>${value}</td>`;
      });
  
      tableHTML += "</tr>";
    });
  
    tableHTML += "</table>";
  
    // Insert table into the webpage
    document.getElementById('matrixView').innerHTML = tableHTML;
  }
  


  
}
