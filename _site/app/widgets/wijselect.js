class WijSelect {
  constructor(parentid, title, selected, options, vizLayout, spaceafter=false, subTotals=[]) {
    this.id = parentid + '-wij';
    this.title = title;
    this.selected = selected;
    this.options = options;
    this.vizLayout = vizLayout;
    this.spaceafter = spaceafter;
    this.subTotals = subTotals
    this.containerId = this.id + "-container";
  }

  render() {
    console.log('wijselect:render:' + this.containerId)
    const container = document.createElement('div');
    container.id = this.containerId;
    
    let title = document.createElement("calcite-label");  // Create a new div element
    title.innerHTML = "<b>" + this.title + "</b>";  // Set its innerHTML
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


    // perhaps pass function that should be run as argument
    select.addEventListener('calciteSelectChange', (e) => {
      this.selected = e.target.selectedOption.value;

      if (this.id.includes('filter-subag-wij')) {
        const modifiedId = this.id.replace(/-subag-wij$/, '');
        let filter = this.vizLayout.sidebar.filters.find(o => o.id === modifiedId) 
                     || this.vizLayout.sidebar.aggregatorFilter;
    
        filter.afterUpdateSubAg();
    
      } else if (this.id.includes('_aggregator-selector')) {
        // Run only if aggregator
        activeLayout.sidebar.afterUpdateAggregator();
    
      } else {
        activeLayout.afterUpdateSidebar();
      }
    });
    
    container.appendChild(select);
    
        
    let space = document.createElement("calcite-label");  // Create a new div element
    container.appendChild(space);  // Append the new element to the container
    
    // Check if this.hidden is true and hide the container if it is
    if (this.hidden) {
      container.style.display = "none";
    }

    if (this.spaceafter) {
      const lineBreak = document.createElement('br');
      container.appendChild(lineBreak);
    }

    return container;
  }

  getSelectedOptionsAsList() {
    return [this.selected];
  }

  getSelectedOptionsNotSubTotalsAsList() {
    // Get option values that are not in the subTotals list
    return this.options.filter(option => !this.subTotals.includes(option.value))
                       .map(option => option.value);
  }
  
  getSelectedOptionsAsListOfLabels() {
    return this.options.filter(option => this.selected.includes(option.value)).map(option => option.label).join(', ');
  }

  hide() {
    document.getElementById(this.containerId).style.display = 'none';
  }

  show() {
    document.getElementById(this.containerId).style.display = 'block';
  }
  
}
