class Filter {
  constructor(data, vizLayout) {
    this.id = vizLayout.id + '-' + data.id;
    this.vizLayout = vizLayout;

    if (data.type === "select") {
      this.filterWij = new WijSelect(this.id + '-filter', data.options.map(item => ({
        value: item.value,
        label: item.label
      })), data.selected, true, data.text, this.vizLayout, this);
    } else if (data.type === "radio") {
      this.filterWij = new WijRadio(this.id + '-filter', data.options.map(item => ({
        value: item.value,
        label: item.label
      })), data.selected, true, '', this.vizLayout, this);
    } else if (data.type === "checkboxes") {
      this.filterWij = new WijCheckboxes(this.id + '-filter', data.options.map(item => ({
        value: item.value,
        label: item.label
      })), data.selected, data.selected, true, data.text, this.vizLayout, this);
    } else if (data.type === "combobox") {
      this.filterWij = new WijCombobox(this.id + '-filter', data.options.map(item => ({
        value: item.value,
        label: item.label
      })), data.selected, data.selected, true, '', this.vizLayout, this);
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