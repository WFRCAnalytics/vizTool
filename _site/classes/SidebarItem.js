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

        this.options.forEach((option, index) => {

          // create radio buttons
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
          radioButton.addEventListener("change", function (e) {
            // to make sure the radio button is the is the actual element
            const radioButton = e.currentTarget; // or e.target.closest('input[type="radio"]')
            // update renderer with value of radio button
            console.log(this.id + ':' + this.name + ' radio button change')
          });    

          // Nest the radio button directly inside the calcite-label
          radioButtonLabel.appendChild(radioButton);
          radioButtonLabel.appendChild(document.createTextNode(option || option));

          container.appendChild(radioButtonLabel);

        });
      } else if (this.type === "select") {
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
      
      let space = document.createElement("calcite-label");  // Create a new div element
      space.innerHTML = "<br/>";  // Set its innerHTML
      container.appendChild(space);  // Append the new element to the container
      
      return container;
    }

    getSelectedOption() {
      return this.selectedOption;
    }
  }