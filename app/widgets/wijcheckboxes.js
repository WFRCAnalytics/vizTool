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

    // Plain div (not calcite-label) - calcite-label's own internal spacing/line-height made
    // every collapsed checkbox filter card (the only ones with a wrapper like this at all -
    // WijRadio/WijSelect's own toggle rows sit directly in their container, no equivalent
    // outer wrapper) a few px taller than WijRadio/WijSelect's own cards, a stray gap under the
    // row once collapsed that only this widget's filters showed.
    let _filterLabel = document.createElement("div");

    // define filter title divs
    const _filterTitle = document.createElement('div');
    const _filterName = document.createElement('div');

    // set properties and styles
    _filterTitle.className = 'filterTitle';
    _filterName.className = 'filterName filter-toggle-title';
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

      // Lives in the toggle row itself (not as its own row below) so collapsed state reads as
      // one line - "Name: value" - instead of the name and its value on two separate lines.
      _filterSummary = document.createElement('div');
      _filterSummary.className = 'filter-selected-summary';
      _filterSummary.style.display = 'none';
      _filterToggleRow.appendChild(_filterSummary);

      // Stashed so collapse()/expand() (below) can drive the exact same state the click
      // handler does, from outside - filter.js calls collapse() once, after this widget has
      // fully rendered, to make a filter start collapsed instead of expanded.
      this._checkboxContainer = checkboxContainer;
      this._filterSummary = _filterSummary;
      this._filterChevron = _filterChevron;
      this._mainContainer = mainContainer;

      _filterToggleRow.addEventListener('click', () => {
        this.setCollapsedState(checkboxContainer.style.display !== 'none');
      });

      // Collapsed, there's nothing else clickable in here besides the toggle row/summary text -
      // a click anywhere in the card expands it, a bigger and easier target than just the
      // chevron. Collapsing stays chevron-only (this never fires while already expanded, since
      // it only acts when currently collapsed) so clicking an option/button doesn't collapse it
      // back up by accident.
      mainContainer.addEventListener('click', (e) => {
        if (e.target.closest('.filter-toggle-row')) return; // that row handles its own toggle
        if (checkboxContainer.style.display === 'none') this.expand();
      });
    } else {
      _filterTitle.appendChild(_filterName); // Add the name to the title container
    }

    _filterLabel.appendChild(_filterTitle);

    mainContainer.appendChild(_filterLabel); // Append the _filterLabel to the main container

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
      this._checkAllButton = buttonCheckToggle;
      mainContainer.appendChild(buttonCheckToggle);
    }

    if (this.spaceafter) {
      const lineBreak = document.createElement('br');
      mainContainer.appendChild(lineBreak); // Append a line break after the checkbox container
    }

    return mainContainer;
  }

  // Shared by the toggle-row click handler and collapse()/expand() (filter.js calls collapse()
  // once, right after this widget's full render - including any subAg slot inserted afterward
  // as its sibling - to make a filter start collapsed instead of its old hardcoded-expanded
  // default). No-op if this widget wasn't built collapsible in the first place.
  setCollapsedState(collapsed) {
    if (!this.collapsible || !this._checkboxContainer) return;
    const _subAgSlot = this._mainContainer.querySelector(':scope > .filter-subag-slot');
    // Card is this widget's parent once filter.js has appended it (see filter.js's render()) -
    // normalizes padding to match the compact cards while collapsed (see styles.css).
    const _card = this._mainContainer.parentElement;
    if (_card) _card.classList.toggle('wij-row-collapsed', collapsed);
    if (collapsed) {
      this._filterSummary.textContent = this.getSelectedOptionsAsListOfLabels() || 'None selected';
      this._checkboxContainer.style.display = 'none';
      if (this._checkAllButton) this._checkAllButton.style.display = 'none';
      if (_subAgSlot) _subAgSlot.style.display = 'none';
      this._filterSummary.style.display = 'block';
      this._filterChevron.icon = 'chevron-right';
    } else {
      this._checkboxContainer.style.display = 'block';
      if (this._checkAllButton) this._checkAllButton.style.display = '';
      if (_subAgSlot) _subAgSlot.style.display = '';
      this._filterSummary.style.display = 'none';
      this._filterChevron.icon = 'chevron-down';
    }
  }

  collapse() { this.setCollapsedState(true); }
  expand() { this.setCollapsedState(false); }

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
        // Falls back to this.selected (always current, even before this widget's checkboxes
        // are attached to the live document - e.g. collapse(), called from filter.js right
        // after render() while everything's still in-memory) instead of requiring
        // document.getElementById to find a live element.
        var checkbox = document.getElementById(this.id + '-chk-' + option.value);
        var isChecked = checkbox ? checkbox.checked : this.selected.includes(option.value);
        if (isChecked) {
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