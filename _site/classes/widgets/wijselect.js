class WijSelect {
  constructor(id, options, selected, hidden, text, vizLayout, parent) {
    this.id = id;
    this.containerId = this.id + "-container"
    this.options = options;
    this.selected = selected;
    this.hidden = hidden !== undefined ? hidden : false;
    this.text = text;
    this.vizLayout = vizLayout;
    this.parentEntity = parent;
  }

  // Render the item based on its type
  render() {
    console.log('wijselect:render:' + this.containerId)
    const container = document.createElement('div');
    container.id = this.containerId;
    
    let title = document.createElement("calcite-label");  // Create a new div element
    title.innerHTML = "<b>" + this.text + "</b>";  // Set its innerHTML
    container.appendChild(title);  // Append the new element to the container

    // Call a type-specific rendering method
    const select = document.createElement('calcite-select');
    select.id = this.id;
    this.options.forEach(option => {
      const optionEl = document.createElement('calcite-option');
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      
      if (option.value === this.selected) {
        optionEl.setAttribute('selected', 'true'); // This will select the option
      }
      select.appendChild(optionEl);
    });
    select.addEventListener('calciteSelectChange', (e) => {
      this.selected = e.target.selectedOption.value;
      if (this.id.includes('_aggregator-selector')) { // run only if aggregator
        this.vizLayout.afterUpdateAggregator();
      } else {
        this.vizLayout.afterUpdateSidebar();
      }
    });
    container.appendChild(select);
    
        
    let space = document.createElement("calcite-label");  // Create a new div element
    space.innerHTML = "<br/>";  // Set its innerHTML
    container.appendChild(space);  // Append the new element to the container
    
    // Check if this.hidden is true and hide the container if it is
    if (this.hidden) {
      container.style.display = "none";
    }

    return container;
  }

  getSelectedOptionsAsList() {
    return [this.selected];
  }
  
}
