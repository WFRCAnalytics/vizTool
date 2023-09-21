// Class for modEnt Item
class modelEntity {
  constructor(data) {
    this.id = this.generateIdFromText(data.submenuText);
    this.submenuText = data.submenuText;
    this.submenuIconStart = data.submenuIconStart;
    this.submenuTemplate = data.submenuTemplate;
    this.mapSidebarItems = (data.mapSidebarItems || []).map(item => new MapSidebarItem(item));
    this.textFile = data.textFile;
    this.pngFile = data.pngFile;
    this.showLayers = data.showLayers || [];
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  createModelEntityElement() {
    const modelEntity = document.createElement('calcite-menu-item');
    modelEntity.setAttribute('id', this.id);
    modelEntity.setAttribute('text', this.submenuText);
    modelEntity.setAttribute('icon-start', this.submenuIconStart);
    modelEntity.setAttribute('text-enabled', '');

    const modelEntityInstance = this;

    modelEntity.addEventListener('click', function() {
      let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
      mainSidebarItems2.forEach(item2 => {
        if(item2.text === modelEntityInstance.menuText) {  // Use the saved instance context here
          item2.active = true;
        } else {
          item2.active = false;
        }
      });

      // Show corresponding template
      const allTemplates = document.querySelectorAll('.template');
      allTemplates.forEach(template => template.hidden = true);
  
      // Show the selected template
      const selectedTemplate = document.getElementById(modelEntityInstance.submenuTemplate + 'Template');
      if (selectedTemplate) {
        selectedTemplate.hidden = false;
        // ... (Any additional specific logic for the template type)
      }
      const sidebarSelect = modelEntityInstance.getSidebarSelector(modelEntityInstance.submenuTemplate)
      modelEntityInstance.populateSidebar(sidebarSelect);  // Use the saved instance context here as well
      modelEntityInstance.populateText();
      modelEntityInstance.populateImage();
      modelEntityInstance.updateLayerVisibility();
      //modelEntityInstance.populateMainContent(modelEntityInstance.templateContent);


    });
    return modelEntity;
  }
  
  updateLayerVisibility() {
    // Loop through each layer in the map
    map.layers.forEach(layer => {
      // Check if the layer's id (or name, or other unique identifier) is in the showLayers list
      if (this.showLayers.includes(layer.title)) {
        // Show the layer if it's in the list
        layer.visible = true;
      } else {
        // Hide the layer if it's not in the list
        layer.visible = false;
      }
    });
  }

  populateSidebar(sidebarSelect) {

    const container = document.createElement('div');
    
    const titleEl = document.createElement('h2');
    titleEl.textContent = this.title;

    const sidebarContainer = document.createElement('div');
    this.mapSidebarItems.forEach(mapSidebarItem => {
      sidebarContainer.appendChild(mapSidebarItem.render());
    });

    container.appendChild(titleEl);
    container.appendChild(sidebarContainer);
    
    const sidebar = document.querySelector(sidebarSelect);
    // You might have to modify the next line based on the structure of your SidebarContent class.
    sidebar.innerHTML = ''; // clear existing content
    sidebar.appendChild(container);
    // Set the focus to the sidebar
    sidebar.focus();

  }

  populateText(){
    
    // Specify the file path
    const filePath = this.textFile;

    if (typeof filePath==='undefined') return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const fileContents = e.target.result;
        const fileContentsElement = document.getElementById("fileContents");
        if (fileContentsElement) {
            fileContentsElement.textContent = fileContents;
        }
    };
    fetch(filePath)
        .then(response => response.blob())
        .then(blob => {
            reader.readAsText(blob);
        })
        .catch(error => {
            console.error("Error reading file:", error);
        });
  }

  populateImage() {
    // Specify the file path
    const imagePath = this.pngFile;

    if (typeof imagePath==='undefined') return;

    fetch(imagePath)
        .then(response => {
            return response.blob();
        })
        .then(blob => {
            const imageURL = URL.createObjectURL(blob); // Create a URL for the blob
            const imgHTML = `<img src="${imageURL}" alt="Image Placeholder">`;

            const imageElement = document.getElementById("imageElement");
            if (imageElement) {
                imageElement.innerHTML = imgHTML; // Set the HTML content
            }
        })
        .catch(error => {
            console.error("Error fetching or displaying image:", error);
        });
}


  getSidebarSelector(submenuTemplate) {
    if (submenuTemplate === 'vizLog') {
        return '#logSidebarContent';
    } else if (submenuTemplate === 'vizMap') {
        return '#sidebarContent';
    } else if (submenuTemplate === 'vizTrends') {
        return '#trendSidebarContent'
    } else if(submenuTemplate === 'vizMatrix') {
        return '#matrixSidebarContent'
    }

}
}
