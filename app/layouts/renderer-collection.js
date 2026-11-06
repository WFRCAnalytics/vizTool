require([
  "esri/renderers/ClassBreaksRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/SimpleLineSymbol",
  "esri/Color",
], function (ClassBreaksRenderer, UniqueValueRenderer, SimpleRenderer, SimpleLineSymbol, Color) {
  
  class RendererCollection {
    // alias: the owning attribute's plain name (config/attributes.json "alias") - used as the
    // legend heading for every renderer variant (main/compare_abs/compare_pct/main_divide_by)
    // instead of each variant's own hand-written "legendTitle", so the legend always just says
    // e.g. "Volume" rather than a longer custom phrase that can drift from the attribute list.
    constructor(data, alias) {
      this.main        = {
        "name": alias,
        "renderer": createRenderer(data.main, alias),
        "labelExpressionInfo": data.main.labelExpressionInfo,
        "title": alias
      };
      this.compare_abs = {
        "name": alias,
        "renderer": createRenderer(data.compare_abs, alias) ,
        "labelExpressionInfo": data.compare_abs.labelExpressionInfo,
        "title": alias
      };
      if (data.compare_pct) {
        this.compare_pct = {
            "name": alias,
            "renderer": createRenderer(data.compare_pct, alias),
            "labelExpressionInfo": data.compare_pct.labelExpressionInfo,
            "title": alias
        };
      } else {
        console.warn("data.compare_pct is undefined or null");
      }
      if (data.main_divide_by) {
        if (!this.main_divide_by) {
          this.main_divide_by = {};  // Initialize as an empty object if not already initialized
        }
        if (Array.isArray(data.main_divide_by)) {
          data.main_divide_by.forEach((main_divide_by) => {
            this.main_divide_by[main_divide_by.divider] = {
              name: alias,
              renderer: createRenderer(main_divide_by, alias),
              labelExpressionInfo: main_divide_by.labelExpressionInfo,
              title: alias
            };
          });
        } else {
          console.warn("data.main_divide_by is not an array or is undefined");
        }
      }
    }
  }

  function createRenderer(data, alias) {
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
          title: alias
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
          title: alias
        };
      }
      return renderer;
    } else if (data.simpleRenderer) {
      const renderer = new SimpleRenderer(data.simpleRenderer);
      // Add legend options
      if (renderer.visualVariables) {
        // If visualVariables is an array, loop through all elements
        renderer.visualVariables.forEach((visualVariable) => {
          visualVariable.field = "dVal";
          if (visualVariable.legendTitle) {
            visualVariable.legendOptions = {
              title: alias,
            };
          }
        });
      } else {
        if (data.legendTitle) {
          renderer.field = "dVal";
          renderer.legendOptions = {
            title: alias
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