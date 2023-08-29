class SidebarItem {
    constructor(id, text, options = [], type = "radio", selectedOption) {
        this.id = id;
        this.text = text;
        this.options = options;
        this.type = type;
        this.selectedOption = selectedOption;
    }

    // Render the item based on its type
    render() {
      const container = document.createElement('div');
      
      let title = document.createElement("calcite-label");  // Create a new div element
      title.innerHTML = "<b>" + this.text + "</b>";  // Set its innerHTML
      container.appendChild(title);  // Append the new element to the container
      
      if (this.type === "radio") {
        this.createRadioButtons(container);

      } else if (this.type === "checkbox") {
        this.createCheckBoxes(container)
        
      } else if (this.type === "select") {
        this.createSelect(container)
      }
      
      let space = document.createElement("calcite-label");  // Create a new div element
      space.innerHTML = "<br/>";  // Set its innerHTML
      container.appendChild(space);  // Append the new element to the container
      
      return container;
    }

    
    getSelectedOption() {
      return this.selectedOption;
    }

    createRadioButtons(container) {
      this.options.forEach((option, index) => {
          // Create radio buttons
          var radioButtonLabel = document.createElement("calcite-label");
          radioButtonLabel.setAttribute('layout', 'inline');
          radioButtonLabel.classList.add('pointer-cursor');

          var radioButton = document.createElement("calcite-radio-button");
          radioButton.name = this.id;
          radioButton.value = option;

          // Optionally, select the first radio button by default
          if (option === this.selectedOption) {
              radioButton.checked = true;
          }

          // Listen for changes to the radio buttons
          radioButton.addEventListener("change", (e) => {
               // to make sure the radio button is the is the actual element
              const radioButton = e.currentTarget; // or e.target.closest('input[type="radioButton"]')
              // Update renderer with value of radio button
              console.log(this.id + ':' + radioButton.name + ' radio button change');
          });

          // Nest the radio button directly inside the calcite-label
          radioButtonLabel.appendChild(radioButton);
          radioButtonLabel.appendChild(document.createTextNode(option || option));

          container.appendChild(radioButtonLabel);
      });
  }

  createCheckBoxes(container) {
    this.options.forEach((option, index) => {

      // create checkboxes
      var checkBoxLabel = document.createElement("calcite-label");
      checkBoxLabel.setAttribute('layout', 'inline');
      checkBoxLabel.classList.add('pointer-cursor');

      var checkBox = document.createElement("calcite-checkbox");
      checkBox.name = this.id;
      checkBox.value = option;

      // Optionally, select the first checkbox by default
      if (option === this.selectedOption) {
        checkBox.checked = true;
      }
      // Listen for changes to the checkbox
      checkBox.addEventListener("change", function (e) {
        // to make sure the checkbox is the is the actual element
        const checkBox = e.currentTarget; // or e.target.closest('input[type="checkbox"]')
        // update renderer with value of checkbox
        console.log(this.id + ':' + this.name + ' checkbox change')
      });    

      // Nest the checkbox directly inside the calcite-label
      checkBoxLabel.appendChild(checkBox);
      checkBoxLabel.appendChild(document.createTextNode(option || option));

      container.appendChild(checkBoxLabel);

    });
  }

  createSelect(container){
    const select = document.createElement('calcite-select');
    this.options.forEach(option => {
      const optionEl = document.createElement('calcite-option');
      optionEl.value = option;
      optionEl.textContent = option;
      
      if (option === this.selectedOption) {
        optionEl.setAttribute('selected', 'true'); // This will select the option
      }
      select.appendChild(optionEl);
    });
    select.addEventListener('change', (e) => {
      this.selectedOption = e.detail;
    });
    container.appendChild(select);
  }


  }