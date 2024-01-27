class WijCombobox {
  constructor(id, title, selected, options, vizLayout, spaceafter=false) {
    this.id = id;
    this.title = title;
    this.selected = selected;
    this.options = options;
    this.vizLayout = vizLayout;
    this.spaceafter = spaceafter;

    this.containerId = this.id + "-container";
  }

  render() {
    console.log('wijcombobox:render:' + this.containerId)
    const container = document.createElement('div');
    container.id = this.containerId;
    const wijComboInstance = this;

    const aggCode = this.vizLayout.getSelectedAggregator();

    if (aggCode) {// if aggregator
      this.selected = aggCode;
    
      let title = document.createElement("calcite-label");  // Create a new div element
      title.innerHTML = "<b> Select " + aggCode.agDisplayName + "(s)</b>";  // Set its innerHTML
      container.appendChild(title);  // Append the new element to the container
  
      // Create radio buttons
      var comboBoxLabel = document.createElement("calcite-combobox");
      comboBoxLabel.setAttribute('layout', 'inline');
      comboBoxLabel.classList.add('pointer-cursor');
  
      // Call a type-specific rendering method
      aggCode.agOptions.forEach((option) => {
  
        var comboBoxButton = document.createElement("calcite-combobox-item");
        comboBoxButton.textLabel = option;
        comboBoxButton.value = option;
  
        // Optionally, select the first radio button by default
        if (option.value === this.comboSelected) {
          comboBoxButton.checked = true;
        }
  
        // Nest the radio button directly inside the calcite-label
        comboBoxLabel.appendChild(comboBoxButton);
  
        container.appendChild(comboBoxLabel);
      });
    } else { // if not agregator
      let title = document.createElement("calcite-label");  // Create a new div element
      title.innerHTML = "<b>" + this.title + "</b>";  // Set its innerHTML
      container.appendChild(title);  // Append the new element to the container
  
      // Create radio buttons
      var comboBoxLabel = document.createElement("calcite-combobox");
      comboBoxLabel.setAttribute('layout', 'inline');
      comboBoxLabel.classList.add('pointer-cursor');
  
      // Call a type-specific rendering method
      this.options.forEach((option) => {
  
        var comboBoxButton = document.createElement("calcite-combobox-item");
        comboBoxButton.textLabel = option.label;
        comboBoxButton.value = option.value;
  
        // Optionally, select the first radio button by default
        if (this.comboSelected.includes(option.value)) {
          comboBoxButton.selected = true;
        }
  
        // Nest the radio button directly inside the calcite-label
        comboBoxLabel.appendChild(comboBoxButton);
  
        container.appendChild(comboBoxLabel);
      });
    }
    
    // Listen for changes to the radio buttons
    comboBoxLabel.addEventListener("calciteComboboxChange", (e) => {
      // to make sure the radio button is the is the actual element
      const comboBoxButton = e.currentTarget; // or e.target.closest('input[type="comboBoxButton"]')
      const cbValue = comboBoxButton.value;
      const cbValueList = Array.isArray(cbValue) ? cbValue : [cbValue];

      // Update renderer with value of radio button
      console.log(this.id + ':' + cbValue + ' combobox change');
      this.comboSelected = cbValueList;
      wijComboInstance.vizLayout.afterUpdateSidebar();
    });

    // Check if this.hidden is true and hide the container if it is
    if (this.hidden) {
      container.style.display = "none";
    }
    
    if (this.spaceafter) {
      const lineBreak = document.createElement('br');
      container.appendChild(lineBreak); // Append a line break after the checkbox container
    }

    return container;
  }

  getSelectedOptionsAsList() {
    return this.comboSelected;
  }

}