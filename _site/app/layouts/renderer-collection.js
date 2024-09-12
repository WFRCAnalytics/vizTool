require([
  "esri/renderers/ClassBreaksRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/SimpleLineSymbol",
  "esri/Color",
], function (ClassBreaksRenderer, UniqueValueRenderer, SimpleRenderer, SimpleLineSymbol, Color) {
  
  class RendererCollection {
    constructor(data) {
      this.main        = {"name": data.main       .legendTitle, "renderer": createRenderer(data.main       ) , "labelExpressionInfo": data.main       .labelExpressionInfo};
      this.compare_abs = {"name": data.compare_abs.legendTitle, "renderer": createRenderer(data.compare_abs) , "labelExpressionInfo": data.compare_abs.labelExpressionInfo};
      this.compare_pct = {"name": data.compare_pct.legendTitle, "renderer": createRenderer(data.compare_pct) , "labelExpressionInfo": data.compare_pct.labelExpressionInfo};
    }
  }

  function createRenderer(data) {
    if (data.classBreakInfos) {
      const renderer = new ClassBreaksRenderer();
      renderer.field = "dVal";
      renderer.classBreakInfos = data.classBreakInfos;
      if (data.defaultSymbol !== undefined) {
        renderer.defaultSymbol = data.defaultSymbol;
      }
      if (data.defaultLabel !== undefined) {
        renderer.defaultLabel = data.defaultLabel;
      }
          
      // Add legend options
      if (data.legendTitle) {
        renderer.legendOptions = {
          title: data.legendTitle
        };
      }
      return renderer;
    } else if (data.valueExpression && data.uniqueValueInfos) {
      const renderer = new UniqueValueRenderer();
      renderer.valueExpression = data.valueExpression;
      renderer.uniqueValueInfos = data.uniqueValueInfos;

      if (data.defaultSymbol !== undefined) {
        renderer.defaultSymbol = data.defaultSymbol;
      }
      if (data.defaultLabel !== undefined) {
        renderer.defaultLabel = data.defaultLabel;
      }

      // Add legend options
      if (data.legendTitle) {
        renderer.legendOptions = {
          title: data.legendTitle
        };
      }
      return renderer;
    }
    return null;  // Or however you wish to handle a case where neither condition is true.
  }
  
  // Export RendererCollection to the global scope
  // Exporting to Global Scope (Not recommended but works): If you want to make the RendererCollection class globally accessible (not a good practice but will solve the immediate issue):
  window.RendererCollection = RendererCollection;

});