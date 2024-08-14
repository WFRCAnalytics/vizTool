class Filter {
  constructor(fCode, vizLayout, filterData = null) {

    let _configFilter;

    if (filterData) {
      this.fCode = filterData.fCode;
      _configFilter = filterData;

    } else {
      this.fCode = fCode;
      _configFilter = configFilters[this.fCode];
    }

    console.log('filter:' + this.fCode);

    if (_configFilter === undefined) {
      return; // Exit the constructor if _configFilter is undefined
    }

    this.id = vizLayout.id + '-' + this.fCode + '-filter';
    console.log('filter-construct:' + this.id);

    this.vizLayout = vizLayout;

    this.name = (_configFilter.fWidget === 'select' || _configFilter.fWidget === 'checkboxes') ? _configFilter.fName : ''; // select and checkboxes will have blank title
    
    this.options = [];

    if (_configFilter.fOptions) {
      this.options = _configFilter.fOptions.map(item => ({ value: item.value, label: item.label }));
      this.initializeFilter(_configFilter);
    } else if (_configFilter.fOptionsJson) {
      this.loadAndProcessOptions(_configFilter).then(() => {
        this.initializeFilter(_configFilter);
      });
    } else {
      this.initializeFilter(_configFilter);
    }
  }

  async loadAndProcessOptions(_configFilter) {
    // load json data
    const _value = _configFilter.fOptionValue;
    const _label = _configFilter.fOptionName;
    let _options = [];

    for (let scenario of dataScenarios) {
      // open json file
      let jsonFilename = 'scenario-data/' + scenario.scnFolder + '/' + _configFilter.fOptionsJson;

      // get list of options using _value and _label fields
      try {
        let jsonData = await this.loadJsonFile(jsonFilename);

        _options = _options.concat(
          jsonData.map(feature => ({
            value: feature[_value], // Assuming these are under `properties`
            label: feature[_label]  // Adjust if they are located elsewhere
          }))
        );
      } catch (error) {
        console.error(`Error loading JSON file ${jsonFilename}:`, error);
      }
    }

    // Remove duplicates
    let uniqueOptions = [];
    let seen = new Set();
    for (let option of _options) {
      if (!seen.has(option.value)) {
        seen.add(option.value);
        uniqueOptions.push(option);
      }
    }

    // Sort by label
    uniqueOptions.sort((a, b) => a.label.localeCompare(b.label));
    this.options = uniqueOptions;
  }

  async loadJsonFile(filename) {
    const response = await fetch(filename);
    if (!response.ok) {
      throw new Error(`Failed to load JSON file: ${filename}`);
    }
    return await response.json();
  }

  initializeFilter(_configFilter) {

    // Check if 'selected' is undefined, then create a list of 'value' from 'options'
    const _selected = _configFilter.fSelected !== undefined ? _configFilter.fSelected : this.options.map(option => option.value);

    this.userModifiable = _configFilter.userModifiable === undefined ? true : _configFilter.userModifiable; // set to true if undefined

    if (_configFilter.subAgDisplayName) {
      this.filterSubAgWij = new WijSelect(this.id + '-subag', _configFilter.subAgDisplayName, _configFilter.subAgSelected, _configFilter.subAgOptions, this.vizLayout, true);
      this.options = _configFilter.fOptions.map(item => ({ value: item.value, label: item.label, subag: item.subag}));
    }
  
    if (_configFilter.fWidget === 'select') {
      this.filterWij = new WijSelect(this.id, this.name, _selected, this.options, this.vizLayout, true);
    } else if (_configFilter.fWidget === 'radio') {
      this.filterWij = new WijRadio(this.id, this.name, _selected, this.options, this.vizLayout, true);
    } else if (_configFilter.fWidget === 'checkboxes') {
      this.filterWij = new WijCheckboxes(this.id, this.name, _selected, this.options, this.vizLayout, true);
    } else if (_configFilter.fWidget === 'combobox') {
      this.filterWij = new WijCombobox(this.id, this.name, _selected, this.options, this.vizLayout, true);
    }
  }


  render() {

    const filterContainer = document.createElement('div');
    filterContainer.id = this.containerId;

    // only render if the user can modify widget... otherwise needed settings are all preserved in object
    if (this.userModifiable) {
      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        filterContainer.appendChild(this.filterSubAgWij.render());
      }
      
      filterContainer.appendChild(this.filterWij.render());
    }
    return filterContainer;
  }

  afterUpdateSubAg() {
    this.filterWij.applySubAg(this.filterSubAgWij.selected);
  }

  getSelectedOptionsAsList() {
    return this.filterWij.getSelectedOptionsAsList();
  }

  getSelectedOptionsAsListOfLabels() {
    return this.filterWij.getSelectedOptionsAsListOfLabels();
  }

  isVisible() {
    if (this.userModifiable) {
      //Debug
      //console.log('debug filter isVisible containerId: ' + this.filterWij.containerId)
      const element = document.getElementById(this.filterWij.containerId);

      // Error checking: Ensure the element exists and has a valid style property
      if (!element) {
        console.error(`Element with ID ${this.filterWij.containerId} not found.`);
        return false; // Return false or handle the case appropriately
      }
      
      if (!element.style) {
        console.error(`Element with ID ${this.filterWij.containerId} does not have a style property.`);
        return false; // Return false or handle the case appropriately
      }
      
      return element.style.display !== 'none';
    } else {  // if not userModifiable, we need to act like it is being displayed anyway
      return true;
    }
  }

  hide() {
    if (this.userModifiable) {
      console.log('hide: ' + this.filterWij.id);
      document.getElementById(this.filterWij.containerId).style.display = 'none';
  
      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        document.getElementById(this.filterSubAgWij.containerId).style.display = 'none';
      }
    }
  }

  show() {
    if (this.userModifiable) {
      console.log('show: ' + this.filterWij.id);
      document.getElementById(this.filterWij.containerId).style.display = 'block';
      
      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        document.getElementById(this.filterSubAgWij.containerId).style.display = 'block';
      }
    }
  }

}