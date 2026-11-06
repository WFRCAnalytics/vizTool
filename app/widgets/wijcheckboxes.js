class WijCheckboxes {
  constructor(parentid, title, selected, options, vizLayout, spaceafter=false, collapsible=false) {
    this.id = parentid + '-wij';
    this.title = title;
    this.options = options;
    this.vizLayout = vizLayout;
    this.spaceafter = spaceafter;
    this.collapsible = collapsible;

    // No selection given at all (as opposed to an explicit, possibly empty, array from a
    // caller) - default to every option checked, not just the first. Mirrors
    // Filter.initializeFilter()'s own fallback for the common case (a filter with no
    // fSelected in config), and closes the gap for a caller that skips that wrapper entirely.
    if (selected) {
      this.selected = selected;
    } else {
      this.selected = options.map(option => option.value);
    }

    this.containerId = this.id + "-container";

    this.numOptionsForCheckAllButton = configApp.checkboxesSelector.numOptionsForCheckAllButton;
    this.textCheckAll                = configApp.checkboxesSelector.textCheckAll               ;
    this.textUncheckAll              = configApp.checkboxesSelector.textUncheckAll             ;
  }

  render() {
    console.log('wijcheckboxes:render:' + this.containerId)
    const mainContainer = document.createElement('div');
    mainContainer.id = this.containerId;

    const checkboxContainer = document.createElement('div');
    checkboxContainer.classList.add('checkbox-container');

    const _thisInstance = this;

    let _filterLabel = document.createElement("calcite-label");

    // define filter title divs
    const _filterTitle = document.createElement('div');
    const _filterName = document.createElement('div');

    // set properties and styles
    _filterTitle.className = 'filterTitle';
    _filterName.className = 'filterName';
    _filterName.textContent = 'Name of the Filter'; // Set the name

    // set name
    _filterName.innerHTML = "<b>" + this.title + "</b>";

    let _filterSummary = null;
    let _checkAllButton = null; // assigned below; toggle handler only reads it at click time
    if (this.collapsible) {
      // Clicking the chevron+name toggles the option list; collapsed state shows a
      // truncated summary of the current selection in its place (computed fresh at
      // collapse time, so it always reflects whatever was last checked).
      const _filterToggleRow = document.createElement('div');
      _filterToggleRow.className = 'filter-toggle-row';

      const _filterChevron = document.createElement('calcite-icon');
      _filterChevron.icon = 'chevron-down';
      _filterChevron.scale = 's';

      _filterToggleRow.appendChild(_filterChevron);
      _filterToggleRow.appendChild(_filterName);
      _filterTitle.appendChild(_filterToggleRow);

      _filterSummary = document.createElement('div');
      _filterSummary.className = 'filter-selected-summary';
      _filterSummary.style.display = 'none';

      _filterToggleRow.addEventListener('click', () => {
        const collapsed = checkboxContainer.style.display === 'none';
        // Looked up at click time (not captured earlier) since filter.js inserts this - a
        // subAg picker like fRouteName's "List Route Names for" mode dropdown - as a sibling
        // of checkboxContainer only after this widget has already rendered.
        const _subAgSlot = mainContainer.querySelector(':scope > .filter-subag-slot');
        if (collapsed) {
          checkboxContainer.style.display = 'block';
          if (_checkAllButton) _checkAllButton.style.display = '';
          if (_subAgSlot) _subAgSlot.style.display = '';
          _filterSummary.style.display = 'none';
          _filterChevron.icon = 'chevron-down';
        } else {
          _filterSummary.textContent = _thisInstance.getSelectedOptionsAsListOfLabels() || 'None selected';
          checkboxContainer.style.display = 'none';
          if (_checkAllButton) _checkAllButton.style.display = 'none';
          if (_subAgSlot) _subAgSlot.style.display = 'none';
          _filterSummary.style.display = 'block';
          _filterChevron.icon = 'chevron-right';
        }
      });
    } else {
      _filterTitle.appendChild(_filterName); // Add the name to the title container
    }

    _filterLabel.appendChild(_filterTitle);

    mainContainer.appendChild(_filterLabel); // Append the _filterLabel to the main container
    if (_filterSummary) mainContainer.appendChild(_filterSummary);

    this.options.forEach((option, index) => {
      // create checkboxes
      var checkboxLabel = document.createElement("calcite-label");
      checkboxLabel.setAttribute('layout', 'inline');
      checkboxLabel.setAttribute('id', this.id + '-chklabel-' + option.value);
      checkboxLabel.classList.add('pointer-cursor');
      
      // set display explicitly since some code layer checks for this when subaggregating
      checkboxLabel.style.display = 'block'; // This sets the display style to block

      var checkbox = document.createElement("calcite-checkbox");

      checkbox.setAttribute('id', this.id + '-chk-' + option.value);

      checkbox.value = option.value;

      if (this.selected && this.selected.includes(option.value)) {
        checkbox.checked = true;
      } else {
        checkbox.checked = false;
      }

      // Listen for changes to the checkbox
      checkbox.addEventListener("calciteCheckboxChange", function (e) {
        const curValue = e.currentTarget.value;
        if (e.currentTarget.checked == false) {
          _thisInstance.selected = _thisInstance.selected.filter(item => item !== curValue);
        } else {
          if (!_thisInstance.selected.includes(curValue)) {
            _thisInstance.selected.push(curValue);
          }
        }
        
        // manage uncheck/check all button
        if (_thisInstance.options.length>=_thisInstance.numOptionsForCheckAllButton) {
          var numCheckedVisible = 0;
          var numVisible = 0;
          _thisInstance.options.forEach((option, index) => {
            var checkboxLabel = document.getElementById(_thisInstance.id + '-chklabel-' + option.value);
            if (checkboxLabel.style.display=="block") {
              numVisible++;

              // Check to see if at least one is checked
              var checkbox = document.getElementById(_thisInstance.id + '-chk-' + option.value);
              if (checkbox.checked) { // Simplified condition
                numCheckedVisible++;
              }
            }
          });
          let uncheckall = document.getElementById(_thisInstance.id + '-check-all-toggle');
          if (numCheckedVisible==numVisible) {
            uncheckall.innerHTML = _thisInstance.textUncheckAll;
          } else if (numCheckedVisible==0) { 
            uncheckall.innerHTML = _thisInstance.textCheckAll;
          }
        }

        _thisInstance.vizLayout.updateDisplay();
      });

      checkboxLabel.appendChild(checkbox);
      checkboxLabel.appendChild(document.createTextNode(option.label));

      checkboxContainer.appendChild(checkboxLabel); // Append the checkboxLabel to the checkbox container
    });

    if (this.hidden) {
      mainContainer.style.display = "none";
    }

    mainContainer.appendChild(checkboxContainer); // Append the checkbox container to the main container

    // Check-all/uncheck-all sits below the option list (not in the title row) so it
    // reads as acting on the list right above it, rather than floating up by the name.
    if (this.options.length>=this.numOptionsForCheckAllButton) {
      let buttonCheckToggle = document.createElement("calcite-button");
      buttonCheckToggle.setAttribute('id', this.id + '-check-all-toggle');
      buttonCheckToggle.classList.add('check-all-toggle-button');
      buttonCheckToggle.round = true;
      if (this.selected.length>0) {
        buttonCheckToggle.innerHTML = this.textUncheckAll;
      } else {
        buttonCheckToggle.innerHTML = this.textCheckAll;
      }

      buttonCheckToggle.addEventListener('click', () => {
        this.checkAllToggle();
      });

      _checkAllButton = buttonCheckToggle;
      mainContainer.appendChild(buttonCheckToggle);
    }

    if (this.spaceafter) {
      const lineBreak = document.createElement('br');
      mainContainer.appendChild(lineBreak); // Append a line break after the checkbox container
    }

    return mainContainer;
  }

  applySubAg(_subag) {
    let atleastonechecked = false; // Declare outside the loop to maintain its value across iterations
  
    this.options.forEach((option, index) => {
      // Create checkboxes
      var checkboxLabel = document.getElementById(this.id + '-chklabel-' + option.value);
      if (option.subag && option.subag.includes(_subag)) { // Ensure option.subag exists before calling includes
        checkboxLabel.style.display = "block";
      } else {
        checkboxLabel.style.display = "none";
      }
  
      // Check to see if at least one is checked
      var checkbox = document.getElementById(this.id + '-chk-' + option.value);
      if (checkbox.checked) { // Simplified condition
        atleastonechecked = true;
      }
    });
  
    // Corrected to use assignment `=`
    let uncheckall = document.getElementById(this.id + '-check-all-toggle');
    if (atleastonechecked) {
      uncheckall.innerHTML = this.textUncheckAll;
    } else {
      uncheckall.innerHTML = this.textCheckAll;
    }
  }
  

  getSelectedOptionsAsList() {
    return this.selected;
  }

  getSelectedOptionsAsListOfLabels() {
    if (this.options.length>=this.numOptionsForCheckAllButton & this.checkIfAllOptionsSelected()) {
      return 'All'
    } else {
      return this.options.filter(option => this.selected.includes(option.value)).map(option => option.label).join(', ');
    }
  }

  checkIfAllOptionsSelected() {
    if (this.options.length>=this.numOptionsForCheckAllButton) {
      var numChecked = 0;
      this.options.forEach((option, index) => {
        var checkbox = document.getElementById(this.id + '-chk-' + option.value);
        if (checkbox.checked) { // Simplified condition
          numChecked++;
        }
      });
      if (numChecked==this.options.length) {
        return true;
      } else { 
        return false;
      }
    }
  }

  // Deterministically unchecks every visible option, regardless of the check-all/uncheck-all
  // button's current label (checkAllToggle() below branches on that label, which can go stale
  // in a partially-checked state - this always ends up fully unchecked). Used by the Reference
  // Map's "Clear All" button.
  clearAll() {
    this.options.forEach((option) => {
      const checkbox = document.getElementById(this.id + '-chk-' + option.value);
      const checkboxLabel = document.getElementById(this.id + '-chklabel-' + option.value);
      if (checkbox && checkboxLabel && checkboxLabel.style.display === 'block') {
        checkbox.checked = false;
        const lstIndex = this.selected.indexOf(option.value);
        if (lstIndex > -1) {
          this.selected.splice(lstIndex, 1);
        }
      }
    });
    const uncheckall = document.getElementById(this.id + '-check-all-toggle');
    if (uncheckall) uncheckall.innerHTML = this.textCheckAll;
    this.vizLayout.updateDisplay();
  }

  checkAllToggle() {
    console.log(this.id + '-checkAllToggle')

    let uncheckall = document.getElementById(this.id + '-check-all-toggle');
    
    if (uncheckall.innerHTML===this.textUncheckAll) {
      this.options.forEach((option, index) => {
        var checkbox = document.getElementById(this.id + '-chk-' + option.value);
        const checkboxLabel = document.getElementById(this.id + '-chklabel-' + option.value);
        if (checkboxLabel.style.display=="block") {
          checkbox.checked = false;
          // remove from selected if there
          const lstIndex = this.selected.indexOf(option.value);
          if (lstIndex > -1) {
            this.selected.splice(lstIndex, 1); // Remove item if found
          }
        }
      });
      uncheckall.innerHTML = this.textCheckAll;
    } else {
      this.options.forEach((option, index) => {
        var checkbox = document.getElementById(this.id + '-chk-' + option.value);
        const checkboxLabel = document.getElementById(this.id + '-chklabel-' + option.value);
        if (checkboxLabel.style.display=="block") {
          checkbox.checked = true;
          // add to selected if not there
          if (!this.selected.includes(option.value)) {
            this.selected.push(option.value);
          }
        }
      });
      uncheckall.innerHTML = this.textUncheckAll;
    }
    this.vizLayout.updateDisplay();
  }

  hide() {
    document.getElementById(this.containerId).style.display = 'none';
  }

  show() {
    document.getElementById(this.containerId).style.display = 'block';
  }


}