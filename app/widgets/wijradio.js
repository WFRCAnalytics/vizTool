class WijRadio {
  constructor(parentid, title, selected, options, vizLayout, infoTextHtml="", spaceafter=false) {
    this.id = parentid + '-wij';
    this.title = title;
    this.options = options;
    this.vizLayout = vizLayout;
    this.infoTextHtml = infoTextHtml;
    this.spaceafter = spaceafter;
    this.containerId = this.id + "-container"
    // Check if the selected value is part of options
    if (selected && options.some(option => option.value === selected)) {
      this.selected = selected;
    } else {
      if (options.length>0) {
        this.selected = options[0].value; // Default to the first option
      }
    }
  }

  render() {
    console.log('wijradio:render:' + this.containerId)
    const container = document.createElement('div');
    container.id = this.containerId;

    const wijRadioInstance = this;
        
    // Inside the render() method, modify the title setup

    let titleContainer = document.createElement("span"); // Or "div" with inline styling
    titleContainer.classList.add("title");
    titleContainer.innerHTML = `<b>${this.title}</b>`; // Keep your title as is
    titleContainer.style.display = "inline-block"; // Ensures inline display

    if (this.infoTextHtml) {
      let infoIcon = document.createElement("span");
      infoIcon.classList.add("info-icon");
      infoIcon.textContent = "i"; // The info icon text
      infoIcon.style.display = "inline-block"; // Ensures the icon is inline
  
      let popupDescription = document.createElement("span");
      popupDescription.classList.add("popup");
      popupDescription.innerHTML = this.infoTextHtml;
  
      // Append the info icon and popup to the titleContainer, not directly to the title
      titleContainer.appendChild(infoIcon);
      titleContainer.appendChild(popupDescription);  
    }

    // Finally, append the titleContainer to the container, not the title directly
    container.appendChild(titleContainer);
    
    // Call a type-specific rendering method
    this.options.forEach((option) => {
      // Create radio buttons
      var radioButtonLabel = document.createElement("calcite-label");
      radioButtonLabel.setAttribute('layout', 'inline');
      radioButtonLabel.classList.add('pointer-cursor');

      var radioButton = document.createElement("calcite-radio-button");
      radioButton.name = this.id;
      radioButton.value = option.value;

      // Optionally, select the first radio button by default
      if (option.value === this.selected) {
        radioButton.checked = true;
      }

      // Listen for changes to the radio buttons
      radioButton.addEventListener("calciteRadioButtonChange", (e) => {
        // to make sure the radio button is the is the actual element
        const radioButton = e.currentTarget; // or e.target.closest('input[type="radioButton"]')
        const rbValue = radioButton.value;
        // Update renderer with value of radio button
        console.log('radio button change '+ this.id + ':' + rbValue );
        this.selected = rbValue;
        if (this.id.includes('chart-filter')) {
          wijRadioInstance.vizLayout.afterUpdateTrendSelector();
        } else {
          wijRadioInstance.vizLayout.afterUpdateSidebar();
        }
        
      });

      // Nest the radio button directly inside the calcite-label
      radioButtonLabel.appendChild(radioButton);
      radioButtonLabel.appendChild(document.createTextNode(option.label));

      container.appendChild(radioButtonLabel);
    });

    if (this.spaceafter) {
      const lineBreak = document.createElement('br');
      container.appendChild(lineBreak);
    }

    return container;
  }

  getSelectedOptionsAsList() {
    return [this.selected];
  }
  
  getSelectedOptionsAsListOfLabels() {
    return this.options.filter(option => this.getSelectedOptionsAsList().includes(option.value)).map(option => option.label).join(', ');
  }

  hide() {
    document.getElementById(this.containerId).style.display = 'none';
  }

  show() {
    document.getElementById(this.containerId).style.display = 'block';
  }
  
}