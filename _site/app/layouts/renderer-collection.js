require([
  "esri/renderers/ClassBreaksRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/SimpleLineSymbol",
  "esri/Color",
], function (ClassBreaksRenderer, UniqueValueRenderer, SimpleRenderer, SimpleLineSymbol, Color) {
  
  class RendererCollection {
    constructor(data) {
      this.main        = {
        "name": data.main.legendTitle,
        "renderer": createRenderer(data.main),
        "labelExpressionInfo": data.main.labelExpressionInfo,
        "title": data.main.legendTitle
      };
      this.compare_abs = {
        "name": data.compare_abs.legendTitle,
        "renderer": createRenderer(data.compare_abs) ,
        "labelExpressionInfo": data.compare_abs.labelExpressionInfo,
        "title": data.compare_abs.legendTitle
      };
      if (data.compare_pct) {
        this.compare_pct = {
            "name": data.compare_pct.legendTitle, 
            "renderer": createRenderer(data.compare_pct), 
            "labelExpressionInfo": data.compare_pct.labelExpressionInfo,
            "title": data.compare_pct.legendTitle
        };
      } else {
        console.warn("data.compare_pct is undefined or null");
      }
      if (data.main_divide_by) {
        if (!this.main_divide_by) {
          this.main_divide_by = {};  // Initialize as an empty object if not already initialized
        }
        if (Array.isArray(data.main_divide_by)) {
          for (const main_divide_by of data.main_divide_by) {
            this.main_divide_by[main_divide_by.divider] = {
              name: main_divide_by.legendTitle,
              renderer: createRenderer(main_divide_by),
              labelExpressionInfo: main_divide_by.labelExpressionInfo,
              title: main_divide_by.legendTitle
            };
          }
        } else {
          console.warn("data.main_divide_by is not an array or is undefined");
        }
      } else {
        console.warn("data.main_divide_by is undefined or null");
      }
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
    } else if (data.simpleRenderer) {
      const renderer = new SimpleRenderer(data.simpleRenderer);
      // Add legend options
      if (renderer.visualVariables) {
        if (data.legendTitle) {
          renderer.visualVariables.legendOptions = {
            title: data.legendTitle
          };
        } 
      } else {
        if (data.legendTitle) {
          renderer.legendOptions = {
            title: data.legendTitle
          };
        } 
      }
      return renderer;
    }
    return null;  // Or however you wish to handle a case where neither condition is true.
  }
  
  // Export RendererCollection to the global scope
  // Exporting to Global Scope (Not recommended but works): If you want to make the RendererCollection class globally accessible (not a good practice but will solve the immediate issue):
  window.RendererCollection = RendererCollection;

});