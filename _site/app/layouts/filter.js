class Filter {
  constructor(data, vizLayout) {
    this.id = vizLayout.id + '-' + data.fCode + '-filter';
    console.log('filter-construct:' + this.id);

    this.vizLayout = vizLayout;

    const _name = (data.fWidget === 'select' || data.fWidget === 'checkboxes') ? data.fName : ''; // select and checkboxes will have blank title
    
    this._options = [];

    if (data.fOptions) {
      this._options = data.fOptions.map(item => ({ value: item.value, label: item.label }));
      this.initializeFilter(data, _name);
    } else if (data.fOptionsJson) {
      this.loadAndProcessOptions(data).then(() => {
        this.initializeFilter(data, _name);
      });
    } else {
      this.initializeFilter(data, _name);
    }
  }

  async loadAndProcessOptions(data) {
    // load json data
    const _value = data.fOptionValue;
    const _label = data.fOptionName;
    let _options = [];

    for (let scenario of dataScenarios) {
      // open json file
      let jsonFilename = 'scenario-data/' + scenario.scnFolder + '/' + data.fOptionsJson;

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
    this._options = uniqueOptions;
  }

  async loadJsonFile(filename) {
    const response = await fetch(filename);
    if (!response.ok) {
      throw new Error(`Failed to load JSON file: ${filename}`);
    }
    return await response.json();
  }

  initializeFilter(data, _name) {

    // Check if 'selected' is undefined, then create a list of 'value' from 'options'
    const _selected = data.fSelected !== undefined ? data.fSelected : this._options.map(option => option.value);

    this.modifiable = data.fUserModifiable === undefined ? true : data.fUserModifiable; // set to true if undefined

    if (data.subAgDisplayName) {
      this.filterSubAgWij = new WijSelect(this.id + '-subag', data.subAgDisplayName, data.subAgSelected, data.subAgOptions, this.vizLayout, true);
      this._options = data.fOptions.map(item => ({ value: item.value, label: item.label, subag: item.subag}));
    }
  
    if (data.fWidget === 'select') {
      this.filterWij = new WijSelect(this.id, _name, _selected, this._options, this.vizLayout, true);
    } else if (data.fWidget === 'radio') {
      this.filterWij = new WijRadio(this.id, _name, _selected, this._options, this.vizLayout, true);
    } else if (data.fWidget === 'checkboxes') {
      this.filterWij = new WijCheckboxes(this.id, _name, _selected, this._options, this.vizLayout, true);
    } else if (data.fWidget === 'combobox') {
      this.filterWij = new WijCombobox(this.id, _name, _selected, this._options, this.vizLayout, true);
    }
  }


  render() {

    const filterContainer = document.createElement('div');
    filterContainer.id = this.containerId;

    // only render if the user can modify widget... otherwise needed settings are all preserved in object
    if (this.modifiable) {
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
    if (this.modifiable) {
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
    }
  }

  hide() {
    if (this.modifiable) {
      console.log('hide: ' + this.filterWij.id);
      document.getElementById(this.filterWij.containerId).style.display = 'none';
  
      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        document.getElementById(this.filterSubAgWij.containerId).style.display = 'none';
      }
    }
  }

  show() {
    if (this.modifiable) {
      console.log('show: ' + this.filterWij.id);
      document.getElementById(this.filterWij.containerId).style.display = 'block';
      
      // append sub aggregation widget if exists
      if (typeof this.filterSubAgWij!='undefined') {
        document.getElementById(this.filterSubAgWij.containerId).style.display = 'block';
      }
    }
  }

}