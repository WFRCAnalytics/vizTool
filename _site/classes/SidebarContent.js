class SidebarContent {
  constructor(title, SidebarItems = []) {
    this.title = title;
    this.SidebarItems = SidebarItems;
  }

  render() {
    const container = document.createElement('div');
    
    const titleEl = document.createElement('h2');
    titleEl.textContent = this.title;

    const sidebarContainer = document.createElement('div');
    this.SidebarItems.forEach(sidebarItem => {
      sidebarContainer.appendChild(sidebarItem.render());
    });

    container.appendChild(titleEl);
    container.appendChild(sidebarContainer);

    return container;
  }
}