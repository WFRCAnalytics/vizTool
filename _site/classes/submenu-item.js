// Class for Submenu Item
class SubmenuItem {
  constructor(data) {
    this.id = this.generateIdFromText(data.submenuText);
    this.submenuText = data.submenuText;
    this.submenuIconStart = data.submenuIconStart;
    this.submenuTemplate = data.submenuTemplate;
    this.mapSidebarItems = (data.mapSidebarItems || []).map(item => new MapSidebarItem(item));
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  createSubmenuItemElement() {
    const submenuItem = document.createElement('calcite-menu-item');
    submenuItem.setAttribute('id', this.id);
    submenuItem.setAttribute('text', this.submenuText);
    submenuItem.setAttribute('icon-start', this.submenuIconStart);
    submenuItem.setAttribute('text-enabled', '');

    const submenuItemInstance = this;

    submenuItem.addEventListener('click', function() {
      let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
      mainSidebarItems2.forEach(item2 => {
        if(item2.text === submenuItemInstance.menuText) {  // Use the saved instance context here
          item2.active = true;
        } else {
          item2.active = false;
        }
      });

      // Show corresponding template
      const allTemplates = document.querySelectorAll('.template');
      allTemplates.forEach(template => template.hidden = true);
  
      // Show the selected template
      const selectedTemplate = document.getElementById(submenuItemInstance.submenuTemplate + 'Template');
      if (selectedTemplate) {
        selectedTemplate.hidden = false;
        // ... (Any additional specific logic for the template type)
      }
      //submenuItemInstance.populateSidebar();  // Use the saved instance context here as well
      //submenuItemInstance.populateMainContent(submenuItemInstance.templateContent);
    });
    return submenuItem;
  }
}