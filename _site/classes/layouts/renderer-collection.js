require([
  "esri/renderers/ClassBreaksRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/SimpleLineSymbol",
  "esri/Color",
], function (ClassBreaksRenderer, UniqueValueRenderer, SimpleRenderer, SimpleLineSymbol, Color) {
  
  class RendererCollection {
    constructor(data) {
      this.main        = {"name": data.main.name       , "renderer": createRenderer(data.main       ) };
      this.compare_abs = {"name": data.compare_abs.name, "renderer": createRenderer(data.compare_abs) };
      this.compare_pct = {"name": data.compare_pct.name, "renderer": createRenderer(data.compare_pct) };
    }
  }

  function createRenderer(data) {
    if (data.classBreakInfos) {
      const renderer = new ClassBreaksRenderer();
      renderer.field = data.field;
      renderer.classBreakInfos = data.classBreakInfos;
      return renderer;
    } else if (data.valueExpression && data.uniqueValueInfos) {
      const renderer = new UniqueValueRenderer();
      renderer.valueExpression = data.valueExpression;
      renderer.uniqueValueInfos = data.uniqueValueInfos;
      return renderer;
    }
    return null;  // Or however you wish to handle a case where neither condition is true.
  }
  
  // Export RendererCollection to the global scope
  // Exporting to Global Scope (Not recommended but works): If you want to make the RendererCollection class globally accessible (not a good practice but will solve the immediate issue):
  window.RendererCollection = RendererCollection;

});