class MenuItem {
    constructor(id, text, iconStart, sidebarContent, templateContent) {
      this.menuItemId = id;
      this.menuItemText = text;
      this.menuItemIconStart = iconStart;
      this.sidebarContent = sidebarContent;
      this.templateContent = templateContent;
    }

    createMenuItemElement() {
      const mainMenuItem = document.createElement('calcite-menu-item');
      mainMenuItem.setAttribute('id', this.menuItemId);
      mainMenuItem.setAttribute('text', this.menuItemText);
      mainMenuItem.setAttribute('icon-start', this.menuItemIconStart);
      mainMenuItem.setAttribute('text-enabled', '');

      const menuItemInstance = this;

      mainMenuItem.addEventListener('click', function() {
          let mainSidebarItems2 = document.querySelectorAll('calcite-menu-item');
          mainSidebarItems2.forEach(item2 => {
              if(item2.text === menuItemInstance.menuItemText) {  // Use the saved instance context here
                  item2.active = true;
              } else {
                  item2.active = false;
              }
          });
          
          menuItemInstance.populateSidebar();  // Use the saved instance context here as well
          menuItemInstance.populateMainContent(menuItemInstance.templateContent);
      });
  
      return mainMenuItem;
  
    }

    populateSidebar() {
      const sidebar = document.querySelector('#sidebarContent');
      // You might have to modify the next line based on the structure of your SidebarContent class.
      sidebar.innerHTML = ''; // clear existing content
      sidebar.appendChild(this.sidebarContent.render());
      // Set the focus to the sidebar
      sidebar.focus();
    }

    populateMainContent(templateContentItem) {
      const targetElement = document.querySelector('#mainContent');
      targetElement.innerHTML = templateContentItem; 

    }

  }