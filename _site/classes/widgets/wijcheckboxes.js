class WijCheckboxes {
  constructor(id, options, selected, comboSelected, hidden, text, vizLayout, parent) {
    this.id = id;
    this.containerId = this.id + "-container";
    this.options = options;
    this.selected = selected;
    this.comboSelected = comboSelected;
    this.hidden = hidden !== undefined ? hidden : false;
    this.text = text;
    this.vizLayout = vizLayout;
    this.parentEntity = parent;
  }

  render() {
    console.log('wijcheckboxes:render:' + this.containerId)
    const mainContainer = document.createElement('div');
    mainContainer.id = this.containerId;

    const checkboxContainer = document.createElement('div');
    checkboxContainer.classList.add('checkbox-container');

    const wijCheckBoxesInstance = this;

    let title = document.createElement("calcite-label");
    title.innerHTML = "<b>" + this.text + "</b>";
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
        
          wijCheckBoxesInstance.comboSelected = lstChecked;
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

    
    const lineBreak = document.createElement('br');
    mainContainer.appendChild(lineBreak); // Append a line break after the checkbox container


    return mainContainer;
  }


  getSelectedOptionsAsList() {
    return this.comboSelected;
  }

}