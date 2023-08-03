var dModeOptions = [
  { label: "Local Bus"        , name: "lcl" , value: "4", hierarchyoptions:[4,5,6,7,8,9]},
  { label: "Core Route"       , name: "brt5", value: "5", hierarchyoptions:[  5,6,7,8,9]},
  { label: "Express Bus"      , name: "exp" , value: "6", hierarchyoptions:[4,5,6,7,8,9]},
  { label: "Bus Rapid Transit", name: "brt9", value: "9", hierarchyoptions:[4,5,6,7,8,9]},
  { label: "Light Rail"       , name: "lrt" , value: "7", hierarchyoptions:[      7,8,9]},
  { label: "Commuter Rail"    , name: "crt" , value: "8", hierarchyoptions:[        8  ]}
];
var curMode   = [4,5,6,7,8,9]; //T is total
var curHModes = [4,5,6,7,8,9];


var dTimeOfDayOptions = [
  { label: "Peak"    , value: "PK"},
  { label: "Off-Peak", value: "OK"}
];
var curTimeOfDay = ['PK','OK'];

var iFirst=true;

var dAccessModeOptions = [
  { label: "Walk Boardings"    , value: "wb"},
  { label: "Drive Boardings"   , value: "db"},
  { label: "Alightings"        , value: "x" }
];
var curAccessMode = ['wb','db'];

var dTripOrientationOptions = [
  {value: "OD", label:"Origin-Destination"   },
  {value: "PA", label:"Production-Attraction"}
];
var curTripOrientation = "OD";

var dInboundOutboundOptions = [
  {value: "IB", label:"Inbound" },
  {value: "OB", label:"Outbound"}
];
var curInboundOutbound = ['IB','OB'];

var curRoute = [];
var dDisplayOptions = [
  {value: "RTE", label:"Routes"      },
  {value: "RDR", label:"Riders"      },
  {value: "BRD", label:"Boardings"   },
  {value: "SPD", label:"Speed"       },
  {value: "HDW", label:"Headway"     }
];
var curDisplay = "RDR";


var dRadioButtonGroups = [
  { title: "Trip Orientation" , htmldivname: "divTripOrientationOptions"  , contents: dTripOrientationOptions , curVarName: "curTripOrientation"},
  { title: "Display"          , htmldivname: "divDisplayOptions"          , contents: dDisplayOptions         , curVarName: "curDisplay"        }
];


var minScaleForLabels = 87804;
var labelClassOn;
var labelClassOff;
var sCWhite = "#FFFFFF";
var dHaloSize = 2.0;

var bindata;

var tttT;

var iPixelSelectionTolerance = 5;

var renderer_Riders;
var renderer_Riders_Change;

var mltRoute;

define(['dojo/_base/declare',
    'jimu/BaseWidget',
    'jimu/LayerInfos/LayerInfos',
    'dijit/registry',
    'dojo/dom',
    'dojo/dom-style',
    'dijit/dijit',
    'dojox/charting/Chart',
    'dojox/charting/themes/Julie',
    'dojox/charting/themes/Claro',
    'dojox/charting/SimpleTheme',
    'dojox/charting/plot2d/Scatter',
    'dojox/charting/plot2d/Markers',
    'dojox/charting/plot2d/Columns',
    'dojox/charting/widget/Legend',
    'dojox/charting/action2d/Tooltip',
    'dojox/layout/TableContainer',
    'dojox/layout/ScrollPane',
    'dijit/layout/ContentPane',
    'jimu/PanelManager',
    'dijit/form/TextBox',
    'dijit/form/ToggleButton',
    'jimu/LayerInfos/LayerInfos',
    'esri/tasks/query',
    'esri/tasks/QueryTask',
    'esri/layers/FeatureLayer',
    'esri/dijit/FeatureTable',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/TextSymbol',
    'esri/symbols/Font',
    'esri/layers/LabelClass',
    'esri/InfoTemplate',
    'esri/Color',
    'esri/map',
    'esri/renderers/ClassBreaksRenderer',
    'esri/geometry/Point',
    'esri/geometry/Extent',
    'esri/graphic',
    'dojo/store/Memory',
    'dojox/charting/StoreSeries',
    'dijit/Dialog',
    'dijit/form/Button',
    'dijit/form/RadioButton',
    'dijit/form/MultiSelect',
    'dojox/form/CheckedMultiSelect',
    'dijit/form/Select',
    'dijit/form/ComboBox',
    'dijit/form/CheckBox',
    'dojo/store/Observable',
    'dojox/charting/axis2d/Default',
    'dojo/domReady!'],
function(declare, BaseWidget, LayerInfos, registry, dom, domStyle, dijit, Chart, Julie, Claro, SimpleTheme, Scatter, Markers, Columns, Legend, Tooltip, TableContainer, ScrollPane, ContentPane, PanelManager, TextBox, ToggleButton, LayerInfos, Query, QueryTask, FeatureLayer, FeatureTable, SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol, TextSymbol, Font, LabelClass, InfoTemplate, Color, Map, ClassBreaksRenderer, Point, Extent, Graphic, Memory, StoreSeries, Dialog, Button, RadioButton, MutliSelect, CheckedMultiSelect, Select, ComboBox, CheckBox, Observable) {
  //To create a widget, you need to derive from BaseWidget.
  
  return declare([BaseWidget], {
    // DemoWidget code goes here

    //please note that this property is be set by the framework when widget is loaded.
    //templateString: template,

    baseClass: 'jimu-widget-demo',

    postCreate: function() {
      this.inherited(arguments);
      console.log('postCreate');
      
      tttT = this;
      
      try {
        dom.byId(tttT.id + "_panel").style.left = '55px'; // NEED TO FIND BETTER PLACE WHERE WIDGET IS CREATED RATHER THAN HERE
      } catch (err) {
        console.log(err.message);
      }
    },

    startup: function() {
      console.log('startup');

      
      this.inherited(arguments);
      this.map.setInfoWindowOnClick(false); // turn off info window (popup) when clicking a feature
      
      //Widen the widget panel to provide more space for charts
      //var panel = this.getPanel();
      //var pos = panel.position;
      //pos.width = 500;
      //panel.setPosition(pos);
      //panel.panelManager.normalizePanel(panel);
      
      var parent = this;

      //when zoom finishes run changeZoom to update label display
      //this.map.on("zoom-end", function (){  
      //  parent.changeZoom();  
      //});  
      tttT._updateRoutesList(curMode);

      cmbMode = new CheckedMultiSelect({
        id: "selectMode",
        options: dModeOptions,
        style: { width: '20px' },
        multiple: true,
        onChange: function(){
          curMode = this.value.map(Number); // change value string array into number array
          console.log('Selected Mode: ' + curMode)
          tttT._updateRoutesList();
          tttT._updateDisplayTransit();
        }
      }, "cmbMode");
      cmbMode.set("value",curMode);
      cmbMode.startup();

      cmbTimeOfDay = new CheckedMultiSelect({
        id: "selectTimeOfDay",
        options: dTimeOfDayOptions,
        multiple: true,
        onChange: function(){
          curTimeOfDay = this.value;
          console.log('Selected TimeOfDay: ' + curTimeOfDay)
          tttT._updateDisplayTransit();
        }
      }, "cmbTimeOfDay");
      cmbTimeOfDay.set("value",curTimeOfDay);
      cmbTimeOfDay.startup();

      //mltTimeOfDay = new CheckedMultiSelect({
      //  id: "selectInboundOutboud",
      //  options: dInboundOutboundOptions,
      //  multiple: true,
      //  onChange: function(){
      //    curInboundOutbound = this.value;
      //    console.log('Selected Inbound/Outbound: ' + curInboundOutbound)
      //    tttT._updateDisplayTransit();
      //  }
      //}, "divInboundOutBoundOptions");
      //mltTimeOfDay.set("value",curInboundOutbound);
      //mltTimeOfDay.startup();

      cmbAccessMode = new CheckedMultiSelect({
        id: "selectAccessMode",
        options: dAccessModeOptions,
        multiple: true,
        style: {height: '32px;'},
        onChange: function(){
          curAccessMode = this.value;
          console.log('Selected Access Mode: ' + curAccessMode)
          tttT._updateDisplayTransit();
        }
      }, "cmbAccessMode");
      cmbAccessMode.set("value",curAccessMode);
      cmbAccessMode.startup();

      mltHeirarchicalMode = new CheckedMultiSelect({
        id: "selectHeirarchicalMode",
        options: dModeOptions,//.find(x => x.value !== 'T'),
        multiple: true,
        onChange: function(){
          curHModes = this.value.map(Number); // change value string array into number array
          console.log('Selected Heirarchical Modes: ' + curHModes)
          tttT._updateDisplayTransit();
        }
      }, "divHeirarchicalModeOptions");
      mltHeirarchicalMode.set("value",curHModes);
      mltHeirarchicalMode.startup();

      // setup radio button groups
      for (rbg in dRadioButtonGroups) {

        var sDivName = dRadioButtonGroups[rbg].htmldivname;

        var _divRBDiv = dom.byId(sDivName);
        var _divRBDiv_title = dom.byId(sDivName + '_title');
        
        dojo.place('<div class="cmbtitle">' + dRadioButtonGroups[rbg].title + ':</div>', _divRBDiv_title);

        for (d in dRadioButtonGroups[rbg].contents) {

          var sValue = dRadioButtonGroups[rbg].contents[d].value;
          var sLabel = dRadioButtonGroups[rbg].contents[d].label;
      
          // define if this is the radio button that should be selected
          const _curVarName  = dRadioButtonGroups.find(x => x.htmldivname === sDivName).curVarName;
                    if (dRadioButtonGroups[rbg].contents[d].value == window[_curVarName]) {
            var bChecked = true;
          } else {
            var bChecked = false;
          }
          
          // radio button id
          _rbID = "rb_" + sDivName + "_" + sValue; // value for future lookup will be after 3rd item in '_' list
  
          // radio button object
          var _rbRB = new RadioButton({ name:sDivName, label:sLabel, id:_rbID, value: sValue, checked: bChecked});
          _rbRB.startup();
          _rbRB.placeAt(_divRBDiv);
  
          // radio button label
          var _lblRB = dojo.create('label', {
            innerHTML: sLabel,
            for: _rbID,
            id: _rbID + '_label'
          }, _divRBDiv);
          
          // place radio button
          dojo.place("<br/>", _divRBDiv);
      
          // Radio Buttons Change Event
          dom.byId(_rbID).onchange = function(isChecked) {
            console.log(sDivName + " radio button onchange");
            if(isChecked) {
              console.log(this.name)
              var _divname = this.name
              const _varName  = dRadioButtonGroups.find(x => x.htmldivname === _divname).curVarName;
              window[_varName] = this.value;
              tttT._updateDisplayTransit();
            }
          }
        }
        
        // Check box change events
        dom.byId("chkLabels").onchange = function(isChecked) {
          tttT._updateDisplayTransit();
        };
      }

      //setup click functionality
      //this.map.on('click', selectTAZ);

      function pointToExtent(map, point, toleranceInPixel) {  
        var pixelWidth = parent.map.extent.getWidth() / parent.map.width;  
        var toleranceInMapCoords = toleranceInPixel * pixelWidth;  
        return new Extent(point.x - toleranceInMapCoords,  
          point.y - toleranceInMapCoords,  
          point.x + toleranceInMapCoords,  
          point.y + toleranceInMapCoords,  
          parent.map.spatialReference);  
      }
      
      //Setup Function for Selecting Features
      
      function selectTAZ(evt) {
        console.log('selectFeatures');
          
          var query = new Query();  
          query.geometry = pointToExtent(parent.map, evt.mapPoint, iPixelSelectionTolerance);
          query.returnGeometry = false;
          query.outFields = ["*"];
          
          var tblqueryTaskTAZ = new QueryTask(lyrDispLayers[parent.getCurDispLayerLoc()].url);
          tblqueryTaskTAZ.execute(query,showTAZResults);
          
          //Segment search results
          function showTAZResults (results) {
            console.log('showTAZResults');
        
            var resultCount = results.features.length;
            if (resultCount>0) {
              //use first feature only
              var featureAttributes = results.features[0].attributes;
          }
        }
      }
      
      var aBrk_Riders_Absolute = new Array(
        {minValue:        1, maxValue:      249, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[0]), 0.50), label:   "Less than 250 Riders"},
        {minValue:      250, maxValue:      499, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[1]), 1.25), label:      "250 to 500 Riders"},
        {minValue:      500, maxValue:      999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[2]), 2.00), label:    "500 to 1,000 Riders"},
        {minValue:     1000, maxValue:     1999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[3]), 2.75), label:  "1,000 to 2,000 Riders"},
        {minValue:     2000, maxValue:     2999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[4]), 3.50), label:  "2,000 to 3,000 Riders"},
        {minValue:     3000, maxValue:     4999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[5]), 4.25), label:  "3,000 to 5,000 Riders"},
        {minValue:     5000, maxValue:     9999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[6]), 5.00), label: "5,000 to 10,000 Riders"},
        {minValue:    10000, maxValue:    14999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[7]), 5.75), label:"10,000 to 15,000 Riders"},
        {minValue:    15000, maxValue: Infinity, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(bertColorData[8]), 7.50), label:"More than 15,000 Riders"}
      );
      renderer_Riders = new ClassBreaksRenderer(null, 'DispValue');
      for (var j=0;j<aBrk_Riders_Absolute.length;j++) {
        renderer_Riders.addBreak(aBrk_Riders_Absolute[j]);
      }

      //Riders Change Renderers
      var aBrk_Riders_Change = new Array(
        {minValue: -10000000, maxValue:   -10001, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[0]), 5.0000), label: "Less than -10,000 Riders"},
        {minValue:    -10000, maxValue:    -2501, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[1]), 3.7500), label: "-10,000 to -2,500 Riders"},
        {minValue:     -2500, maxValue:    -1001, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[2]), 2.5000), label:  "-2,500 to -1,000 Riders"},
        {minValue:     -1000, maxValue:     -100, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[3]), 1.2500), label:    "-1,000 to -100 Riders"},
        {minValue:      -100, maxValue:      100, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[4]), 0.6250), label:      "-100 to +100 Riders"},
        {minValue:       100, maxValue:     1000, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[5]), 1.2500), label:      "100 to 1,000 Riders"},
        {minValue:      2500, maxValue:     4999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[6]), 2.5000), label:    "2,500 to 5,000 Riders"},
        {minValue:      5000, maxValue:     9999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[7]), 3.7500), label:   "5,000 to 10,000 Riders"},
        {minValue:     10000, maxValue:    24999, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex(aCR_Change9[8]), 5.0000), label:  "10,000 to 25,000 Riders"},
        {minValue:     25000, maxValue: Infinity, symbol: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex("#000000"), 7.0000), label:  "More than 25,000 Riders"}
      );
      renderer_Riders_Change = new ClassBreaksRenderer(null, 'DispValue');
      for (var j=0;j<aBrk_Riders_Change.length;j++) {
        renderer_Riders_Change.addBreak(aBrk_Riders_Change[j]);
      }

            
      //Riders Absolute Renderers
      var aBrk_BoardAlight_Absolute = new Array(
        {minValue:        1, maxValue:       25, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  3.25, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[0]), label:  "Less than 25 Boardings/Alightings"},
        {minValue:       25, maxValue:      100, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  5.00, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[1]), label:      "25 to 50 Boardings/Alightings"},
        {minValue:      100, maxValue:      250, symsbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  6.00, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[2]), label:    "50 to 1,00 Boardings/Alightings"},
        {minValue:      250, maxValue:      500, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  7.50, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[3]), label:    "100 to 200 Boardings/Alightings"},
        {minValue:      500, maxValue:     1000, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  8.25, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[4]), label:    "200 to 300 Boardings/Alightings"},
        {minValue:     1000, maxValue:     2500, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  9.50, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[5]), label:    "300 to 500 Boardings/Alightings"},
        {minValue:     2500, maxValue:     5000, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 11.00, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[6]), label:   "500 to 1000 Boardings/Alightings"},
        {minValue:     5000, maxValue:    10000, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 12.55, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[7]), label:  "1000 to 1500 Boardings/Alightings"},
        {minValue:    10000, maxValue: Infinity, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 14.00, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), bertColorData[8]), label:"More than 1500 Boardings/Alightings"}
      );
      renderer_BoardAlight = new ClassBreaksRenderer(null, 'DispValue');
      for (var j=0;j<aBrk_BoardAlight_Absolute.length;j++) {
        renderer_BoardAlight.addBreak(aBrk_BoardAlight_Absolute[j]);
      }

      //Riders Change Renderers
      var aBrk_BoardAlight_Change = new Array(
        {minValue: -1000000, maxValue:  -10000, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 10.0000, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[0]), label:  "Less than 25 Boardings/Alightings"},
        {minValue:    -2500, maxValue:   -1000, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  8.7500, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[1]), label:      "25 to 50 Boardings/Alightings"},
        {minValue:    -1000, maxValue:    -500, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  6.5000, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[2]), label:    "50 to 1,00 Boardings/Alightings"},
        {minValue:     -500, maxValue:    -100, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  4.2500, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[3]), label:    "100 to 200 Boardings/Alightings"},
        {minValue:     -100, maxValue:     100, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  2.6250, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[4]), label:    "200 to 300 Boardings/Alightings"},
        {minValue:      100, maxValue:     500, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  4.2500, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[5]), label:    "300 to 500 Boardings/Alightings"},
        {minValue:      500, maxValue:    1000, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  6.5000, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[6]), label:   "500 to 1000 Boardings/Alightings"},
        {minValue:     1000, maxValue:    2500, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE,  8.7500, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[7]), label:  "1000 to 1500 Boardings/Alightings"},
        {minValue:     2500, maxValue:Infinity, symbol: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 10.0000, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 0.2), aCR_Change9[8]), label:"More than 1500 Boardings/Alightings"}
      );
      renderer_BoardAlight_Change = new ClassBreaksRenderer(null, 'DispValue');
      for (var j=0;j<aBrk_BoardAlight_Change.length;j++) {
        renderer_BoardAlight_Change.addBreak(aBrk_BoardAlight_Change[j]);
      }

      tttT._updateDisplayTransit();

    },
    
    _updateRoutesList: function() {

      // initialize curRoute
      curRoute = [];

      // check if data object populated
      if (typeof dataTransitRouteNames !== "undefined") {
        
        // get data objects that match mode, sort alphabetically
        _routes = dataTransitRouteNames.filter(o =>curMode.includes(o.mode)).sort((a, b) => a.label.localeCompare(b.label))
        
        // set all routes on by default
        curRoute = _routes.map(o => o.value);

        // create
        if (iFirst) {
          mltRoute = new CheckedMultiSelect({
            id: "selectRoutes",
            options: _routes,
            multiple: true,
            sortByLabel: false, // Need this to override sort
            style: {width: '150px'},
            overflow: 'hidden',
            class: "claro",
            onChange: function(){
              curRoute = this.value;
              console.log('curRoute is ' + curRoute);
              tttT._updateDisplayTransit();
            }
          }, "divRouteSelection");
          mltRoute.startup();
          iFirst = false;
        } else {
          mltRoute.set('options', _routes);
          mltRoute.startup();
        }
        mltRoute.set('value',curRoute);
      }

    },

    // UDPATE FOR THIS APP:
    _updateHModes: function() {

    },

    //_getCurModeAsArray() {
    //  if (curMode=='T') {
    //    _filterModes = [4,5,6,7,8,9]
    //  } else {
    //    _filterModes = [];
    //    _filterModes.push(Number(curMode));
    //  }
    //  return _filterModes;
    //},

    _updateDisplayTransit: function() {
      console.log('updateDisplay Transit Display');

      // clear all graphics
      tttT.map.graphics.clear();

      if (curScenarioComp=='none') {
        switch (curDisplay) {
          case ('RDR'):
            _renderer_transit = renderer_Riders;
            break;
          case ('BRD'):
            _renderer_transit = renderer_BoardAlight;
            break;
        }
      } else {
        switch (curDisplay) {
          case ('RDR'):
            _renderer_transit = renderer_Riders_Change;
            break;
          case ('BRD'):
            _renderer_transit = renderer_BoardAlight_Change;
            break;
        }
      }

      if (curDisplay=='RDR' && curTripOrientation=='OD') {
        tttT._queryFeaturesRidersOD();
      } else if (curDisplay=='RDR' && curTripOrientation=='PA') {
        tttT._queryFeatures(lyrTransitLink, "linkid", dataTransitPALinkMain, dataTransitPALinkComp,  'lid' ,'r'       );
      } else if (curDisplay=='BRD' && curTripOrientation=='PA') {
        tttT._queryFeatures(lyrTransitNode, "n"     , dataTransitPANodeMain, dataTransitPANodeComp,"nid",curAccessMode);
      }     
    },

    _queryFeatures: function(_lyrDisplay,_layeridfield,_dataMain,_dataComp,_dataidfield,_dispFields){ 
      
      var query, updateFeature;
      query = new Query();
      query.outFields = [_layeridfield];
      query.returnGeometry = true;
      query.where = "1=1"; // query all segments
      
      _lyrDisplay.queryFeatures(query,function(featureSet) {
        //Update values
        var resultCount = featureSet.features.length;

        // exit if no results
        if (resultCount==0) {
          return;
        }

        // main query
        try {
          _dataMainFiltered = _dataMain.data.filter(o => curRoute    .includes(o['nm' ]) &&
                                                         curTimeOfDay.includes(o['tod']) &&
                                                         curMode     .includes(o['md' ]) &&
//                                                       curInboundOutbound   .includes(o['io' ]) &&
                                                         curHModes   .includes(o['hmd']));
        } catch(err) {
          _dataMainFiltered =[];
          console.log('Error in Scenario Data Filter');
        }

        if (curScenarioComp!='none') {
          try {
            _dataCompFiltered = _dataComp.data.filter(o => curRoute    .includes(o['nm' ]) &&
                                                           curTimeOfDay.includes(o['tod']) &&
                                                           curMode     .includes(o['md' ]) &&
//                                                         curInboundOutbound   .includes(o['io' ]) &&
                                                           curHModes   .includes(o['hmd']));
          } catch(err) {
            _dataCompFiltered =[];
            console.log('Error in Compare Scenario Data Filter');
          }
        }

        for (var i = 0; i < resultCount; i++) {
          updateFeature = featureSet.features[i];
          _id = updateFeature.attributes[_layeridfield]
          _segid = updateFeature.attributes['SEGID']

          _mainValue = 0;
          _compValue = 0;
          _dispValue = 0;
          try {
            _data = _dataMainFiltered.filter(o => o[_dataidfield] === _id);
            for (_d in _data) {
              for (_df in _dispFields) {
                _mainValue += _data[_d][_dispFields[_df]]
              }
            }

            if (curScenarioComp!='none') {
              try {
                _data = _dataCompFiltered.filter(o => o[_dataidfield] === _id);
                for (_d in _data) {
                  for (_df in _dispFields) {
                    _compValue += _data[_d][_dispFields[_df]]
                  }
                }

                if (curPCOption=='Abs') {
                  _dispValue = _mainValue - _compValue;

                } else{
                  if (_compValue >0) _dispValue = ((_compValue - _compValue) / _compValue) * 100;
                }

              } catch(err) {
                _dispValue = _mainValue;
              }
            } else {
              _dispValue = _mainValue;
            }
            
            if (_mainValue>0 || _compValue>0) {
              updateFeature.attributes['DispValue'] = _dispValue;
              
            } else {
              updateFeature.attributes['DispValue'] = null;
            }

            tttT.map.graphics.add(updateFeature);

            // check if labels is checked and if it is, place label values at label locations
            if (dom.byId("chkLabels").checked == true) {
              // get coordinates from json file
              var _x = (curDisplay == 'RDR') ? link_labelpoints.find(o => o.lid === _id).Lon : node_labelpoints.find(o => o.nid === _id).Lon;
              var _y = (curDisplay == 'RDR') ? link_labelpoints.find(o => o.lid === _id).Lat : node_labelpoints.find(o => o.nid === _id).Lat;
              
              _pnt = new Point(new esri.geometry.Point(_x, _y, map.spatialReference));
              var _font  = new Font();
              _font.setSize       ("6pt");
              _font.setWeight     (Font.WEIGHT_BOLDER);
              
              var _txtSym = new TextSymbol(Math.round(_dispValue));

              _txtSym.font.setSize("7pt");
              _txtSym.font.setFamily("arial");
              _txtSym.font.setWeight(Font.WEIGHT_BOLDER);
              _txtSym.setHaloColor( new dojo.Color([255,255,255]) );
              _txtSym.setHaloSize(2);
              //txtSym.setAlign    (esri.symbol.txtSym.ALIGN_START);
              var _lblGra = new Graphic(_pnt, _txtSym);
              tttT.map.graphics.add(_lblGra);
            }

          } catch(err) {
            updateFeature.attributes['DispValue'] = null;
          }
        }

        _lyrDisplay.setRenderer(_renderer_transit);
        _lyrDisplay.show();

        tttT.map.graphics.setRenderer(_renderer_transit);
        tttT.map.graphics.refresh();

        
      });

      //lyrSegments.show();

    },
    
    _selectAllRoutes: function(){
      console.log('_selectAllRoutes');
      
      var btnSelectAll = dom.byId("buttonSelectAll");
      console.log(btnSelectAll.innerHTML);
      
      if (btnSelectAll.innerHTML == "Select All") {
        curRoute = mltRoute.options.map(o => o.value)
        btnSelectAll.innerHTML = "Unselect All";
      } else if (btnSelectAll.innerHTML == "Unselect All") {
        curRoute = [];
        btnSelectAll.innerHTML = "Select All";
      }
      mltRoute.set("value", curRoute);
      mltRoute.startup();
    },

    _queryFeaturesRidersOD: function() { 
      var query, updateFeature;
      query = new Query();
      query.outFields = ["*"];
      query.returnGeometry = false;
      query.where = "1=1";
      
      lyrSegments.queryFeatures(query,function(featureSet) {
        //Update values
        var resultCount = featureSet.features.length;
        for (var i = 0; i < resultCount; i++) {
          updateFeature = featureSet.features[i];
          _segid = updateFeature.attributes['SEGID']
          //_mode = updateFeature.attributes['MODE']
          //_route = updateFeature.attributes['NAME']
          //A: SEGID
          //I: DY_VOL_2WY

          var _mainValue = 0;
          var _compValue = 0;
          var _dispValue = 0;

          if (curRoute != ""){
            try { 
              if (curRoute.length > 1) {
                _mainValue1 = dataTransitRouteMain.filter(o => o.SEGID === _segid && curMode.includes(o.MODE) && curRoute.includes(o.NAME));
                if (_mainValue1.length > 0) {
                  var riders = 0;
                  var routeRiders = 0;
                  for (var j = 0; j < _mainValue1.length; j++){
                    var routeRiders = _mainValue1[j].SEGVOL;
                    riders += routeRiders;
                  }
                  _mainValue = riders;
                } else {
                  _mainValue = 0;
                }
              }
              if (curScenarioComp!='none') {
                try {
                  _compValue1 = dataTransitRouteComp.filter(o => o.SEGID === _segid && curMode.includes(o.MODE) && curRoute.includes(o.NAME));
                  if (_compValue1.length > 0) {
                    var riders = 0;
                    var routeRiders = 0;
                    for (var j = 0; j < _compValue1.length; j++){
                      var routeRiders = _compValue1[j].SEGVOL;
                      riders += routeRiders;
                    }
                    _compValue = riders;
                  } else {
                    _compValue = 0;
                  }
                  if (curPCOption=='Abs') {
                    _dispValue = _mainValue - _compValue;
                  } else {
                    if (_compValue >0) _dispValue = ((_compValue - _compValue) / _compValue) * 100;
                  }
                } catch(err){
                  _dispValue = _mainValue;
                }
              } else {
                _dispValue = _mainValue;
              }
              updateFeature.attributes['DispValue'] = _dispValue; 
              tttT.map.graphics.add(updateFeature);

              // check if labels is checked and if it is, place label values at label locations
              if (dom.byId("chkLabels").checked == true) {
                segRDR = ['RDR']
                if (segRDR.includes(curDisplay)){
                  // get coordinates from json file
                  var _x = seg_labelpoints.find(o => o.SEGID === _segid).Lon;
                  var _y = seg_labelpoints.find(o => o.SEGID === _segid).Lat;
                  
                  _pnt = new Point(new esri.geometry.Point(_x, _y, map.spatialReference))
                  var _font  = new Font();
                  _font.setSize       ("6pt");
                  _font.setWeight     (Font.WEIGHT_BOLDER);
                  
                  var _txtSym = new TextSymbol(_dispValue);

                  _txtSym.font.setSize("7pt");
                  _txtSym.font.setFamily("arial");
                  _txtSym.font.setWeight(Font.WEIGHT_BOLDER);
                  _txtSym.setHaloColor( new dojo.Color([255,255,255]) );
                  _txtSym.setHaloSize(2);
                  //txtSym.setAlign    (esri.symbol.txtSym.ALIGN_START);
                  var _lblGra = new Graphic(_pnt, _txtSym);
                  tttT.map.graphics.add(_lblGra);
                }
              }
            }
            catch(err) { 
              updateFeature.attributes['DispValue'] = null;
            }
          }
        }

        lyrSegments.setRenderer(_renderer_transit);
        lyrSegments.show();

        tttT.map.graphics.setRenderer(_renderer_transit);
        tttT.map.graphics.refresh();

        
      });

      //lyrSegments.show();


    },

    numberWithCommas: function(x) {
      return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    onOpen: function(){
      console.log('onOpen');
      tttT._updateDisplayTransit();
      lastOpenedWidget = 'transit';
    },

    onClose: function(){
      //this.ClickClearButton();
      console.log('onClose');
    },

    onMinimize: function(){
      console.log('onMinimize');
    },

    onMaximize: function(){
      console.log('onMaximize');
    },

    onSignIn: function(credential){
      /* jshint unused:false*/
      console.log('onSignIn');
    },

    onSignOut: function(){
      console.log('onSignOut');
    },

    //added from Demo widget Setting.js
    setConfig: function(config){
      //this.textNode.value = config.districtfrom;
    var test = "";
    },

    getConfigFrom: function(){
      //WAB will get config object through this method
      return {
        //districtfrom: this.textNode.value
      };
    },

    //Receiving messages from other widgets
    onReceiveData: function(name, widgetId, data, historyData) {
      //filter out messages
      if(data.message=='transit_zoom'){
        tttT._updateDisplayTransit();
      } else if(data.message=='transit') {
        tttT._updateDisplayTransit();
        tttT._updateRoutesList();
      }
    },


  });
});