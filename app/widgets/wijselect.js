class WijSelect {
  constructor(parentid, title, selected, options, vizLayout, spaceafter=false, subTotals=[], collapsible=false, showTitle=true) {
    this.id = parentid + '-wij';
    this.title = title;
    this.selected = selected;
    this.options = options;
    this.vizLayout = vizLayout;
    this.spaceafter = spaceafter;
    this.subTotals = subTotals
    this.collapsible = collapsible;
    this.showTitle = showTitle; // false for a subAg picker nested inside its paired filter's
                                 // own card (right under that filter's title) - no separate
                                 // label needed there, just the bare dropdown
    this.containerId = this.id + "-container";
  }

  render() {
    console.log('wijselect:render:' + this.containerId)
    const container = document.createElement('div');
    container.id = this.containerId;
    const wijSelectInstance = this;

    let title = document.createElement("calcite-label");  // Create a new div element
    title.innerHTML = "<b>" + this.title + "</b>";  // Set its innerHTML

    const selectBody = document.createElement('div');

    let filterSummary = null;
    if (this.collapsible) {
      // Same collapse+summary pattern as WijCheckboxes/WijRadio: clicking the
      // chevron+title toggles selectBody, collapsed state shows the current selection.
      const toggleRow = document.createElement('div');
      toggleRow.className = 'filter-toggle-row';

      const chevron = document.createElement('calcite-icon');
      chevron.icon = 'chevron-down';
      chevron.scale = 's';

      toggleRow.appendChild(chevron);
      toggleRow.appendChild(title);
      container.appendChild(toggleRow);

      filterSummary = document.createElement('div');
      filterSummary.className = 'filter-selected-summary';
      filterSummary.style.display = 'none';
      container.appendChild(filterSummary);

      toggleRow.addEventListener('click', () => {
        const collapsed = selectBody.style.display === 'none';
        // See WijCheckboxes' identical lookup - a subAg picker (filter.js) can land as a
        // sibling of selectBody here too, only after this widget has already rendered.
        const subAgSlot = container.querySelector(':scope > .filter-subag-slot');
        if (collapsed) {
          selectBody.style.display = 'block';
          if (subAgSlot) subAgSlot.style.display = '';
          filterSummary.style.display = 'none';
          chevron.icon = 'chevron-down';
        } else {
          filterSummary.textContent = wijSelectInstance.getSelectedOptionsAsListOfLabels() || 'None selected';
          selectBody.style.display = 'none';
          if (subAgSlot) subAgSlot.style.display = 'none';
          filterSummary.style.display = 'block';
          chevron.icon = 'chevron-right';
        }
      });
    } else if (this.showTitle) {
      container.appendChild(title);  // Append the new element to the container
    }
    container.appendChild(selectBody);

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
        // sidebar.filters is only set when the sidebar has attribute filters at all (e.g.
        // vizMap) - vizDashboard's sidebar has none, so this stays undefined there and the
        // subAg picker's only possible match is sidebar.aggregatorFilter itself.
        let filter = (this.vizLayout.sidebar.filters || []).find(o => o.id === modifiedId)
                     || this.vizLayout.sidebar.aggregatorFilter;

        filter.afterUpdateSubAg();
    
      } else if (this.id.includes('_aggregator-selector')) {
        // Run only if aggregator
        activeLayout.sidebar.afterUpdateAggregator();
    
      } else {
        activeLayout.afterUpdateSidebar();
      }
    });
    
    selectBody.appendChild(select);


    let space = document.createElement("calcite-label");  // Create a new div element
    selectBody.appendChild(space);  // Append the new element to the container
    
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
    return this.options.filter(option => option.value === this.selected).map(option => option.label).join(', ');
  }

  hide() {
    document.getElementById(this.containerId).style.display = 'none';
  }

  show() {
    document.getElementById(this.containerId).style.display = 'block';
  }
  
  removeOptionByValue(optionValue) {
    const select = document.getElementById(this.id); // Get the select element by its id
    const options = select.querySelectorAll('calcite-option'); // Get all the option elements
  
    options.forEach((option, index) => {
      if (option.value === optionValue) {
        select.removeChild(option); // Remove the option from the select
      }
    });
  }

  // Method to add an option to the beginning of the list if it doesn't exist
  addOptionIfNotExistsToBeginning(optionValue, optionText) {
    const select = document.getElementById(this.id); // Get the select element by its id
    const options = select.querySelectorAll('calcite-option'); // Get all the option elements

    // Check if the option already exists
    let optionExists = false;
    for (let i = 0; i < options.length; i++) {
      if (options[i].value === optionValue) {
        optionExists = true;
        break;
      }
    }

    // Add the option to the beginning if it doesn't exist
    if (!optionExists) {
      const newOption = document.createElement('calcite-option');
      newOption.value = optionValue;
      newOption.textContent = optionText;
      select.insertBefore(newOption, select.firstChild); // Insert the option at the beginning
    }
  }

}
