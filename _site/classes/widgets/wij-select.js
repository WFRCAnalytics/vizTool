class WijSelect {
  constructor(data, parent) {
    this.id = id;
    this.options = options;
    this.selected = selected;
  }

  // Render the item based on its type
  render() {
    const container = document.createElement('div');
    container.id = this.id + "_container";
    
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
      
      if (option.value === this.selectedOption) {
        optionEl.setAttribute('selected', 'true'); // This will select the option
      }
      select.appendChild(optionEl);
    });
    select.addEventListener('calciteSelectChange', (e) => {
      this.selectedOption = e.target.selectedOption.value;
      this.parentEntity.afterSidebarUpdate();
    });
    container.appendChild(select);
    
        
    let space = document.createElement("calcite-label");  // Create a new div element
    space.innerHTML = "<br/>";  // Set its innerHTML
    container.appendChild(space);  // Append the new element to the container
    
    return container;
  }
}
