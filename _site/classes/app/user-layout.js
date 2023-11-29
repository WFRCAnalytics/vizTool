// Class for User
class UserLayout {
  constructor(data, user) {
    this.menuItems = (data.menuItems || []).map(item => new MenuItem(item, this));
      this.user = user; // Store reference to User
  }

  hideAllUserLayoutLayers() {
    this.menuItems.forEach(menuItem => {
      menuItem.hideAllMenuItemLayers();
    });
  }
}