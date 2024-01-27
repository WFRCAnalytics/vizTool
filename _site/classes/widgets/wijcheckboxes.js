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

    var lstChecked = [];

    this.options.forEach((option, index) => {
      // create checkboxes
      var checkboxLabel = document.createElement("calcite-label");
      checkboxLabel.setAttribute('layout', 'inline');
      checkboxLabel.classList.add('pointer-cursor');

      var checkbox = document.createElement("calcite-checkbox");

      checkbox.value = option.value;
      checkbox.checked = true;

      if (checkbox.checked) {
          lstChecked.push(checkbox.value);
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


  getSelectedOptionsAsList() {
    return this.selected;
  }

}