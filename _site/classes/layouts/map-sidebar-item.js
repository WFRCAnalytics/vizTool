// Class for Sidebar Item
class MapSidebarItem {
  constructor(data, parent) {
      this.id = data.id || this.generateIdFromText(data.text); // use provided id or generate one if not provided
      this.text = data.text;
      this.type = data.type;
      this.options = data.options;
      this.selectedOption = data.selectedOption;
      this.content = data.content;
      this.parentEntity = parent;
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Render the item based on its type
  render() {
    const container = document.createElement('div');
    container.className = 'map-sidebar-item';
    container.id = this.id + "_container";
    
    let title = document.createElement("calcite-label");  // Create a new div element
    title.innerHTML = "<b>" + this.text + "</b>";  // Set its innerHTML
    container.appendChild(title);  // Append the new element to the container

    // Call a type-specific rendering method
    this.renderType(container);
        
    let space = document.createElement("calcite-label");  // Create a new div element
    space.innerHTML = "<br/>";  // Set its innerHTML
    container.appendChild(space);  // Append the new element to the container
    
    return container;
  }

  getSelectedOption() {
    return this.selectedOption;
  }

      // Render type-specific content
  renderType(container) {
    switch (this.type) {
      case "radio":
        this.createRadioButtons(container);
        break;
      case "checkbox":
        this.createCheckboxes(container);
        break;
      case "select":
        this.createSelect(container);
        break;
      // Add more cases for other types as needed
      case "html":

        function stringToHTML(htmlString) {
          var template = document.createElement('template');
          template.innerHTML = htmlString.trim(); // Remove potential leading/trailing whitespace
          return template.content.firstChild;
        }
        
        var node = stringToHTML(this.content);
        container.appendChild(node);
        break;
      default:
        console.warn(`Unsupported item type: ${this.type}`);
    }

    if (parent.submenuTemplate=="vizMap") {
      parent.updateMapCallback();
    }
  }

  createRadioButtons(container) {
    this.options.forEach((option, index) => {
      // Create radio buttons
      var radioButtonLabel = document.createElement("calcite-label");
      radioButtonLabel.setAttribute('layout', 'inline');
      radioButtonLabel.classList.add('pointer-cursor');

      var radioButton = document.createElement("calcite-radio-button");
      radioButton.name = this.id;
      radioButton.value = option[0];

      // Optionally, select the first radio button by default
      if (option[0] === this.selectedOption) {
        radioButton.checked = true;
      }

      // Listen for changes to the radio buttons
      radioButton.addEventListener("calciteRadioButtonChange", (e) => {
        // to make sure the radio button is the is the actual element
        const radioButton = e.currentTarget; // or e.target.closest('input[type="radioButton"]')
        const displayName = radioButton.value;
        // Update renderer with value of radio button
        console.log(this.id + ':' + displayName + ' radio button change');
        this.selectedOption = displayName;
        this.parentEntity.updateMap();
        this.parentEntity.updateChartData();
        this.parentEntity.updateFilters();
      });

      // Nest the radio button directly inside the calcite-label
      radioButtonLabel.appendChild(radioButton);
      radioButtonLabel.appendChild(document.createTextNode(option[1]));

      container.appendChild(radioButtonLabel);
    });
  }

  createCheckboxes(container) {
    this.options.forEach((option, index) => {

      // create checkboxes
      var checkboxLabel = document.createElement("calcite-label");
      checkboxLabel.setAttribute('layout', 'inline');
      checkboxLabel.classList.add('pointer-cursor');

      var checkbox = document.createElement("calcite-checkbox");

      checkbox.checked = option[1];

      // Listen for changes to the checkbox
      checkbox.addEventListener("calciteCheckboxChange", function (e) {
        // to make sure the checkbox is the is the actual element
        const checkbox = e.currentTarget; // or e.target.closest('input[type="checkbox"]')
        // update renderer with value of checkbox
        console.log(this.id + ':' + this.name + ' checkbox change')
      });    

      // Nest the checkbox directly inside the calcite-label
      checkboxLabel.appendChild(checkbox);
      checkboxLabel.appendChild(document.createTextNode(option[0] || option[0]));

      container.appendChild(checkboxLabel);

    });
  }

  createSelect(container){
    const select = document.createElement('calcite-select');
    select.id = this.id;
    this.options.forEach(option => {
      const optionEl = document.createElement('calcite-option');
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      
      if (option.value === this.selectedOption) {
        optionEl.setAttribute('selected', 'true'); // This will select the option
      }
      select.appendChild(optionEl);
    });
    select.addEventListener('calciteSelectChange', (e) => {
      this.selectedOption = e.target.selectedOption.value;
      this.parentEntity.afterUpdateSidebar();
    });
    container.appendChild(select);
    
  }


}
