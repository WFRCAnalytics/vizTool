class WijRadio {
  constructor(id, options, selected, vizLayout, parent) {
    this.id = id;
    this.options = options;
    this.selected = selected;
    this.vizLayout = vizLayout;
    this.parentEntity = parent;
  }

  // Render the item based on its type
  render() {
    const container = document.createElement('div');
    container.id = this.id + "_container";

    // Call a type-specific rendering method
    this.options.forEach((option) => {
      // Create radio buttons
      var radioButtonLabel = document.createElement("calcite-label");
      radioButtonLabel.setAttribute('layout', 'inline');
      radioButtonLabel.classList.add('pointer-cursor');

      var radioButton = document.createElement("calcite-radio-button");
      radioButton.name = this.id;
      radioButton.value = option.value;

      // Optionally, select the first radio button by default
      if (option.value === this.selected) {
        radioButton.checked = true;
      }

      // Listen for changes to the radio buttons
      radioButton.addEventListener("calciteRadioButtonChange", (e) => {
        // to make sure the radio button is the is the actual element
        const radioButton = e.currentTarget; // or e.target.closest('input[type="radioButton"]')
        const rbValue = radioButton.value;
        // Update renderer with value of radio button
        console.log(this.id + ':' + rbValue + ' radio button change');
        this.selected = rbValue;
        this.vizLayout.updateChartData();
        //this.vizLayout.afterFilterUpdate();
      });

      // Nest the radio button directly inside the calcite-label
      radioButtonLabel.appendChild(radioButton);
      radioButtonLabel.appendChild(document.createTextNode(option.label));

      container.appendChild(radioButtonLabel);
    });

    var space = document.createElement("calcite-label");  // Create a new div element
    space.innerHTML = "<br/>";  // Set its innerHTML
    container.appendChild(space);  // Append the new element to the container
    
    return container;
  }
}