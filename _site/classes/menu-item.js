// Class for Main Menu Item
class MenuItem {
  constructor(data) {
    this.id = this.generateIdFromText(data.menuText);
    this.menuText = data.menuText;
    this.menuIconStart = data.menuIconStart;
    this.submenuItems = (data.submenuItems || []).map(item => new SubmenuItem(item));
  }

  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  createMenuItemElement() {
    const menuItem = document.createElement('calcite-menu-item');
    menuItem.setAttribute('id', this.id);
    menuItem.setAttribute('text', this.menuText);
    menuItem.setAttribute('icon-start', this.menuIconStart);
    menuItem.setAttribute('text-enabled', '');

    const menuItemInstance = this;

    menuItem.addEventListener('click', function() {
        let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
        mainSidebarItems2.forEach(item2 => {
            if(item2.text === menuItemInstance.menuText) {  // Use the saved instance context here
                item2.active = true;
            } else {
                item2.active = false;
            }
        });
        
        menuItemInstance.populateSubmenu();  // Use the saved instance context here as well
        //menuItemInstance.populateMainContent(menuItemInstance.templateContent);
    });

    return menuItem;

  }

  populateSubmenu() {
    const secondaryMenu = document.querySelector('calcite-navigation[slot="navigation-secondary"] > calcite-menu[slot="content-start"]');

    // Clear existing menu items
    secondaryMenu.innerHTML = '';

    // Render each menu item and log (or insert into the DOM)
    this.submenuItems.forEach(submenuItem => {
      secondaryMenu.appendChild(submenuItem.createSubmenuItemElement());
    });
  }
  
}