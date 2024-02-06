class WijCheckboxes {
  constructor(id, title, selected, options, vizLayout, spaceafter=false) {
    this.id = id;
    this.title = title;
    this.selected = selected;
    this.options = options;
    this.vizLayout = vizLayout;
    this.spaceafter = spaceafter;

    this.containerId = this.id + "-container";
  }

  render() {
    console.log('wijcheckboxes:render:' + this.containerId)
    const mainContainer = document.createElement('div');
    mainContainer.id = this.containerId;

    const checkboxContainer = document.createElement('div');
    checkboxContainer.classList.add('checkbox-container');

    const wijCheckBoxesInstance = this;

    let title = document.createElement("calcite-label");
    title.innerHTML = "<b>" + this.title + "</b>";
    mainContainer.appendChild(title); // Append the title to the main container


    if (this.options.length>5) {
      let uncheckall = document.createElement("calcite-button");
      uncheckall.setAttribute('id', this.id + '-check-all-toggle');
  
      uncheckall.classList.add('check-all-toggle-button');
  
      uncheckall.innerHTML = "Uncheck All";
  
      uncheckall.addEventListener('click', () => {
          // This is where you define what happens when the button is clicked.
          // For example, to uncheck all checkboxes:
        this.checkAllToggle();
      });
  
      mainContainer.appendChild(uncheckall); // Append the title to the main container
  
    }

    var lstChecked = [];

    this.options.forEach((option, index) => {
      // create checkboxes
      var checkboxLabel = document.createElement("calcite-label");
      checkboxLabel.setAttribute('layout', 'inline');
      checkboxLabel.setAttribute('id', this.id + '-chklabel-' + option.value);
      checkboxLabel.classList.add('pointer-cursor');
      

      var checkbox = document.createElement("calcite-checkbox");

      checkbox.setAttribute('id', this.id + '-chk-' + option.value);

      checkbox.value = option.value;

      if (this.selected.includes(option.value)) {
        checkbox.checked = true;
        lstChecked.push(checkbox.value);
      } else {
        checkbox.checked = false;
      }

      // Listen for changes to the checkbox
      checkbox.addEventListener("calciteCheckboxChange", function (e) {
        const curValue = e.currentTarget.value;
        if (e.currentTarget.checked == false) {
          lstChecked = lstChecked.filter(item => item !== curValue);
        } else {
          if (!lstChecked.includes(curValue)) {
            lstChecked.push(curValue);
          }
        }
        
          wijCheckBoxesInstance.selected = lstChecked;
          wijCheckBoxesInstance.vizLayout.updateDisplay();
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
    this.options.forEach((option, index) => {
      // create checkboxes
      var checkboxLabel = document.getElementById(this.id + '-chklabel-' + option.value);
      if (option.subag.includes(_subag)) {
        checkboxLabel.style.display = "block";
      } else {
        checkboxLabel.style.display = "none";
      }
    });
  }

  getSelectedOptionsAsList() {
    return this.selected;
  }

  checkAllToggle() {
    console.log(this.id + '-checkAllToggle')

    let uncheckall = document.getElementById(this.id + '-check-all-toggle');

    
    // updated selected and display
    var lstChecked = [];


    if (uncheckall.innerHTML==="Uncheck All") {
      this.options.forEach((option, index) => {
        // create checkboxes
        var checkbox = document.getElementById(this.id + '-chk-' + option.value);
        checkbox.checked = false;
      });
      uncheckall.innerHTML = 'Check All';
    } else {
      this.options.forEach((option, index) => {
        // create checkboxes
        var checkbox = document.getElementById(this.id + '-chk-' + option.value);
        checkbox.checked = true;
        lstChecked.push(option.value);
      });
      uncheckall.innerHTML = 'Uncheck All';
    }

    this.selected = lstChecked;
    this.vizLayout.updateDisplay();

  }

}