class WijCheckboxes {
  constructor(id, title, selected, options, vizLayout, spaceafter=false) {
    this.id = id;
    this.title = title;
    this.selected = selected;
    this.options = options;
    this.vizLayout = vizLayout;
    this.spaceafter = spaceafter;
    
    this.containerId = this.id + "-container";

    this.numOptionsForCheckAll = 5;
    this.textCheckAll = "Check All";
    this.textUncheckAll = "Uncheck All";
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
    const _filterButton = document.createElement('div');

    // set properties and styles
    _filterTitle.className = 'filterTitle';
    _filterName.className = 'filterName';
    _filterButton.className = 'filterButton';
    _filterName.textContent = 'Name of the Filter'; // Set the name

    // set name
    _filterName.innerHTML = "<b>" + this.title + "</b>";
    _filterTitle.appendChild(_filterName); // Add the name to the title container

    // set button if 5+ options
    if (this.options.length>=this.numOptionsForCheckAll) {
      let buttonCheckToggle = document.createElement("calcite-button");
      buttonCheckToggle.setAttribute('id', this.id + '-check-all-toggle');
      buttonCheckToggle.classList.add('check-all-toggle-button');
      if (this.selected.length>0) {
        buttonCheckToggle.innerHTML = this.textUncheckAll;
      } else {
        buttonCheckToggle.innerHTML = this.textCheckAll;
      }
      
  
      buttonCheckToggle.addEventListener('click', () => {
          // This is where you define what happens when the button is clicked.
          // For example, to uncheck all checkboxes:
        this.checkAllToggle();
      });
  
      _filterButton.appendChild(buttonCheckToggle); // Append the _filterLabel to the main container
    }

    _filterTitle.appendChild(_filterButton); // Add the button container to the title container

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

      if (this.selected.includes(option.value)) {
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
        if (_thisInstance.options.length>=_thisInstance.numOptionsForCheckAll) {
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
    if (this.options.length>=this.numOptionsForCheckAll & this.checkIfAllOptionsSelected()) {
      return 'All'
    } else {
      return this.options.filter(option => this.selected.includes(option.value)).map(option => option.label).join(', ');
    }
  }

  checkIfAllOptionsSelected() {
    if (this.options.length>=this.numOptionsForCheckAll) {
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

}