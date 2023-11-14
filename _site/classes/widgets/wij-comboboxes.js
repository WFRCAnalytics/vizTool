class WijComboboxes {
  constructor(id, options, selected, hidden, text, vizLayout, parent) {
    this.id = id;
    this.options = options;
    this.selected = selected;
    this.hidden = hidden !== undefined ? hidden : false;
    this.text = text;
    this.vizLayout = vizLayout;
    this.parentEntity = parent;
  }

  // Render the item based on its type
  render() {
    const container = document.createElement('div');
    container.id = this.id + "_container";

    const wijComboInstance = this;
    
    //let title = document.createElement("calcite-label");  // Create a new div element
    //title.innerHTML = "<b>" + this.text + "</b>";  // Set its innerHTML
    //container.appendChild(title);  // Append the new element to the container

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
      if (option.value === this.selected) {
        comboBoxButton.checked = true;
      }

      // Listen for changes to the radio buttons
      comboBoxButton.addEventListener("calciteComboboxChange", (e) => {
        // to make sure the radio button is the is the actual element
        const comboBoxButton = e.currentTarget; // or e.target.closest('input[type="comboBoxButton"]')
        const cbValue = comboBoxButton.value;
        // Update renderer with value of radio button
        console.log(this.id + ':' + cbValue + ' combobox change');
        this.selected = cbValue;
        wijComboInstance.vizLayout.afterUpdateSidebar();
      });

      // Nest the radio button directly inside the calcite-label
      comboBoxLabel.appendChild(comboBoxButton);

      container.appendChild(comboBoxLabel);
    });

    // Check if this.hidden is true and hide the container if it is
    if (this.hidden) {
      container.style.display = "none";
    }

    const lineBreak = document.createElement('br');
    container.appendChild(lineBreak);

    return container;
  }
}