class Filter {
  constructor(data, vizLayout) {
    this.id = data.id;
    this.vizLayout = vizLayout;

    if (data.type === "select") {
      this.filterSelect = new WijSelect(this.id + "_filter", data.options.map(item => ({
        value: item.value,
        label: item.label
      })), data.selected, this.vizLayout);
    } else if (data.type === "radio") {
      this.filterSelect = new WijRadio(this.id + "_filter", data.options.map(item => ({
        value: item.value,
        label: item.label
      })), data.selected, this.vizLayout);
    } else if (data.type === "checkbox") {
        // Handle checkbox case if needed
    }
    
  }

  render() {
    return this.filterSelect.render();
  }

}