class Filter {
  constructor(data, vizLayout) {
    this.id = vizLayout.id + '-' + data.fCode;
    console.log('filter-construct:' + this.id);

    this.vizLayout = vizLayout;
    
    const _id = this.id + '-filter'
    const _name = (data.fWidget === 'select' || data.fWidget === 'checkboxes') ? data.fName : ''; // select and checkboxes will have blank title
    var _options = data.fOptions.map(item => ({ value: item.value, label: item.label }));
    const _selected = data.fSelected;
    
    this.modifiable = data.fUserModifiable === undefined ? true : data.fUserModifiable; // set to true if undefined

    if (data.subAgDisplayName) {
      this.filterSubAgWij = new WijSelect(_id + '-subag', data.subAgDisplayName, data.subAgSelected, data.subAgOptions, vizLayout, true);
      _options = data.fOptions.map(item => ({ value: item.value, label: item.label, subag: item.subag}));
    }
  
    if (data.fWidget === 'select') {
      this.filterWij = new WijSelect(_id, _name, _selected, _options, vizLayout, true);
    } else if (data.fWidget === 'radio') {
      this.filterWij = new WijRadio(_id, _name, _selected, _options, vizLayout, true);
    } else if (data.fWidget === 'checkboxes') {
      this.filterWij = new WijCheckboxes(_id, _name, _selected, _options, vizLayout, true);
    } else if (data.fWidget === 'combobox') {
      this.filterWij = new WijCombobox(_id, _name, _selected, _options, vizLayout, true);
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

  isVisible() {
    if (this.modifiable) {
      //Debug
      //console.log('debug filter isVisible containerId: ' + this.filterWij.containerId)
      return document.getElementById(this.filterWij.containerId).style.display === 'none';
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