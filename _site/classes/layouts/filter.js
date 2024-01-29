class Filter {
  constructor(data, vizLayout) {
    this.id = vizLayout.id + '-' + data.fCode;
    console.log('filter-construct:' + this.id);

    this.vizLayout = vizLayout;
    
    const _id = this.id + '-filter'
    const _name = (data.fWidget === 'select' || data.fWidget === 'checkboxes') ? data.fName : ''; // select and checkboxes will have blank title
    const _options = data.fOptions.map(item => ({ value: item.value, label: item.label }));
    const _selected = data.fSelected;

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
    return this.filterWij.render();
  }

  getSelectedOptionsAsList() {
    return this.filterWij.getSelectedOptionsAsList();
  }

  isHidden() {
    return document.getElementById(this.filterWij.containerId).style.display === 'none';
  }

  hide() {
    console.log('hide: ' + this.filterWij.id);
    document.getElementById(this.filterWij.containerId).style.display = 'none';
  }

  show() {
    console.log('show: ' + this.filterWij.id);
    document.getElementById(this.filterWij.containerId).style.display = 'block';
  }

}