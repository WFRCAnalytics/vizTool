// Class for modEnt Item
class modelEntity {
  constructor(data) {
    this.id = this.generateIdFromText(data.submenuText);
    this.submenuText = data.submenuText;
    this.submenuIconStart = data.submenuIconStart;
    this.submenuTemplate = data.submenuTemplate;
    this.mapSidebarItems = (data.mapSidebarItems || []).map(item => new MapSidebarItem(item));
    this.textFile = data.textFile;
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
      modelEntityInstance.populateText();  // Use the saved instance context here as well
      //modelEntityInstance.populateMainContent(modelEntityInstance.templateContent);
    });
    return modelEntity;
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


  getSidebarSelector(submenuTemplate) {
    if (submenuTemplate === 'vizLog') {
        return '#logSidebarContent';
    } else {
        return '#sidebarContent';
    }
}
}
