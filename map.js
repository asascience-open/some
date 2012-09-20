var map;
var lyrQueryPts;

var proj3857   = new OpenLayers.Projection("EPSG:3857");
var proj900913 = new OpenLayers.Projection("EPSG:900913");
var proj4326   = new OpenLayers.Projection("EPSG:4326");
var mouseoverObs;
var hiliteCtl;
var popupObs;
var popupCtl;
var chartData = [];
var chartUrls = {};
var layerUrls = {};
var logsStore = new Ext.data.ArrayStore({
   fields    : ['type','name','url','t']
  ,listeners : {add : function(store,recs,idx) {
    pendingTransactions[recs[0].get('url')] = true;
  }}
});

var lastMapClick = {
   layer : ''
  ,xy    : ''
};

var pendingTransactions = {};
var viewsReady = 0;

var dNow;
setdNow(new Date());

var logsWin;
var legendImages = {};

var activeSettingsWindows = {};
var activeInfoWindows     = {};

function init() {
  var loadingMask = Ext.get('loading-mask');
  var loading = Ext.get('loading');

  //Hide loading message
  loading.fadeOut({duration : 0.2,remove : true});

  //Hide loading mask
  loadingMask.setOpacity(0.9);
  loadingMask.shift({
     xy       : loading.getXY()
    ,width    : loading.getWidth()
    ,height   : loading.getHeight()
    ,remove   : true
    ,duration : 1
    ,opacity  : 0.1
    ,easing   : 'bounceOut'
  });

  Ext.QuickTips.init();
  refreshTimer();

  var observationsSelModel = new Ext.grid.CheckboxSelectionModel({
     header    : ''
    ,checkOnly : true
    ,listeners : {
      rowselect : function(sm,rowIndex,rec) {
        sosGetCaps(rec.get('url'),rec.get('name'),'observations');
      }
      ,rowdeselect : function(sm,rowIndex,rec) {
        map.getLayersByName(rec.get('name'))[0].setVisibility(false);
      }
    }
  });
  var observationsGridPanel = new Ext.grid.GridPanel({
     id          : 'observationsGridPanel'
    ,store       : new Ext.data.ArrayStore({
      fields : ['name','cswId','abstract','bbox','url','properties']
    })
    ,selModel    : observationsSelModel
    ,loadMask    : true
    ,autoExpandColumn : 'name'
    ,columns     : [
       observationsSelModel
      ,{id : 'name',dataIndex :'name',renderer : renderName}
      ,{id : 'info'                  ,renderer : renderLayerCalloutButton,width : 25}
    ]
    ,hideHeaders : true
    ,listeners   : {viewready : function() {
      viewReady();
    }}
  });

  var modelsSelModel = new Ext.grid.CheckboxSelectionModel({
     header    : ''
    ,checkOnly : true
    ,listeners : {
      rowselect : function(sm,rowIndex,rec) {
        sosGetCaps(rec.get('url'),rec.get('name'),'models');
      }
      ,rowdeselect : function(sm,rowIndex,rec) {
        map.getLayersByName(rec.get('name'))[0].setVisibility(false);
      }
    }
  });
  var modelsGridPanel = new Ext.grid.GridPanel({
     id          : 'modelsGridPanel'
    ,store       : new Ext.data.ArrayStore({
      fields : ['name','cswId','abstract','bbox','url','properties']
    })
    ,selModel    : modelsSelModel
    ,loadMask    : true
    ,autoExpandColumn : 'name'
    ,columns     : [
       modelsSelModel
      ,{id : 'name',dataIndex :'name',renderer : renderName}
      ,{id : 'info'                  ,renderer : renderLayerCalloutButton,width : 25} 
    ]
    ,hideHeaders : true
    ,listeners   : {viewready : function() {
      viewReady();
    }}
  });

  var gridsTreePanel = new Ext.tree.TreePanel({
     id          : 'gridsTreePanel'
    ,rootVisible : false
    ,autoScroll  : true
    ,root        : new Ext.tree.AsyncTreeNode()
    ,loader      : new Ext.tree.TreeLoader({
      directFn : function(nodeId,callback) {
        wmsGetCaps(gridsTreePanel.getNodeById(nodeId),callback);
      }
    })
    ,listeners   : {click : function(node,e) {
      if (node.leaf) {
        var firstStyle     = node.attributes.layer.styles.length > 0 ? node.attributes.layer.styles[0] : false;
        var leg            = firstStyle && firstStyle.legend ? firstStyle.legend.href : false;
        var elevation      = node.attributes.layer.dimensions && node.attributes.layer.dimensions.elevation ? node.attributes.layer.dimensions.elevation.values : false;
        var firstElevation = elevation ? elevation[0] : false;
        if (!leg || leg == '') {
          leg = node.attributes.getMapUrl
            + '&SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=' + node.attributes.version 
            + '&FORMAT=' + (firstStyle ? firstStyle.legend.format  : '')
            + '&STYLES=' + (firstStyle ? firstStyle.name : '')
            + '&LAYER='  + node.attributes.layer.name
            + '&TIME='   + makeTimeParam(dNow)
            + (firstElevation ? '&ELEVATION=' + firstElevation : '');
        }
        var sto = Ext.getCmp('layersGridPanel').getStore();
        if (sto.findExact('name','grid.' + node.attributes.text) >= 0) {
          Ext.Msg.alert('Add layer error',"We're sorry, but " + node.attributes.text + " cannot be added to your map more than once."); 
        }
        else {
          var imageTypes = {};
          for (var i = 0; i < node.attributes.layer.styles.length; i++) {
            imageTypes[node.attributes.layer.styles[i].name.split('_')[0]] = true;
          }
          var imageTypesData = imageTypes ? [] : [['pcolor','pcolor'],['facets','facets'],['contours','contours'],['filledcontours','filledcontours'],['vectors','vectors'],['barbs','barbs']];
          for (var i in imageTypes) {
            imageTypesData.push([i,i]);
          }
          
          sto.add(new sto.recordType({
             name      : 'grid.' + node.attributes.text
            ,url       : node.attributes.getMapUrl
            ,lyr       : node.attributes.layer.name
            ,stl       : (firstStyle ? firstStyle.name : '')
            ,sgl       : true
            ,leg       : leg
            ,varName   : node.attributes.layer.name
            ,varUnits  : 'm'
            ,abstract  : node.attributes.layer.abstract
            ,bbox      : node.attributes.bbox
            ,minT      : node.attributes.minT
            ,maxT      : node.attributes.maxT
            ,ele       : firstElevation
            ,customize : {
               styles       : node.attributes.layer.styles
              ,elevation    : elevation
              ,customStyles : {
                imageType : {
                   position : 0
                  ,data     : imageTypesData
                  ,lbl      : 'Image type'
                  ,tip      : 'This is the type of image to return.'
                  ,anyVal   : false
                }
/*
                ,processingType : {
                   position : 1
                  ,data     : [['average','average'],['maximum','maximum']]
                  ,lbl      : 'Processing type'
                  ,tip      : 'This is the type of processing to do if the request has a time range specified instead of one time.'
                  ,anyVal   : false
                }
*/
                ,colormap : {
                   position : 2
                  ,data     : [['Accent','Accent'],['autumn','autumn'],['Blues','Blues'],['bone','bone'],['BrBG','BrBG'],['BuGn','BuGn'],['BuPu','BuPu'],['cool','cool'],['copper','copper'],['Dark2','Dark2'],['flag','flag'],['gist-earth','gist-earth'],['gist-gray','gist-gray'],['gist-heat','gist-heat'],['gist-ncar','gist-ncar'],['gist-rainbow','gist-rainbow'],['gist-stern','gist-stern'],['gist-yarg','gist-yarg'],['GnBu','GnBu'],['gray','gray'],['Greens','Greens'],['Greys','Greys'],['hot','hot'],['hsv','hsv'],['jet','jet'],['Oranges','Oranges'],['OrRd','OrRd'],['Paired','Paired'],['Pastel1','Pastel1'],['Pastel2','Pastel2'],['pink','pink'],['PiYG','PiYG'],['PRGn','PRGn'],['prism','prism'],['PuBuGn','PuBuGn'],['PuBu','PuBu'],['PuOr','PuOr'],['PuRd','PuRd'],['Purples','Purples'],['RdBu','RdBu'],['RdGy','RdGy'],['RdPu','RdPu'],['RdYlBu','RdYlBu'],['RdYlGn','RdYlGn'],['Reds','Reds'],['Set1','Set1'],['Set2','Set2'],['Set3','Set3'],['Spectral','Spectral'],['spring','spring'],['summer','summer'],['winter','winter'],['YlGnBu','YlGnBu'],['YlGn','YlGn'],['YlOrBr','YlOrBr'],['YlOrRd','YlOrRd']]
                  ,lbl      : 'Colormap'
                  ,tip      : 'This is the colormap to be used.'
                  ,anyVal   : false
                }
                ,colorScalingMin : {
                   position : 3
                  ,data     : [['None','None']]
                  ,lbl      : 'Color scale min*'
                  ,tip      : 'This value is the lower limit or "cmin" and should be entered as an integer or decimal number. If either cmin or cmax are listed as None then the colormap will autoscale to the available data.'
                  ,anyVal   : true
                }
                ,colorScalingMax : {
                   position : 4
                  ,data     : [['None','None']]
                  ,lbl      : 'Color scale max*'
                  ,tip      : 'This value is the upper limit or "cmax" and should be entered as an integer or decimal number. If either cmin or cmax are listed as None then the colormap will autoscale to the available data.'
                  ,anyVal   : true
                }
                ,variablePosition : {
                   position : 5
                  ,data     : [['cell','cell'],['node','node']]
                  ,lbl      : 'Variable position'
                  ,tip      : 'This value specifies whether the variable input in LAYERS parameter is in the middle of an unstructured cell or if it is on the node/vertex.'
                  ,anyVal   : false
                }
                ,scaling : {
                   position : 6
                  ,data     : [['True','True'],['False','False']]
                  ,lbl      : 'Scaling*'
                  ,tip      : 'This is a case-sensitive boolean to say whether or not the absolute value (magnitude) or the actual value should be taken if only one variable is specified in LAYERS=. For instance LAYERS=u will return positive and negative values if the value is set to False, but if it set to True, the magnitude of u will be returned. In the case of vectors, True = autoscaling of vectors, False means no autoscaling of vectors with default scale. If there is a number in this position, the number is taken as the scale. Start with 2 and adjust from there.'
                  ,anyVal   : true
                }
              }
            }
          }));
          Ext.defer(function() {
            var idx = Ext.getCmp('layersGridPanel').getStore().findExact('name','grid.' + node.attributes.text);
            if (idx >= 0) {
              Ext.getCmp('layersGridPanel').getSelectionModel().selectRow(idx,true);
            }
          },100);
        }
      }
    }}
  });

  var layersSelModel = new Ext.grid.CheckboxSelectionModel({
     header     : ''
    ,checkOnly  : true
    ,listeners  : {
      rowselect : function(sm,rowIndex,rec) {
        addGrid(rec.get('url'),rec.get('lyr'),rec.get('stl'),rec.get('sgl'),rec.get('name'),'grids',rec.get('ele'));
      }
      ,rowdeselect : function(sm,rowIndex,rec) {
        map.getLayersByName(rec.get('name'))[0].setVisibility(false);
      }
    }
  });
  var layersGridPanel = new Ext.grid.GridPanel({
     id          : 'layersGridPanel'
    ,store       : new Ext.data.ArrayStore({
       fields    : ['name','url','lyr','stl','sgl','leg','varName','varUnits','abstract','bbox','minT','maxT','ele','customize']
      ,listeners : {remove : function(sto,rec,idx) {
        var lyr = map.getLayersByName(rec.get('name'))[0];
        if (lyr) {
          map.removeLayer(lyr);
        }
      }}
    })
    ,selModel    : layersSelModel
    ,disableSelection : true
    ,autoExpandColumn : 'name'
    ,columns     : [
       layersSelModel
      ,{id : 'name',dataIndex :'name',renderer : renderName}
      ,{id : 'info'                  ,renderer : renderLayerCalloutButton,width : 25}
    ]
    ,hideHeaders : true
    ,listeners   : {viewready : function() {
    }}
  });

  var legendsGridPanel = new Ext.grid.GridPanel({
     id          : 'legendsGridPanel'
    ,store       : new Ext.data.ArrayStore({
       fields : ['name','displayName','status','timestamp','jsDate']
     })
    ,columns     : [
       {id : 'status',dataIndex : 'status',renderer : renderLayerStatus,width : 30}
      ,{id : 'legend',dataIndex : 'name'  ,renderer : renderLegend}
    ]
    ,autoExpandColumn : 'legend'
    ,hideHeaders      : true
    ,disableSelection : true
  });

  new Ext.Viewport({
     layout : 'border'
    ,items  : [
      {
         region      : 'west'
        ,width       : 275
        ,layout      : 'anchor'
        ,id          : 'catalogPanel'
        ,items       : [
          new Ext.FormPanel({
             title     : 'Catalog query filters'
            ,id        : 'queryFiltersPanel'
            ,height    : 175
            ,border    : false
            ,bodyStyle : 'padding:5px 5px 0'
            ,labelWidth     : 90
            ,labelSeparator : ''
            ,items     : [
              {
                 border : false
                ,cls    : 'directionsPanel'
                ,html   : 'Select a model type, a storm or an event, and a parameter to begin your search.'
              }
              ,new Ext.form.ComboBox({
                store : new Ext.data.ArrayStore({
                   fields : ['id']
                  ,data   : [['Inundation']]
                })
                ,width          : 165
                ,id             : 'modelTypesComboBox'
                ,fieldLabel     : 'Model type'
                ,displayField   : 'id'
                ,valueField     : 'id'
                ,mode           : 'local'
                ,forceSelection : true
                ,triggerAction  : 'all'
                ,editable       : false
                ,value          : 'Inundation'
                ,listeners      : {
                  select : function(combo,rec) {
                    prepAndRunQuery();
                  }
                }
              })
              ,new Ext.form.ComboBox({
                store : new Ext.data.ArrayStore({
                   fields : ['id','eventtime','year']
                  ,data   : [
                     ['Ike'  ,'2008-09-08T00:30:00Z/2008-09-16T00:00:00Z','2008']
                    ,['Isaac','2012-08-30T19:00:00Z/2012-09-04T18:00:00Z','2012']
                  ]
                })
                ,width          : 165
                ,id             : 'eventsComboBox'
                ,fieldLabel     : 'Storm or event'
                ,displayField   : 'id'
                ,valueField     : 'id'
                ,mode           : 'local'
                ,forceSelection : true
                ,triggerAction  : 'all'
                ,editable       : false
                ,value          : 'Isaac'
                ,listeners      : {
                  select : function(combo,rec) {
                    prepAndRunQuery();
                  }
                }
              })
              ,new Ext.form.ComboBox({
                store : new Ext.data.ArrayStore({
                   fields : ['id']
                  ,data   : [['Water level']]
                })
                ,width          : 165
                ,id             : 'parametersComboBox'
                ,fieldLabel     : 'Parameter'
                ,displayField   : 'id'
                ,valueField     : 'id'
                ,mode           : 'local'
                ,forceSelection : true
                ,triggerAction  : 'all'
                ,editable       : false
                ,value          : 'Water level'
                ,listeners      : {
                  select : function(combo,rec) {
                    prepAndRunQuery();
                  }
                }
              })
            ]
            ,tbar        : {items : [
              {
                 text    : 'View transaction logs'
                ,icon    : 'img/file_extension_log.png'
                ,tooltip : 'View transaction logs'
                ,handler : function() {
                  if (!logsWin || !logsWin.isVisible()) {
                    logsWin = new Ext.Window({
                       title  : 'Transaction logs'
                      ,layout : 'fit'
                      ,width  : 640
                      ,height : 480
                      ,constrainHeader : true
                      ,items  : new Ext.grid.GridPanel({
                         store        : logsStore
                        ,loadMask     : true
                        ,border       : false
                        ,enableHdMenu : false
                        ,disableSelection : true
                        ,columns      : [
                           {id : 'type',header : 'Type'              ,dataIndex : 'type'}
                          ,{id : 'name',header : 'Name'              ,dataIndex : 'name'}
                          ,{id : 'url' ,header : 'URL'               ,dataIndex : 'url' ,renderer : renderUrl}
                          ,{id : 't'   ,header : 'Elapsed time (sec)',dataIndex : 't'   ,align    : 'center'}
                        ]
                        ,autoExpandColumn : 'name'
                      })
                      ,tbar : [
                        {
                           text    : 'Clear transactions'
                          ,icon    : 'img/trash-icon.png'
                          ,tooltip : 'Clear transactions'
                          ,handler : function() {
                            logsStore.removeAll();
                            pendingTransactions = {};
                          }
                        }
                      ]
                    });
                    logsWin.show();
                  }
                }
              }
            ]}
          })
          ,{
             title     : 'Catalog query results'
            ,id        : 'queryResultsPanel'
            ,anchor    : '100% -180'
            ,border    : false
            ,bodyStyle : 'padding:5px 5px 0'
            ,layout    : 'fit'
            ,items     : [
              new Ext.TabPanel({
                 activeTab  : 0
                ,plain      : true
                ,resizeTabs : true
                ,tabWidth   : 135
                ,bodyStyle  : 'padding:5px 5px 0'
                ,id         : 'stationGridTabPanel'
                ,deferredRender : false
                ,items          : [
                  {
                     title  : 'Available stations'
                    ,id     : 'stationsTab'
                    ,layout : 'anchor'
                    ,items  : [
                      {
                         border : false
                        ,cls    : 'directionsPanel'
                        ,html   : 'Select models and observations for time series comparisons.  Click here for more information on how this analysis is performed.'
                        ,height : 48
                      }
                      ,new Ext.form.FieldSet({
                         title  : '&nbsp;Model datasets&nbsp;'
                        ,items  : modelsGridPanel
                        ,anchor : ['100%',-180 - (Ext.isIE ? 22 : 0)].join(' ')
                        ,layout : 'fit'
                      })
                      ,new Ext.form.FieldSet({
                         title : '&nbsp;Observation datasets&nbsp;'
                        ,items : observationsGridPanel
                        ,height : 127
                        ,layout : 'fit'
                      })
                    ]
                  }
                  ,{
                     title  : 'Available grids'
                    ,id     : 'gridsTab'
                    ,layout : 'anchor'
                    ,items  : [
                      {
                         border : false
                        ,cls    : 'directionsPanel'
                        ,html   : 'Select gridded datasets for mapping.  Click anywhere on the map to perform a time series extraction.'
                        ,height : 48
                      }
                      ,new Ext.form.FieldSet({
                         title  : '&nbsp;Gridded datasets&nbsp;'
                        ,anchor : ['100%',-292 - (Ext.isIE ? 28 : 0)].join(' ')
                        ,layout : 'fit'
                        ,items  : gridsTreePanel
                      })
                      ,new Ext.form.FieldSet({
                         title  : '&nbsp;Active layers&nbsp;'
                        ,height : 100
                        ,layout : 'fit'
                        ,items  : layersGridPanel
                      })
                      ,new Ext.form.FieldSet({
                         title  : '&nbsp;Active legends&nbsp;'
                        ,height : 100
                        ,layout : 'fit'
                        ,items  : legendsGridPanel
                      })
                    ]
                  }
                ]
              })
            ]
            ,tbar        : {items : [
              {
                 text    : 'Remove all mapped datasets'
                ,icon    : 'img/trash-icon.png'
                ,tooltip : 'Remove all mapped datasets'
                ,id      : 'removeDatasetsButton'
                ,handler : function() {
                  Ext.getCmp('modelsGridPanel').getSelectionModel().clearSelections();
                  Ext.getCmp('observationsGridPanel').getSelectionModel().clearSelections();
                  Ext.getCmp('layersGridPanel').getSelectionModel().clearSelections();
                  Ext.getCmp('layersGridPanel').getStore().removeAll();
                  if (popupObs && popupObs.isVisible()) {
                    popupObs.hide();
                  }
                  var lyr = map.getLayersByName('hiliteMarkers')[0];
                  lyr.removeFeatures(lyr.features);
                  lyr.redraw();
                  lyrQueryPts.removeFeatures(lyrQueryPts.features);
                }
              }
            ]}
          }
        ]
      }
      ,{
         region    : 'center'
        ,layout    : 'border'
        ,border    : false
        ,items     : [
          {
             split     : true
            ,region    : 'center'
            ,id        : 'mapPanel'
            ,html      : '<div id="map"></div>'
            ,bbar      : {items : [
              {
                 xtype     : 'buttongroup'
                ,id        : 'mapTimeButtonGroup'
                ,autoWidth : true
                ,columns   : 1
                ,title     : 'Map date & time'
                ,items     : [{
                   id    : 'mapTime'
                  ,text  : dNow.getUTCFullYear() + '-' + String.leftPad(dNow.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(dNow.getUTCDate(),2,'0') + ' ' + String.leftPad(dNow.getUTCHours(),2,'0') + ':00 UTC'
                  ,width : 135
                }]
              }
              ,{
                 xtype     : 'buttongroup'
                ,id        : 'changeMapDateTimeButtonGroup'
                ,autoWidth : true
                ,columns   : 5
                ,title     : 'Change map date & time'
                ,items     : [
                   {
                     text    : 'Date'
                    ,tooltip : 'Change the map\'s date and time'
                    ,icon    : 'img/calendar_view_day16.png'
                    ,menu    : new Ext.menu.Menu({showSeparator : false,items : [
                      new Ext.DatePicker({
                         value     : new Date(dNow.getTime() + dNow.getTimezoneOffset() * 60000)
                        ,id        : 'datePicker'
                        ,listeners : {
                          select : function(picker,d) {
                            d.setUTCHours(0);
                            d.setUTCMinutes(0);
                            d.setUTCSeconds(0);
                            d.setUTCMilliseconds(0);
                            dNow = d;
                            setMapTime();
                          }
                        }
                      })
                    ]})
                  }
                  ,{
                     text    : '-6h'
                    ,icon    : 'img/ButtonRewind.png'
                    ,handler : function() {dNow = new Date(dNow.getTime() - 6 * 3600000);setMapTime();}
                  }
                  ,{
                     text    : '-1h'
                    ,icon    : 'img/ButtonPlayBack.png'
                    ,handler : function() {dNow = new Date(dNow.getTime() - 1 * 3600000);setMapTime();}
                  }
                  ,{
                     text    : '+1h'
                    ,icon    : 'img/ButtonPlay.png'
                    ,handler : function() {dNow = new Date(dNow.getTime() + 1 * 3600000);setMapTime();}
                  }
                  ,{
                     text    : '+6h'
                    ,icon    : 'img/ButtonForward.png'
                    ,handler : function() {dNow = new Date(dNow.getTime() + 6 * 3600000);setMapTime();}
                  }
                ]
              }
              ,'->'
              ,{
                 xtype     : 'buttongroup'
                ,autoWidth : true
                ,columns   : 2
                ,title     : 'Map options'
                ,items     : [
                  {text : 'Bathymetry',icon : 'img/map16.png',menu : {items : [
                    {
                       text         : 'Hide bathymetry contours'
                      ,checked      : true
                      ,group        : 'bathy'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Bathymetry contours')[0];
                        if (!lyr) {
                          Ext.Msg.alert('Bathymetry contours',"We're sorry, but this layer is not available.");
                        }
                        else {
                          lyr.setVisibility(false);
                        }
                      }
                    }
                    ,{
                       text         : 'Show bathymetry contours'
                      ,checked      : false
                      ,group        : 'bathy'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Bathymetry contours')[0];
                        if (!lyr) {
                          Ext.Msg.alert('Bathymetry contours',"We're sorry, but this layer is not available.");
                        }
                        else {
                          lyr.setVisibility(true);
                        }
                      }
                    }
                  ]}}
                  ,{text : 'Basemap',icon : 'img/world16.png',menu : {items : [
                    {
                       text         : 'Show ESRI Ocean basemap'
                      ,checked      : true
                      ,group        : 'basemap'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('ESRI Ocean')[0];
                        if (lyr.isBaseLayer) {
                          lyr.setOpacity(1);
                          map.setBaseLayer(lyr);
                          lyr.redraw();
                        }
                      }
                    }
                    ,{
                       text         : 'Show Google Hybrid basemap'
                      ,checked      : false
                      ,group        : 'basemap'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Google Hybrid')[0];
                        if (lyr.isBaseLayer) {
                          lyr.setOpacity(1);
                          map.setBaseLayer(lyr);
                          lyr.redraw();
                        }
                      }
                    }
                    ,{
                       text         : 'Show Google Satellite basemap'
                      ,checked      : false
                      ,group        : 'basemap'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Google Satellite')[0];
                        if (lyr.isBaseLayer) {
                          lyr.setOpacity(1);
                          map.setBaseLayer(lyr);
                          lyr.redraw();
                        }
                      }
                    }
                    ,{
                       text         : 'Show Google Terrain basemap'
                      ,checked      : false
                      ,group        : 'basemap'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Google Terrain')[0];
                        if (lyr.isBaseLayer) {
                          lyr.setOpacity(1);
                          map.setBaseLayer(lyr);
                          lyr.redraw();
                        }
                      }
                    }
                  ]}}
                ]
              }
            ]}
            ,listeners : {
              afterrender : function(p) {
                initMap();
              }
              ,bodyresize : function(p,w,h) {
                var el = document.getElementById('map');
                if (el) {
                  el.style.width  = w;
                  el.style.height = h;
                  map.updateSize();
                }
              }
            }
          }
          ,{
             split     : true
            ,id        : 'timeseriesPanel'
            ,title     : 'Time series analysis'
            ,height    : 250
            ,region    : 'south' 
            ,html      : '<div id="chart"></div>'
            ,tbar      : [
              {
                 text    : 'Clear graph'
                ,icon    : 'img/document_empty.png'
                ,tooltip : 'Clear current graph'
                ,handler : function() {
                  chartData = [];
                  Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
                }
              }
              ,{
                 text    : 'Clear sites'
                ,icon    : 'img/draw_eraser.png'
                ,tooltip : 'Clear query sites and highlights'
                ,handler : function() {
                  var lyr = map.getLayersByName('hiliteMarkers')[0];
                  lyr.removeFeatures(lyr.features);
                  lyr.redraw();
                  lyrQueryPts.removeFeatures(lyrQueryPts.features);
                }
              }
              ,{
                 text    : 'Requery'
                ,icon    : 'img/arrow_refresh.png'
                ,tooltip : 'Rerun the query at the current query site'
                ,id      : 'requery'
                ,hidden  : true
                ,handler : function() {
                  if (lyrQueryPts.features.length > 0) {
                    mapClick(lastMapClick['xy'],true,true);
                  }
                }
              }
              ,'->'
              ,'Legend position :'
              ,' '
              ,new Ext.form.ComboBox({
                 store          : new Ext.data.ArrayStore({
                   fields : ['id']
                  ,data   : [
                     ['NE']
                    ,['NW']
                    ,['SE']
                    ,['SW'] 
                    ,['Off']
                  ]
                })
                ,id             : 'legendPositionComboBox'
                ,valueField     : 'id'
                ,displayField   : 'id'
                ,mode           : 'local'
                ,forceSelection : true
                ,triggerAction  : 'all'
                ,editable       : false
                ,value          : 'NE'
                ,width          : 50
                ,listeners      : {select : function(comboBox,rec) {
                  Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
                }}
              })
            ]
            ,listeners : {
              afterrender : function(win) {
                win.addListener('resize',function(win) {
                  var el = document.getElementById('chart');
                  el.style.width  = win.getWidth() - 15;
                  el.style.height = win.getHeight() - 85;
                  if (!chartData || chartData.length <= 0) {
                    el.innerHTML = '<table width="100%" class="directionsPanel"><tr><td style="padding:10px 40px 0px 40px">Begin by selecting values for the catalog query filters.  Then select observation and model datasets to analyze.  Once you see dots on the map, click one, and then click on the parmater link in the popup window.  A time series graph will appear here.</td></tr></table>';
                  }
                  else {
                    var prevPt;
                    $('#chart').bind('plothover',function(event,pos,item) {
                      if (item) {
                        var x = new Date(item.datapoint[0] + new Date().getTimezoneOffset() * 60 * 1000);
                        var y = item.datapoint[1];
                        if (prevPoint != item.dataIndex) {
                          $('#tooltip').remove();
                          showToolTip(item.pageX,item.pageY,item.series.label + '<br/>' + y + ' @ ' + shortMonthDayStringWithTime(x));
                        }
                        prevPoint = item.dataIndex;
                      }
                      else {
                        $('#tooltip').remove();
                        prevPoint = null;
                      }
                    });

                    $.plot(
                     $('#chart')
                      ,chartData
                      ,{
                         xaxis  : {mode : 'time'}
                        ,pan    : {interactive : true}
                        ,grid   : {backgroundColor : {colors : ['#fff','#eee']},borderWidth : 1,borderColor : '#99BBE8',hoverable : true}
                        ,legend : {
                           show           : Ext.getCmp('legendPositionComboBox').getValue() != 'Off'
                          ,position       : Ext.getCmp('legendPositionComboBox').getValue().toLowerCase(),backgroundOpacity : 0.3
                          ,labelFormatter : function(label,series) {
                            var lbl = [label];
                            if (!new RegExp(/^grid\./).test(label)) {
                              lbl.push('<a href="javascript:hilitePoint(' + series.lon + ',' + series.lat + ',\'' + series.color + '\')"><img style="margin-bottom:-3px" title="Hilight this site" src="img/flashlight_shine.png"></a>');
                              lbl.push('<a href="javascript:setCenterOnPoint(' + series.lon + ',' + series.lat + ')"><img style="margin-bottom:-3px" title="Zoom & recenter map to this site" src="img/zoom.png"></a>');
                            }
                            lbl.push('<a href="javascript:removeChartLayer(\'' + series.id + '\')"><img style="margin-bottom:-3px" title="Remove from graph" src="img/delete-round.png"></a>');
                            return lbl.join(' ');
                          }
                        }
                      }
                    );
                  }
                });
              }
            }
          }
        ]
      }
    ]
  });
}

function initMap() {
  OpenLayers.Projection.addTransform("EPSG:4326","EPSG:3857",OpenLayers.Layer.SphericalMercator.projectForward);
  OpenLayers.Projection.addTransform("EPSG:3857","EPSG:4326",OpenLayers.Layer.SphericalMercator.projectInverse);

  lyrQueryPts = new OpenLayers.Layer.Vector(
     'Query points'
    ,{styleMap : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(OpenLayers.Util.applyDefaults({
         externalGraphic : 'img/${img}'
        ,pointRadius     : 10
        ,graphicOpacity  : 1
        ,graphicWidth    : 16
        ,graphicHeight   : 16
      }))
    })}
  );

  map = new OpenLayers.Map('map',{
    layers            : [
      new OpenLayers.Layer.XYZ(
        'ESRI Ocean'
        ,'http://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/${z}/${y}/${x}.jpg'
        ,{
           sphericalMercator : true
          ,isBaseLayer       : true
          ,wrapDateLine      : true
        }
      )
      ,new OpenLayers.Layer.Google('Google Hybrid',{
         type          : google.maps.MapTypeId.HYBRID
        ,projection    : proj900913
        ,opacity       : 1
        ,visibility    : false
        ,minZoomLevel  : 2
      })
      ,new OpenLayers.Layer.Google('Google Satellite',{
         type          : google.maps.MapTypeId.SATELLITE
        ,projection    : proj900913
        ,opacity       : 1
        ,visibility    : false
        ,minZoomLevel  : 2
      })
      ,new OpenLayers.Layer.Google('Google Terrain',{
         type          : google.maps.MapTypeId.TERRAIN
        ,projection    : proj900913
        ,opacity       : 1
        ,visibility    : false
        ,minZoomLevel  : 2
      })
      ,lyrQueryPts
    ]
    ,projection        : proj900913
    ,displayProjection : proj4326
    ,units             : 'm'
    ,maxExtent         : new OpenLayers.Bounds(-20037508,-20037508,20037508,20037508.34)
    ,controls          : [new OpenLayers.Control.Zoom(),new OpenLayers.Control.Attribution()]
  });

  map.addLayer(new OpenLayers.Layer.Vector(
     'hiliteMarkers'
    ,{
      styleMap : new OpenLayers.StyleMap({
        'default' : new OpenLayers.Style(
          {
             pointRadius     : 20
            ,fillColor       : "${fillColor}"
            ,fillOpacity     : 0.7
            ,strokeWidth     : 1
            ,strokeColor     : '#0000ff'
            ,strokeOpacity   : 1
          }
        )
      })
    }
  ));

  addTileCache({
     name       : 'Bathymetry contours'
    ,url        : 'http://assets.maracoos.org/tilecache/'
    ,layer      : 'bathy'
    ,projection : proj900913
    ,visibility : false
  });


  map.setCenter(new OpenLayers.LonLat(-10536302.833765,3885808.4963698),4);

  map.events.register('click',this,function(e) {
    mapClick(e.xy);
  });

  var navToolbarControl = new OpenLayers.Control.NavToolbar();
  map.addControl(navToolbarControl);
  navToolbarControl.controls[0].disableZoomBox();

  map.events.register('addlayer',this,function() {
    map.setLayerIndex(lyrQueryPts,map.layers.length - 1);
  });

  map.events.register('moveend',this,function() {
    if (navToolbarControl.controls[1].active) {
      navToolbarControl.controls[1].deactivate();
      navToolbarControl.controls[0].activate();
      navToolbarControl.draw();
    }
    if (popupObs && !popupObs.isDestroyed) {
      popupObs.show();
    }
  });
}

function renderName(val,metadata,rec) {
  var lab = val.split('.');
  lab.shift();
  metadata.attr = 'ext:qtip="' + lab.join('.') + '"';
  return lab.join('.');
}

function renderLayerCalloutButton(val,metadata,rec) {
  if (rec.get('cswId') || new RegExp(/^grid\./).test(rec.get('name'))) {
    return '<a id="info.' + rec.get('name') + '" href="javascript:goLayerCallout(\'' + rec.get('name')  + '\')"><img title="Layer details and customization" style="margin-top:-2px" src="img/page_go.png"></a>';
  }
  else {
    return '<img title="Layer details and customization not available for this data type" style="margin-top:-2px" src="img/page_go_disabled.png">';
  }
}


function renderUrl(val,metadata,rec) {
  return '<a target=_blank href="' + val + '">' + val + '</a>';
}

function renderLayerStatus(val,metadata,rec) {
  if (val == 'loading') {
    return '<img src="img/loading.gif">';
  }
  else {
    return '<img class="layerIcon" src="img/DEFAULT.drawn.png">';
  }
}

function renderLegend(val,metadata,rec) {
  metadata.attr = 'ext:qtip="' + val.split('.').slice(1) + '"';
  var a = [val.split('.').slice(1)];
  if (rec.get('timestamp') && rec.get('timestamp') != '') {
    a.push(rec.get('timestamp'));
  }
  var gridsSto = Ext.getCmp('layersGridPanel').getStore();
  var gridsRec = gridsSto.getAt(gridsSto.find('name',val));
  if (!legendImages[val]) {
    var img = new Image();
    img.src = gridsRec.get('leg');
    legendImages[val] = img;
  }
  a.push('<img src="' + gridsRec.get('leg') + '">');
  return a.join('<br/>');
}

function sosGetCaps(url,name,type) {

  function sosGetCapsCallback(l,url,type,r) {
    delete pendingTransactions[url];
    var sos = new SOSCapabilities(new OpenLayers.Format.XML().read(r.responseText));
    if (sos.type === 'EXCEPTION') {
      l.events.triggerEvent('loadend');
      Ext.Msg.alert('SOS exception',sos.exception_error);
      return;
    }

    var rec = Ext.getCmp(type + 'GridPanel').getStore().getAt(Ext.getCmp(type + 'GridPanel').getStore().find('name',name));
    var targetProperties = rec.get('properties')[Ext.getCmp('parametersComboBox').getValue()];

    for (var i = 0; i < sos.offerings.length; i++) {
      var properties = getProperties({offering : sos.offerings[i]});
      var plot = false;
      var tp = {};
      for (var p in properties) {
        if (targetProperties) {
          plot = plot || targetProperties.prop == p;
          if (targetProperties.prop == p) {
            tp = {
               prop        : p
              ,getObsExtra : targetProperties.getObsExtra
            };
          }
        }
      }
      if (plot) {
        var f = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(sos.offerings[i].llon,sos.offerings[i].llat).transform(proj4326,map.getProjectionObject()));
        f.attributes = {
           type             : 'sosGetCaps'
          ,offering         : sos.offerings[i]
          ,dataset          : name
          ,targetProperties : tp
        };
        l.addFeatures(f);
      }
    }

    l.events.triggerEvent('loadend');
  }

  var l = map.getLayersByName(name)[0];
  if (!l) {
    var l = new OpenLayers.Layer.Vector(
       name
      ,{
        styleMap : new OpenLayers.StyleMap({
          'default' : new OpenLayers.Style(
            {
               pointRadius     : "${pointRadius}"
              ,fillColor       : "${fillColor}"
              ,fillOpacity     : 0.7
              ,strokeWidth     : 1
              ,strokeColor     : "${strokeColor}"
              ,strokeOpacity   : 1
            }
            ,{
              context          : {
                fillColor : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? '#ffcdff' : '#e8bb99';
                }
                ,strokeColor : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? '#bc00bc' : '#b56529';
                }
                ,pointRadius : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? 4 : 6;
                }
              }
            } 
          )
          ,'temporary' : new OpenLayers.Style(
            {
               pointRadius     : "${pointRadius}"
              ,fillColor       : "${fillColor}"
              ,fillOpacity     : 0.7
              ,strokeWidth     : 1
              ,strokeColor     : "${strokeColor}"
              ,strokeOpacity   : 1
            }
            ,{
              context          : {
                fillColor : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? '#ff7c5d' : '#99BBE8';
                }
                ,strokeColor : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? '#ff0000' : '#1558BB';
                }
                ,pointRadius : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? 4 : 6;
                }
              }
            }
          )
          ,'select' : new OpenLayers.Style(OpenLayers.Util.applyDefaults({
             pointRadius     : 6
            ,fillColor       : '#99e9ae'
            ,fillOpacity     : 0.7
            ,strokeWidth     : 1
            ,strokeColor     : '#1d8538'
            ,strokeOpacity   : 1
          }))
        })
      }
    );
    l.events.register('loadstart',this,function(e) {
      mapLoadstartMask(l.name);
    });
    l.events.register('loadend',this,function(e) {
      mapLoadendUnmask(l.name);
    });
    l.events.register('visibilitychanged',this,function(e) {
      mapLoadendUnmask(l.name);
    });
    map.addLayer(l);
    addToHiliteCtl(l);
    addToPopupCtl(l);

    logsStore.insert(0,new logsStore.recordType({
       type : 'GetCaps'
      ,name : name
      ,url  : url
      ,t    : 0
    }));

    l.events.triggerEvent('loadstart');
    OpenLayers.Request.issue({
       url      : 'get.php?u=' + encodeURIComponent(url)
      ,callback : OpenLayers.Function.bind(sosGetCapsCallback,null,l,url,type)
    });
  }
  else {
    l.setVisibility(true);
  }
}

function getObsCallback(property,name,url,lon,lat,r) {
  delete pendingTransactions[url];
  var sos = new SOSObservation(new OpenLayers.Format.XML().read(r.responseText));
  if (sos.type === 'EXCEPTION') {
    graphLoadendUnmask(url);
    Ext.Msg.alert('SOS exception',sos.exception_error);
    return;
  }

  var definitionToFieldNameAndUOM = {};
  var fieldNameToUOM              = {};
  for (var i = 0; i < sos.fields.length; i++) {
    definitionToFieldNameAndUOM[sos.fields[i].definition] = {
       fieldName : sos.fields[i].name
      ,uom       : sos.fields[i].uom
    };
    fieldNameToUOM[sos.fields[i].name] = {
      uom        : sos.fields[i].uom
    };
  }

  var d = [];
  for (var i = 0; i < sos.observations.length; i++) {
    var t;
    if (sos.observations[i].Time) {
      t = isoDateToDate(sos.observations[i].Time);
    }
    else if (sos.observations[i].time) {
      t = isoDateToDate(sos.observations[i].time);
    }
    if (t) {
      var val;
      if (typeof definitionToFieldNameAndUOM[property] == 'object') {
        val = sos.observations[i][definitionToFieldNameAndUOM[property].fieldName];
      }
      else {
        val = sos.observations[i][property];
      }
      d.push([t.getTime(),val]);
    }
  }

  if (d.length > 0) {
    var uom = '';
    if (typeof definitionToFieldNameAndUOM[property] == 'object') {
      uom = ' (' + definitionToFieldNameAndUOM[property].uom + ')';
    }
    else {
      uom = ' (' + fieldNameToUOM[property].uom + ')';
    }
    chartData.push({
       data  : d
      ,label : property + ' ' + name + uom
      ,lines : {show : true}
      ,lon   : lon
      ,lat   : lat
      ,id    : Ext.id()
    });
  }
  Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));

  graphLoadendUnmask(url);
}

function getObs(layerName,url,property,name,lon,lat,drill,getObsExtra) {
  url += getObsExtra;

  graphLoadstartMask(url);

  logsStore.insert(0,new logsStore.recordType({
     type : 'GetObs'
    ,name : name
    ,url  : url
    ,t    : 0
  }));

  OpenLayers.Request.issue({
     url      : 'get.php?u=' + encodeURIComponent(url)
    ,callback : OpenLayers.Function.bind(getObsCallback,null,property,name,url,lon,lat)
  });

  if (drill) {
    var p0 = new OpenLayers.Geometry.Point(lon,lat).transform(proj4326,map.getProjectionObject());
    for (var i = 0; i < map.layers.length; i++) {
      if (new RegExp(/^(obs|model)\./).test(map.layers[i].name) && map.layers[i].name != layerName && map.layers[i].visibility) {
        var d = null;
        var f = null;
        for (var j = 0; j < map.layers[i].features.length; j++) {
          if (typeof d != 'number' || p0.distanceTo(map.layers[i].features[j].geometry) < d) {
            d = p0.distanceTo(map.layers[i].features[j].geometry);
            f = map.layers[i].features[j];
          }
        }
        if (typeof d == 'number') {
          var properties  = getProperties(f.attributes);
          var getObsFired = false;
          var props       = [];
          for (var p in properties) {
            props.push(p);
            if (p == property || (f.attributes.targetProperties && f.attributes.targetProperties.prop == p)) {
              getObsFired = true;
              getObs(
                 f.layer.name
                ,properties[p]
                ,p
                ,f.attributes.offering.shortName + ' ' + f.attributes.dataset
                ,f.attributes.offering.llon
                ,f.attributes.offering.llat
                ,false
                ,getObsExtra
              );
            }
          }
          if (!getObsFired) {
            props.sort();
            var data = [];
            for (var j = 0; j < props.length; j++) {
              var shortP = props[j].split('/');
              shortP = shortP[shortP.length-1];
              shortP = shortP.substr(0,40) + (shortP.length > 40 ? '...' : '');
              data.push([
                 shortP
                ,props[j]
                ,f.layer.name
                ,properties[props[j]]
                ,f.attributes.offering.shortName
                ,f.attributes.dataset
                ,f.attributes.offering.llon
                ,f.attributes.offering.llat
                ,getObsExtra
              ]);
            }
            new Ext.Window({
               title  : 'Select a variable for comparison'
              ,modal  : true
              ,layout : 'fit'
              ,width  : 275
              ,height : 250
              ,items  : [new Ext.FormPanel({
                 labelWidth : 1
                ,bodyStyle  : 'padding : 5;border-top : 0px;border-left : 0px;border-right : 0px'
                ,items      : [
                   {html : 'We are unable to determine which variable name to use for anlaysis from dataset "' + f.attributes.offering.shortName + ' ' + f.attributes.dataset + '".  Please select from the list below.',border : false}
                  ,{html : '<img src="img/blank.png" height=8>',border : false}
                  ,new Ext.form.FieldSet({title : '&nbsp;Available variables&nbsp;',items : new Ext.form.ComboBox({
                     store          : new Ext.data.ArrayStore({
                       fields : ['short','id','layerName','url','shortName','dataset','llon','llat','getObsExtra']
                      ,data   : data
                    })
                    ,displayField   : 'short'
                    ,valueField     : 'id'
                    ,mode           : 'local'
                    ,forceSelection : true
                    ,triggerAction  : 'all'
                    ,editable       : false
                    ,width          : 210
                  })})
                ]
                ,buttons : [
                  {text : 'Query' ,handler : function() {
                    var combo = this.findParentByType('window').findByType('combo')[0];
                    var sto   = combo.getStore();
                    var idx   = sto.find('id',combo.getValue());
                    if (idx >= 0) {
                      var rec = sto.getAt(idx);
                      getObs(
                         rec.get('layerName')
                        ,rec.get('url')
                        ,rec.get('id')
                        ,rec.get('shortName') + ' ' + rec.get('dataset')
                        ,rec.get('llon')
                        ,rec.get('llat')
                        ,false
                        ,rec.get('getObsExtra')
                      );
                      this.findParentByType('window').close();
                    }
                  }}
                  ,{text : 'Cancel',handler : function() {this.findParentByType('window').close();}}
                ]
              })]
            }).show();
          }
        }
      }
    }
  }
}

function getProperties(attr) {
  var p = {};
  if (!attr.offering) {
    return false;
  }
  attr.offering.properties.sort();
  for (var i = 0; i < attr.offering.properties.length; i++) {
    p[attr.offering.properties[i]] = attr.offering.getObsUrl(attr.offering.properties[i]) + '&eventtime=' + getEventtimeFromEventsComboBox();
  }
  return p;
}

function isoDateToDate(s) {
  // 2010-01-01T00:00:00Z
  s = s.replace("\n",'');
  var p = s.split('T');
  if (p.length == 2) {
    var ymd = p[0].split('-');
    var hm = p[1].split(':');
    return new Date(
       ymd[0]
      ,ymd[1] - 1
      ,ymd[2]
      ,hm[0]
      ,hm[1]
    );
  }
  else {
    return false;
  }
}

function shortDateStringNoTime(d) {
  if (!d) {
    return ' ';
  }
  return (d.getUTCMonth() + 1)
    + '/' + d.getUTCDate()
    + '/' + d.getUTCFullYear();
}

function shortMonthDayStringWithTime(d) {
  if (!d) {
    return ' ';
  }
  return zeroPad((d.getUTCMonth() + 1) * 1,2)
    + '/'
    + zeroPad(d.getUTCDate(),2)
    + ' '
    + zeroPad(d.getUTCHours(),2)
    + ':'
    + zeroPad(d.getUTCMinutes(),2)
    + ' UTC';
}

function shortDateToDate(s) {
  // 10/22/2011 08:00 UTC-04
  var p = s.split(' ');
  var mdy = p[0].split('/');
  var hm = p[1].split(':');
  return new Date(
     mdy[2]
    ,mdy[0] - 1
    ,mdy[1]
    ,hm[0]
    ,hm[1]
  );
}

function refreshTimer() {
  var hits = 0;
  for (i in pendingTransactions) {
    var idx = logsStore.find('url',i);
    if (idx >= 0) {
      var rec = logsStore.getAt(idx);
      rec.set('t',rec.get('t') + 1);
      rec.commit();
      hits++;
    }
  }
  setTimeout('refreshTimer()', 1000);
}

function hilitePoint(lon,lat,color) {
  if (!lon || !lat) {
    return;
  }
  var f = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(lon,lat).transform(proj4326,map.getProjectionObject()));
  f.attributes = {
    fillColor : color
  }
  var lyr = map.getLayersByName('hiliteMarkers')[0];
  lyr.addFeatures(f);
  lyr.redraw();
}

function setCenterOnPoint(lon,lat) {
  if (!lon || !lat) {
    return;
  }
  map.setCenter(new OpenLayers.LonLat(lon,lat).transform(proj4326,map.getProjectionObject()),map.getZoom() > 9 ? map.getZoom() : 9);
}

function removeChartLayer(id) {
  var idx;
  for (var i = 0; i < chartData.length; i++) {
    if (chartData[i].id == id) {
      idx = i;
    }
  }
  if (idx >= 0) {
    chartData.splice(0,1);
    Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
  }
}

function getEventtimeFromEventsComboBox() {
  var rec = Ext.getCmp('eventsComboBox').getStore().getAt(Ext.getCmp('eventsComboBox').getStore().find('id',Ext.getCmp('eventsComboBox').getValue()));
  var eventtime = rec.get('eventtime');
  if (eventtime == 'current') {
    var dNow = new Date();
    dNow.setUTCHours(0);
    dNow.setUTCMinutes(0);
    dNow.setUTCSeconds(0);
    dNow.setUTCMilliseconds(0);
    var dMin = new Date(dNow.getTime() - 12 * 60 * 60 * 1000);
    var dMax = new Date(dNow.getTime() + 24 * 60 * 60 * 1000);
    eventtime = dMin.getUTCFullYear() + '-' + String.leftPad(dMin.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(dMin.getUTCDate(),2,'0') + 'T' + String.leftPad(dMin.getUTCHours(),2,'0') + ':00:00Z'
      + '/'
      + dMax.getUTCFullYear() + '-' + String.leftPad(dMax.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(dMax.getUTCDate(),2,'0') + 'T' + String.leftPad(dMax.getUTCHours(),2,'0') + ':00:00Z';
  }
  return eventtime;
}

function prepAndRunQuery() {
  var selMod = Ext.getCmp('modelsGridPanel').getSelectionModel();
  var selObs = Ext.getCmp('observationsGridPanel').getSelectionModel();
  var selGrd = Ext.getCmp('layersGridPanel').getSelectionModel();

  if (selMod.getSelections().length + selObs.getSelections().length + selGrd.getSelections().length > 0) {
    Ext.MessageBox.confirm('Comfirm map reset','You have changed your filter options; the map must be reset.  Are you sure you wish to continue?',function(but) {
      if (but == 'yes') {
        selMod.clearSelections();
        selObs.clearSelections();
        selGrd.clearSelections();
        runQuery();
        if (popupObs && !popupObs.isDestroyed) {
          popupObs.hide();
        }
      }
    });
  }
  else {
    runQuery();
    var rec = Ext.getCmp('eventsComboBox').getStore().getAt(Ext.getCmp('eventsComboBox').getStore().find('id',Ext.getCmp('eventsComboBox').getValue()));
    addStormTrack(rec.get('id'),rec.get('eventtime'),rec.get('year'));
  }
}

function runQuery() {
  new Ext.data.XmlStore({
    proxy       : new Ext.data.HttpProxy({
       method : 'POST'
      ,url    : 'post.php?ns=csw|gmi|gml|srv|gmd|gco&url=' + encodeURIComponent('http://testbedapps.sura.org/gi-cat/services/cswiso')
    })
    ,record     : 'gmd_MD_Metadata'
    ,autoLoad   : true
    ,fields     : [
       {name : 'title'          ,mapping : 'gmd_identificationInfo > gmd_MD_DataIdentification[id=DataIdentification] > gmd_citation > gmd_CI_Citation > gmd_title > gco_CharacterString'}
      ,{name : 'cswId'          ,mapping : 'gmd_identificationInfo > gmd_MD_DataIdentification[id=DataIdentification] > gmd_citation > gmd_CI_Citation > gmd_identifier > gmd_MD_Identifier > gmd_code > gco_CharacterString'}
      ,{name : 'bboxWest'       ,mapping : 'gmd_identificationInfo > gmd_MD_DataIdentification[id=DataIdentification] > gmd_extent > gmd_EX_Extent > gmd_geographicElement > gmd_EX_GeographicBoundingBox > gmd_westBoundLongitude > gco_Decimal'}
      ,{name : 'bboxEast'       ,mapping : 'gmd_identificationInfo > gmd_MD_DataIdentification[id=DataIdentification] > gmd_extent > gmd_EX_Extent > gmd_geographicElement > gmd_EX_GeographicBoundingBox > gmd_eastBoundLongitude > gco_Decimal'}
      ,{name : 'bboxSouth'      ,mapping : 'gmd_identificationInfo > gmd_MD_DataIdentification[id=DataIdentification] > gmd_extent > gmd_EX_Extent > gmd_geographicElement > gmd_EX_GeographicBoundingBox > gmd_southBoundLatitude > gco_Decimal'}
      ,{name : 'bboxNorth'      ,mapping : 'gmd_identificationInfo > gmd_MD_DataIdentification[id=DataIdentification] > gmd_extent > gmd_EX_Extent > gmd_geographicElement > gmd_EX_GeographicBoundingBox > gmd_northBoundLatitude > gco_Decimal'}
      ,{name : 'minT'           ,mapping : 'gmd_identificationInfo > gmd_MD_DataIdentification[id=DataIdentification] > gmd_extent > gmd_EX_Extent > gmd_temporalElement > gmd_EX_TemporalExtent > gmd_extent > gml_TimePeriod > gml_beginPosition'}
      ,{name : 'maxT'           ,mapping : 'gmd_identificationInfo > gmd_MD_DataIdentification[id=DataIdentification] > gmd_extent > gmd_EX_Extent > gmd_temporalElement > gmd_EX_TemporalExtent > gmd_extent > gml_TimePeriod > gml_endPosition'}
      ,{name : 'services'       ,convert : (function(){
        return function(v,n) {
          return new Ext.data.XmlReader({
             record : 'gmd_identificationInfo > srv_SV_ServiceIdentification'
            ,fields : [
               {name : 'type'    ,mapping : 'srv_serviceType > gco_LocalName'}
              ,{name : 'url'     ,mapping : 'srv_containsOperations > srv_SV_OperationMetadata > srv_connectPoint > gmd_CI_OnlineResource > gmd_linkage > gmd_URL'}
            ]
          }).readRecords(n).records;
        }
      })()}
      ,{name : 'coverageType'   ,mapping : 'gmd_contentInfo > gmi_MI_CoverageDescription > gmd_contentType > gmd_MD_CoverageContentTypeCode'}
    ]
    ,listeners  : {
      beforeload : function(sto) {
        sto.setBaseParam('xmlData',buildFilter());
        Ext.getCmp('catalogPanel').getEl().mask('<table class="maskText"><tr><td>Loading...&nbsp;</td><td><img src="js/ext-3.3.0/resources/images/default/grid/loading.gif"></td></tr></table>');
      }
      ,load      : function(sto) {
        var eventTime   = getEventtimeFromEventsComboBox().split('/');
        var modelsStore = Ext.getCmp('modelsGridPanel').getStore();
        var modelsData  = [];
        var obsStore    = Ext.getCmp('observationsGridPanel').getStore();
        var obsData     = [];
        var gridsData   = [];
        sto.each(function(rec) {
          var services = rec.get('services');
          for (var i = 0; i < services.length; i++) {
            services[services[i].data.type] = services[i].data.url;
          }
          if (rec.get('coverageType') == 'modelResult') {
            modelsData.push([
               'model.' + rec.get('title')
              ,rec.get('cswId')
              ,'Click <a target=_blank href="http://testbed.sura.org/inventory?id=' + rec.get('cswId') + '">here</a> to access the online metadata record.'
              ,[rec.get('bboxWest'),rec.get('bboxSouth'),rec.get('bboxEast'),rec.get('bboxNorth')].join(',')
              ,services['Open Geospatial Consortium Sensor Observation Service (SOS)'] + '&useCache=true'
              ,{'Water level' : {
                 prop        : 'watlev'
                ,getObsExtra : '&result=VerticalDatum==urn:ogc:def:datum:epsg::5103'
              }}
            ]);
          }
          else if (rec.get('coverageType') == 'physicalMeasurement') {
            obsData.push([
               'obs.' + rec.get('title')
              ,rec.get('cswId')
              ,'Click <a target=_blank href="http://testbed.sura.org/inventory?id=' + rec.get('cswId') + '">here</a> to access the onlin e metadata record.'
              ,[rec.get('bboxWest'),rec.get('bboxSouth'),rec.get('bboxEast'),rec.get('bboxNorth')].join(',')
              ,services['Open Geospatial Consortium Sensor Observation Service (SOS)'] + '&useCache=true'
              ,{'Water level' : {
                 prop        : 'watlev'
                ,getObsExtra : '&result=VerticalDatum==urn:ogc:def:datum:epsg::5103'
              }}
            ]);
          }
          if (gridsData.length == 0 && eventTime[0] == '2012-08-30T19:00:00Z') {
            rec.set('title','ADS (Alex\'s Data Server)');
            services['Open Geospatial Consortium Web Mapping Service (WMS)'] = 'http://ec2-107-21-136-52.compute-1.amazonaws.com:8080/wms/RENCI_ISAAC_39/?REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.1.1';
            rec.commit();
            gridsData.push({
               text : rec.get('title')
              ,url  : services['Open Geospatial Consortium Web Mapping Service (WMS)']
              ,leaf : false
              ,minT : '2012-08-30T19:00:00Z'
              ,maxT : '2012-09-04T18:00:00Z'
              ,bbox : [rec.get('bboxWest'),rec.get('bboxSouth'),rec.get('bboxEast'),rec.get('bboxNorth')].join(',')
            });
          }
        });

        // hack for obs
        if (eventTime[0] == '2012-08-30T19:00:00Z') {
          obsData.push([
             'obs.COOPS'
            ,null
            ,null
            ,null
            ,'xml/coops.xml'
            ,{'Water level' : {
               prop        : 'http://mmisw.org/ont/cf/parameter/water_surface_height_above_reference_datum'
              ,getObsExtra : ''
            }}
          ]);
        }
    
        modelsStore.loadData(modelsData);
        obsStore.loadData(obsData);
        Ext.getCmp('layersGridPanel').getStore().removeAll();
        Ext.getCmp('gridsTreePanel').setRootNode(new Ext.tree.AsyncTreeNode({
           expanded : true
          ,leaf     : false
          ,children : gridsData
        }));

        setdNow(isoDateToDate(eventTime[0]));
        setMapTime();

        Ext.getCmp('catalogPanel').getEl().unmask();
      }
    }
    ,sortInfo  : {field : 'title',direction : 'ASC'}
  });
}

function buildFilter() {
  var eventTime = getEventtimeFromEventsComboBox().split('/');
  var filter = new OpenLayers.Filter.Logical({
     type    : OpenLayers.Filter.Logical.AND
    ,filters : [
      //  We want a date OVERLAP, but there is no such thing available, at least
      //  in this CSW.  So, do it ourselves.
      //  TempExtent_begin <= DATEEND && TempExtent_end >= DATEBEGIN
      new OpenLayers.Filter.Comparison({
         type     : OpenLayers.Filter.Comparison.LESS_THAN_OR_EQUAL_TO
        ,property : 'apiso:TempExtent_begin'
        ,value    : eventTime[0]
      })
      ,new OpenLayers.Filter.Comparison({
         type     : OpenLayers.Filter.Comparison.GREATER_THAN_OR_EQUAL_TO
        ,property : 'apiso:TempExtent_end'
        ,value    : eventTime[1]
      })
      ,new OpenLayers.Filter.Comparison({
         type     : OpenLayers.Filter.Comparison.LIKE
        ,property : 'OrganisationName'
        ,value    : '*' + Ext.getCmp('modelTypesComboBox').getValue() + '*'
      })
      ,new OpenLayers.Filter.Logical({
         type    : OpenLayers.Filter.Logical.OR
        ,filters : [
          new OpenLayers.Filter.Comparison({
             type     : OpenLayers.Filter.Comparison.EQUAL_TO
            ,property : 'apiso:CoverageContentTypeCode'
            ,value    : 'modelResult'
          })
          ,new OpenLayers.Filter.Comparison({
             type     : OpenLayers.Filter.Comparison.EQUAL_TO
            ,property : 'title'
            ,value    : 'Imeds UND-CHL watlev_IKE.IMEDS'
          })
        ]
      })
    ]
  });

  var xml        = new OpenLayers.Format.XML();
  var filter_1_1 = new OpenLayers.Format.Filter({version: '1.1.0'});

  return [
     '<?xml version="1.0" encoding="UTF-8"?><csw:GetRecords xmlns:csw="http://www.opengis.net/cat/csw/2.0.2" xmlns:ogc="http://www.opengis.net/ogc" xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:apiso="http://www.opengis.net/cat/csw/apiso/1.0" xmlns:ows="http://www.opengis.net/ows" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:gml="http://www.opengis.net/gml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" service="CSW" version="2.0.2" resultType="results" outputFormat="application/xml"  xsi:schemaLocation="http://www.opengis.net/gml http://schemas.opengis.net/gml/3.2.1/gml.xsd http://www.opengis.net/cat/csw/2.0.2 http://schemas.opengis.net/csw/2.0.2/CSW-discovery.xsd" outputSchema="http://www.isotc211.org/2005/gmd" startPosition="1" maxRecords="1000"><csw:Query typeNames="gmd:MD_Metadata"><csw:ElementSetName typeNames="gmd:MD_Metadata">full</csw:ElementSetName><csw:Constraint version="1.1.0">'
    ,xml.write(filter_1_1.write(filter))
    ,'</csw:Constraint> </csw:Query> </csw:GetRecords>'
  ].join('');
}

function viewReady() {
  viewsReady++;
  if (viewsReady == 2) {
    prepAndRunQuery();
  }
}

function graphLoadstartMask(url) {
  chartUrls[url] = true;
  Ext.getCmp('timeseriesPanel').getEl().mask('<table><tr><td>Updating graph...&nbsp;</td><td><img src="js/ext-3.3.0/resources/images/default/grid/loading.gif"></td></tr></table>','mask');
}

function graphLoadendUnmask(url) {
  delete chartUrls[url];
  var hits = 0;
  for (var i in chartUrls) {
    hits++;
  }
  if (hits == 0) {
    Ext.getCmp('timeseriesPanel').getEl().unmask();
  }
}

function mapLoadstartMask(url) {
  layerUrls[url] = true;
  Ext.getCmp('mapPanel').getEl().mask('<table><tr><td>Updating map...&nbsp;</td><td><img src="js/ext-3.3.0/resources/images/default/grid/loading.gif"></td></tr></table>','mask');
}

function mapLoadendUnmask(url) {
  delete layerUrls[url];
  var hits = 0;
  for (var i in layerUrls) {
    hits++;
  }
  if (hits == 0) {
    Ext.getCmp('mapPanel').getEl().unmask();
  }
}

function showToolTip(x,y,contents) {
  $('<div id="tooltip">' + contents + '</div>').css({
     position           : 'absolute'
    ,display            : 'none'
    ,top                : y + 10
    ,left               : x + 10
    ,border             : '1px solid #99BBE8'
    ,padding            : '2px'
    ,'background-color' : '#fff'
    ,opacity            : 0.80
    ,'z-index'          : 10000001
  }).appendTo("body").fadeIn(200);
}

function zeroPad(number,length) {
   number = String(number);
   var zeros = [];
   for (var i = 0 ; i < length ; ++i) {
     zeros.push('0');
   }
   return zeros.join('').substring(0, length - number.length) + number;
}

function addStormTrack(storm,eventtime,year) {
  if (map.getLayersByName('Storm track')[0]) {
    var l = map.getLayersByName('Storm track')[0];
    map.removeLayer(l);
  }

  var l = new OpenLayers.Layer.Vector('Storm track',{
    styleMap   : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(
        {
           pointRadius   : 2
          ,fillColor     : '#333333'
          ,fillOpacity   : 0.20
          ,strokeColor   : '#333333'
          ,strokeOpacity : 0.20
        }
      )
      ,'temporary' : new OpenLayers.Style(
        {
           pointRadius     : "${pointRadius}"
          ,fillColor       : '#333333'
          ,fillOpacity     : "${fillOpacity}"
          ,strokeColor     : '#333333'
          ,strokeOpacity   : "${strokeOpacity}"
        }
        ,{
          context          : {
            pointRadius : function(f) {
              return f.attributes.t ? 5 : 2;
            }
            ,strokeOpacity : function(f) {
              return f.attributes.t ? 0.75 : 0.20;
            }
            ,fillOpacity : function(f) {
              return f.attributes.t ? 0.40 : 0.20;
            }
          }
        }
      )
      ,'select' : new OpenLayers.Style(
        {
           pointRadius   : 2
          ,fillColor     : '#333333'
          ,fillOpacity   : 0.20
          ,strokeColor   : '#333333'
          ,strokeOpacity : 0.20
        }
      )
    })
  });
  map.addLayer(l);
  addToHiliteCtl(l);
  addToPopupCtl(l);

  OpenLayers.Request.issue({
     url      : 'getStormGeoJSON.php?storm=' + storm + '&eventtime=' + eventtime + '&year=' + year
    ,callback : function(r) {
      var json = new OpenLayers.Format.JSON().read(r.responseText);
      for (var i = 0; i < json.length; i++) {
        var geojson = new OpenLayers.Format.GeoJSON();
        var f       = geojson.read(json[i])[0];
        f.geometry.transform(proj4326,map.getProjectionObject());
        l.addFeatures(f);
      }
    }
  });
}

function addToHiliteCtl(lyr) {
  if (!hiliteCtl) {
    hiliteCtl = new OpenLayers.Control.SelectFeature(lyr,{
       hover          : true
      ,highlightOnly  : true
      ,renderIntent   : 'temporary'
      ,eventListeners : {
        beforefeaturehighlighted : function(e) {
          if (mouseoverObs && mouseoverObs.isVisible()) {
            mouseoverObs.hide();
          }
          var html;
          if (e.feature.attributes.dataset && e.feature.attributes.offering) {
            html = e.feature.attributes.dataset + ' : ' + e.feature.attributes.offering.shortName;
          }
          else {
            html = e.feature.attributes.storm + ' : ' + shortMonthDayStringWithTime(new Date(e.feature.attributes.t * 1000)) + '<br/>' + e.feature.attributes.cat;
          }
          var target = document.getElementById('OpenLayers.Geometry.Point_' + (Number(e.feature.id.split('_')[e.feature.id.split('_').length - 1]) - 1));
          if (target) {
            mouseoverObs = new Ext.ToolTip({
               html         : html
              ,anchor       : 'bottom'
              ,target       : target
              ,hideDelay    : 0
              ,listeners    : {hide : function(tt) {
                if (!tt.isDestroyed && !Ext.isIE) {
                  tt.destroy();
                }
              }}
            });
            mouseoverObs.show();
          }
        }
      }
    });
    map.addControl(hiliteCtl);
    hiliteCtl.activate();
  }
  else {
    var layers = [lyr];
    if (hiliteCtl.layers) {
      for (var i = 0; i < hiliteCtl.layers.length; i++) {
        layers.push(hiliteCtl.layers[i]);
      }
    }
    else {
      layers.push(hiliteCtl.layer);
    }
    hiliteCtl.setLayer(layers);
  }
}

function addToPopupCtl(lyr) {
  if (!popupCtl) {
    popupCtl = new OpenLayers.Control.SelectFeature(lyr,{
      eventListeners : {
        featurehighlighted : function(e) {
          if (popupObs && popupObs.isVisible()) {
            popupObs.hide();
          }
          var properties = getProperties(e.feature.attributes);
          if (!properties) {
            return;
          }
          var propertiesLinks = [];
          for (p in properties) {
            var shortP = p.split('/');
            shortP = shortP[shortP.length-1];
            shortP = shortP.substr(0,40) + (shortP.length > 40 ? '...' : '');
            propertiesLinks.push('<a href="#" onclick="getObs(\'' + e.feature.layer.name + '\',\'' + properties[p] + '\',\'' + p + '\',\'' + e.feature.attributes.offering.shortName + ' ' + e.feature.attributes.dataset + '\',' + e.feature.attributes.offering.llon + ',' + e.feature.attributes.offering.llat + ',true,\'' + (e.feature.attributes.targetProperties ? e.feature.attributes.targetProperties.getObsExtra : '') + '\')">' + shortP + '</a>');
          }
          var tr = [
             '<td><b>time&nbsp;range</b></td><td>' + shortDateStringNoTime(isoDateToDate(e.feature.attributes.offering.begin_time)) + '&nbsp;\u2011&nbsp;' + shortDateStringNoTime(isoDateToDate(e.feature.attributes.offering.end_time)) + '</td>'
            ,'<td><b>properties</b></td><td>' + propertiesLinks.join(', ') + '</td>'
            ,'<td><b>dataset</b></td><td>' + e.feature.attributes.dataset + '<br><a href="javascript:setCenterOnPoint(' + e.feature.attributes.offering.llon + ',' + e.feature.attributes.offering.llat + ')">zoom & recenter map to this site</a></td>'
          ];
          popupObs = new Ext.ToolTip({
             title     : e.feature.attributes.dataset + ' : ' + e.feature.attributes.offering.shortName
            ,items     : {bodyCssClass : 'obsPopup',html : '<table><tr>' + tr.join('</tr><tr>') + '</tr></table>'}
            ,anchor    : 'bottom'
            ,width     : 345
            ,target    : 'OpenLayers.Geometry.Point_' + (Number(e.feature.id.split('_')[e.feature.id.split('_').length - 1]) - 1)
            ,autoHide  : false
            ,closable  : true
            ,style     : {
              'z-index' : 5000 // keep the popup below any subsequent form 'popups'
            }
            ,listeners : {
              hide : function(tt) {
                if (!tt.isDestroyed) {
                  tt.destroy();
                }
                if (e.feature.layer) {
                  popupCtl.unselect(e.feature);
                }
              }
            }
          });
          popupObs.show();
          mapClick(map.getPixelFromLonLat(new OpenLayers.LonLat(e.feature.geometry.getCentroid().x,e.feature.geometry.getCentroid().y)));
        }
      }
    });
    map.addControl(popupCtl);
    popupCtl.activate();
  }
  else {
    var layers = [lyr];
    if (popupCtl.layers) {
      for (var i = 0; i < popupCtl.layers.length; i++) {
        layers.push(popupCtl.layers[i]);
      }
    }
    else {
      layers.push(popupCtl.layer);
    }
    popupCtl.setLayer(layers);
  }
}

function setMapTime() {
  Ext.getCmp('mapTime').setText(dNow.getUTCFullYear() + '-' + String.leftPad(dNow.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(dNow.getUTCDate(),2,'0') + ' ' + String.leftPad(dNow.getUTCHours(),2,'0') + ':00 UTC');
  for (var i = 0; i < map.layers.length; i++) {
    // WMS layers only
    if (map.layers[i].DEFAULT_PARAMS) {
      map.layers[i].mergeNewParams({TIME : makeTimeParam(dNow)});
    }
  }

  if (Ext.getCmp('datePicker')) {
    var dp = Ext.getCmp('datePicker');
    dp.suspendEvents();
    dp.setValue(new Date(dNow.getTime() + dNow.getTimezoneOffset() * 60000));
    dp.resumeEvents();
  }
}

function addTileCache(l) {
  var lyr = new OpenLayers.Layer.TileCache(
     l.name
    ,l.url
    ,l.layer
    ,{
       visibility        : l.visibility
      ,isBaseLayer       : false
      ,wrapDateLine      : true
      ,projection        : l.projection
      ,opacity           : 1
      ,scales            : [
         55468034.09273208   // ESRI Ocean zoom 3
        ,27734017.04636604
        ,13867008.52318302
        ,6933504.26159151
        ,3466752.130795755
        ,1733376.0653978775
        ,866688.0326989387
        ,433344.01634946937
        ,216672.00817473468
      ]
    }
  );
  lyr.getURL = function(bounds) {
    var res = this.map.getResolution();
    var bbox = this.maxExtent;
    var size = this.tileSize;
    var tileX = Math.round((bounds.left - bbox.left) / (res * size.w));
    var tileY = Math.round((bounds.bottom - bbox.bottom) / (res * size.h));
    var tileZ = this.serverResolutions != null ?
        OpenLayers.Util.indexOf(this.serverResolutions, res) :
        this.map.getZoom();
    // this is the trick
    tileZ += map.baseLayer.minZoomLevel ? map.baseLayer.minZoomLevel : 0;
    /**
     * Zero-pad a positive integer.
     * number - {Int}
     * length - {Int}
     *
     * Returns:
     * {String} A zero-padded string
     */
    function zeroPad(number, length) {
        number = String(number);
        var zeros = [];
        for(var i=0; i<length; ++i) {
            zeros.push('0');
        }
        return zeros.join('').substring(0, length - number.length) + number;
    }
    var components = [
        this.layername,
        zeroPad(tileZ, 2),
        zeroPad(parseInt(tileX / 1000000), 3),
        zeroPad((parseInt(tileX / 1000) % 1000), 3),
        zeroPad((parseInt(tileX) % 1000), 3),
        zeroPad(parseInt(tileY / 1000000), 3),
        zeroPad((parseInt(tileY / 1000) % 1000), 3),
        zeroPad((parseInt(tileY) % 1000), 3) + '.' + this.extension
    ];
    var path = components.join('/');
    var url = this.url;
    if (url instanceof Array) {
        url = this.selectUrl(path, url);
    }
    url = (url.charAt(url.length - 1) == '/') ? url : url + '/';
    return url + path;
  };
  addLayer(lyr,false);
}

function addLayer(lyr,timeSensitive) {
  if (timeSensitive) {
    lyr.mergeNewParams({TIME : makeTimeParam(dNow)});
  }
  map.addLayer(lyr);
}

function addGrid(url,lyr,stl,sgl,name,type,ele) {
  if (map.getLayersByName(name)[0]) {
    var lyr = map.getLayersByName(name)[0];
    lyr.setVisibility(true);
    return;
  }

  var lyr = new OpenLayers.Layer.WMS(
     name
    ,url
    ,{
       layers      : lyr
      ,styles      : stl
      ,transparent : true
      ,elevation   : ele
    }
    ,{
       isBaseLayer  : false
      ,projection   : proj3857
      ,singleTile   : sgl
      ,wrapDateLine : true
      ,visibility   : true
      ,opacity      : 1
    }
  );
  lyr.defaultStyle = stl;

  lyr.events.register('visibilitychanged',this,function(e) {
    if (!lyr.visibility) {
      var sto = Ext.getCmp('legendsGridPanel').getStore();
      var idx = sto.find('name',lyr.name);
      if (idx >= 0) {
        sto.removeAt(idx);
      }
      mapLoadendUnmask(lyr.name);
    }
  });
  lyr.events.register('loadstart',this,function(e) {
    mapLoadstartMask(lyr.name);
    var sto = Ext.getCmp('legendsGridPanel').getStore();
    var idx = sto.find('name',lyr.name);
    if (idx >= 0) {
      var rec = sto.getAt(idx);
      rec.set('status','loading');
      rec.commit();
    }
    else {
      var gridsStore = Ext.getCmp('layersGridPanel').getStore();
      var rec = gridsStore.getAt(gridsStore.find('name',lyr.name));
      sto.add(new sto.recordType({
         name        : lyr.name
        ,displayName : rec.get('name')
        ,status      : 'loading'
      }));
    }
  });
  lyr.events.register('loadend',this,function(e) {
    mapLoadendUnmask(lyr.name);
    var sto = Ext.getCmp('legendsGridPanel').getStore();
    var idx = sto.find('name',lyr.name);
    if (idx >= 0) {
      var rec = sto.getAt(idx);
      OpenLayers.Request.GET({
         url      : 'getTimestamp.php?'
          + lyr.getFullRequestString({})
          + '&WIDTH='  + map.getSize().w
          + '&HEIGHT=' + map.getSize().h
          + '&BBOX=' +  map.getExtent().toArray().join(',')
          + '&' + new Date().getTime()
          + '&drawImg=false'
        ,callback : function(r) {
          if (r.responseText == '' || r.responseText == 'dateNotAvailable') {
            rec.set('timestamp','<span class="alert">This layer\'s<br/>timestamp is unknown.</span>');
          }
          else if (r.responseText == 'invalidBbox') {
            rec.set('timestamp','<span class="alert">This layer\'s domain<br/>is out of bounds.</span>');
          }
          else {
            var prevTs = rec.get('timestamp');
            var d = new Date(r.responseText * 1000);
            var newTs  = d.getUTCFullYear() + '-' + String.leftPad(d.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(d.getUTCDate(),2,'0') + ' ' + String.leftPad(d.getUTCHours(),2,'0') + ':00 UTC';
            rec.set('timestamp',newTs);
            rec.set('jsDate',d);
          }
          rec.set('status','drawn');
          rec.commit();
        }
      });
    }
  });
  lyr.mergeNewParams({TIME : makeTimeParam(dNow)});

  map.addLayer(lyr);
}

function makeTimeParam(d) {
  return d.getUTCFullYear() 
    + '-' + String.leftPad(d.getUTCMonth() + 1,2,'0') 
    + '-' + String.leftPad(d.getUTCDate(),2,'0') 
    + 'T' 
    + String.leftPad(d.getUTCHours(),2,'0') 
    + ':00:00'
}

function setdNow(d) {
  dNow = new Date(d.getTime());
  dNow.setUTCMinutes(0);
  dNow.setUTCSeconds(0);
  dNow.setUTCMilliseconds(0);
  if (dNow.getHours() >= 12) {
    dNow.setUTCHours(12);
  }
  else {
    dNow.setUTCHours(0);
  }
}

function mapClick(xy) {
  lastMapClick['xy'] = xy;
  lyrQueryPts.removeFeatures(lyrQueryPts.features);

  var l = [];
  Ext.getCmp('legendsGridPanel').getStore().each(function(rec) {
    l.push(map.getLayersByName(rec.get('name'))[0]);
  });

  if (l.length == 0) {
    if (Ext.getCmp('stationGridTabPanel').getActiveTab().id == 'gridsTab') {
      Ext.Msg.alert('Query error','Please add at least one gridded dataset to the map before requesting a time series extraction.');
    }
  }
  else {
    var lonLat       = map.getLonLatFromPixel(xy);
    var f            = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(lonLat.lon,lonLat.lat));
    f.attributes.img = 'Delete-icon.png';
    lyrQueryPts.addFeatures(f);
    queryWMS(xy,l);
  }
}

function queryWMS(xy,a) {
  lastMapClick['layer'] = a[0].name;
  var targets = [];
  var sto = Ext.getCmp('legendsGridPanel').getStore();
  var grdSto = Ext.getCmp('layersGridPanel').getStore();
  for (var i = 0; i < a.length; i++) {
    var mapTime;
    var legIdx = sto.find('name',a[i].name);
    var grdIdx = grdSto.find('name',a[i].name);
    if (legIdx >= 0 && String(sto.getAt(legIdx).get('timestamp')).indexOf('alert') < 0) {
      var d = sto.getAt(legIdx).get('jsDate');
      if (d) {
        mapTime = '&mapTime=' + d.getTime() / 1000;
      }
      else {
        Ext.Msg.alert('Time series error',"We're sorry, but we could not perform a time series extraction.  If the layer is still loading, please wait until it has finished and retry.");
        return;
      }
    }
    var paramOrig = OpenLayers.Util.getParameters(a[i].getFullRequestString({}));
    var minT = new Date(grdSto.getAt(grdIdx).get('minT') * 1000);
    var maxT = new Date(grdSto.getAt(grdIdx).get('maxT') * 1000);
    var d = sto.getAt(legIdx).get('jsDate');
    if (d) {
      minT = new Date(d.getTime() - 3600 * 24 * 1000);
      maxT = new Date(d.getTime() + 3600 * 24 * 1000);
    }
    var paramNew = {
       REQUEST       : 'GetFeatureInfo'
      ,BBOX          : map.getExtent().toBBOX()
      ,X             : xy.x
      ,Y             : xy.y
      ,INFO_FORMAT   : 'text/xml'
      ,FEATURE_COUNT : 1
      ,WIDTH         : map.size.w
      ,HEIGHT        : map.size.h
      ,QUERY_LAYERS  : paramOrig['LAYERS']
      ,TIME          : makeTimeParam(minT) + '/' + makeTimeParam(maxT)
    };
    targets.push({
       url   : a[i].getFullRequestString(
          paramNew
         ,'getFeatureInfo.php?' + a[i].url 
           + '&tz=' + new Date().getTimezoneOffset() 
           + mapTime 
           + '&varName=' + grdSto.getAt(grdIdx).get('varName') 
           + '&varUnits=' + grdSto.getAt(grdIdx).get('varUnits')
       )
      ,title : sto.getAt(legIdx).get('displayName')
      ,type  : 'model'
    });
  }
  addToChart(targets);
}

function addToChart(a) {
  for (var j = 0; j < a.length; j++) {
    graphLoadstartMask(a[j].url);
    OpenLayers.Request.GET({
       url      : a[j].url
      ,callback : OpenLayers.Function.bind(addToChartCallback,null,a[j].title,a[j].url)
    });
  }
  function addToChartCallback(title,url,r) {
    graphLoadendUnmask(url);
    var obs = new OpenLayers.Format.JSON().read(r.responseText);
    if (obs && obs.error) {
      chartData.push({
         data   : []
        ,label  : title.split('||')[0] + ': QUERY ERROR ' + obs.error
        ,id     : Ext.id()
      });
    }
    else if (!obs || obs.d == '' || obs.d.length == 0) {
      chartData.push({
         data   : []
        ,label  : title.split('||')[0] + ': QUERY ERROR'
        ,id     : Ext.id()
      });
    }
    else {
      // get rid of any errors if good, new data has arrived
      if (chartData.length == 1 && String(chartData[0]).indexOf('QUERY ERROR') == 0) {
        chartData.pop();
      }
      for (var v in obs.d) {
        // get the data
        chartData.push({
           data   : []
          ,label  : title.split('||')[0] + ' : ' + v + ' (' + obs.u[v] + ')'
          ,lines  : {show : true}
          ,id     : Ext.id()
        });
        for (var i = 0; i < obs.d[v].length; i++) {
          chartData[chartData.length-1].data.push([obs.t[i],obs.d[v][i]]);
        }
        if (obs.d[v].length == 1) {
          chartData[chartData.length - 1].points = {show : true};
        }
      }
    }
    Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
  }
}

function toEnglish(v) {
  if (String(v.src).indexOf('Celcius') >= 0) {
    if (v.typ == 'title') {
      return v.val.replace('Celcius','Fahrenheit');
    }
    else {
      return v.val * 9/5 + 32;
    }
  }
  else if (String(v.src).indexOf('Meters') >= 0) {
    if (v.typ == 'title') {
      return v.val.replace('Meters','Feet');
    }
    else {
      return v.val * 3.281;
    }
  }
  return v.val;
}

function goLayerCallout(name) {
  if (!Ext.getCmp('info.popup.' + name) || !Ext.getCmp('info.popup.' + name).isVisible()) {
    var customize = '<a class="blue-href-only" href="javascript:setLayerSettings(\'' + name + '\')"><img width=32 height=32 src="img/settings_tools_big.png"><br>Customize<br>appearance</a>';
    if (!new RegExp(/^grid\./).test(name)) {
      customize = '<img width=32 height=32 src="img/settings_tools_big_disabled.png"><br><font color="lightgray">Customize<br>appearance</font>';
    }
    new Ext.ToolTip({
       id        : 'info.popup.' + name
      ,title     : name
      ,anchor    : 'right'
      ,target    : 'info.' + name
      ,autoHide  : false
      ,closable  : true
      ,width     : 250
      ,items     : {
         layout   : 'column'
        ,defaults : {border : false}
        ,height   : 75
        ,bodyStyle : 'padding:6'
        ,items    :  [
           {columnWidth : 0.33,items : {xtype : 'container',autoEl : {tag : 'center'},items : {border : false,html : '<a class="blue-href-only" href="javascript:zoomToBbox(\'' + name + '\')"><img width=32 height=32 src="img/find_globe_big.png"><br>Zoom<br>to layer</a>'}}}
          ,{columnWidth : 0.34,items : {xtype : 'container',autoEl : {tag : 'center'},items : {border : false,html : customize}}}
          ,{columnWidth : 0.33,items : {xtype : 'container',autoEl : {tag : 'center'},items : {border : false,html : '<a class="blue-href-only" href="javascript:showLayerInfo(\'' + name + '\')"><img width=32 height=32 src="img/document_image.png"><br>Layer<br>information</a>'}}}
        ]
      }
      ,listeners : {
        hide : function() {
          this.destroy();
        }
      }
    }).show();
  }
}

function destroyLayerCallout(name) {
  if (Ext.getCmp('info.popup.' + name) && Ext.getCmp('info.popup.' + name).isVisible()) {
     Ext.getCmp('info.popup.' + name).destroy();
  }
}

function zoomToBbox(name) {
  destroyLayerCallout(name);
  // figure out which gp's store to hit
  var gp = {
     grid  : 'layersGridPanel'
    ,model : 'modelsGridPanel'
    ,obs   : 'observationsGridPanel'
  };
  var sto = Ext.getCmp(gp[name.split('.')[0]]).getStore();
  var idx = sto.find('name',name);
  if (idx >= 0) {
    var p = sto.getAt(idx).get('bbox').split(',');
    map.zoomToExtent(new OpenLayers.Bounds(p[0],p[1],p[2],p[3]).transform(proj4326,map.getProjectionObject()));
  }
}

function showLayerInfo(name) {
  destroyLayerCallout(name);
  if (!activeInfoWindows[name]) {
    // figure out which gp's store to hit
    var gp = {
       grid  : 'layersGridPanel'
      ,model : 'modelsGridPanel'
      ,obs   : 'observationsGridPanel'
    };
    var sto = Ext.getCmp(gp[name.split('.')[0]]).getStore();
    var idx = sto.find('name',name);
    if (idx >= 0) {
      var pos = getOffset(document.getElementById('info.' + name));
      activeInfoWindows[name] = new Ext.Window({
         width      : 400
        ,x          : pos.left
        ,y          : pos.top
        ,autoScroll : true
        ,constrainHeader : true
        ,title      : name.split('.').slice(1) + ' :: info'
        ,items      : {border : false,bodyCssClass : 'popup',html : sto.getAt(idx).get('abstract')}
        ,listeners  : {hide : function() {
          activeInfoWindows[name] = null;
        }}
      }).show();
    }
  }
}

function setLayerSettings(name,position) {
  var sto = Ext.getCmp('layersGridPanel').getStore();
  var idx = sto.find('name',name);
  var lyr = map.getLayersByName(name)[0];
  if (lyr && idx >= 0 && !activeSettingsWindows[name]) {
    var customize = sto.getAt(idx).get('customize');
    var pos       = getOffset(document.getElementById('info.' + name));
    var id        = Ext.id();
    var items     = [
      new Ext.Slider({
         fieldLabel : 'Opacity<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.opacity' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.opacity' + '" src="img/info.png"></a>'
        ,id       : 'opacity.' + id
        ,width    : 130
        ,minValue : 0
        ,maxValue : 100
        ,value    : lyr.opacity * 100
        ,plugins  : new Ext.slider.Tip({
          getText : function(thumb) {
            return String.format('<b>{0}%</b>', thumb.value);
          }
        })
        ,listeners : {
          afterrender : function() {
            new Ext.ToolTip({
               id     : 'tooltip.' + id + '.opacity'
              ,target : id + '.opacity'
              ,html   : "Use the slider to adjust the layer's opacity.  The lower the opacity, the greater the transparency."
            });
          }
          ,change : function(slider,val) {
            lyr.setOpacity(val / 100);
          }
        }
      })
    ];

    if (customize.elevation.length > 0) {
      var data = [];
      for (var i = 0; i < customize.elevation.length; i++) {
        data.push([customize.elevation[i],customize.elevation[i]]);
      }
      items.push(buildSelect(
         'elevation'
        ,data
        ,'Elevation'
        ,'Select an elevation that this service has exposed.'
        ,lyr
        ,false
      ));
    }

    if (customize.styles.length > 0 && !customize.customStyles) {
      var data = [['None','']];
      for (var i = 0; i < customize.styles.length; i++) {
        data.push([customize.styles[i].title,customize.styles[i].name]);
      }
      items.push(buildSelect(
         'styles'
        ,data
        ,'Style'
        ,'Select a styling option that this service has exposed.'
        ,lyr
        ,false
      ));
    }

    if (customize.customStyles) {
      var anyVal = false;
      for (var i in customize.customStyles) {
        items.push(buildSelect(
           'styles_' + customize.customStyles[i].position
          ,customize.customStyles[i].data
          ,customize.customStyles[i].lbl
          ,customize.customStyles[i].tip
          ,lyr
          ,customize.customStyles[i].anyVal
        ));
        anyVal = anyVal || customize.customStyles[i].anyVal;
      }
      if (anyVal) {
        items.push({border : false,cls : 'directionsPanel',html : 'A (*) indicates that you may enter a custom numeric value for the field.'});
      }
    }

    activeSettingsWindows[name] = new Ext.Window({
       bodyStyle : 'background:white;padding:5'
      ,x         : position ? position[0] : pos.left
      ,y         : position ? position[1] : pos.top
      ,width     : 270
      ,layout    : 'fit'
      ,constrainHeader : true
      ,resizable : false
      ,title     : name.split('.').slice(1) + ' :: settings'
      ,items     : new Ext.FormPanel({
         border         : false
        ,bodyStyle      : 'background:transparent'
        ,width          : 240
        ,labelWidth     : 100
        ,labelSeparator : ''
        ,items          : items
      })
      ,listeners : {hide : function() {
        activeSettingsWindows[name] = null;
      }}
      ,buttons   : [
         {text : 'Apply'}
        ,{
           text    : 'Revert'
          ,handler : function() {
            setParam(lyr,'STYLES',lyr.defaultStyle);
            var pos = activeSettingsWindows[name].getPosition();
            activeSettingsWindows[name].close();
            Ext.defer(function(){setLayerSettings(name,pos)},100);
          }
        }
      ]
    }).show();
  }
  else {
    Ext.Msg.alert('Settings error','Please check this layer ON before adjusting its settings.');
  }

  destroyLayerCallout(name);
}

function buildSelect(field,data,lbl,tip,lyr,allowAnyVal) {
  var fld = field.split('_');
  var val = OpenLayers.Util.getParameters(lyr.getFullRequestString({}))[fld[0].toUpperCase()];
  if (fld.length == 2) {
    val = val.split('_')[fld[1]];
  }
  return new Ext.form.ComboBox({
     fieldLabel     : lbl + '<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.' + field + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.' + field + '" src="img/info.png"></a>'
    ,id             : field + '.' + id
    ,store          : new Ext.data.ArrayStore({
      fields : [
        'name'
       ,'value'
      ]
      ,data : data
    })
    ,displayField   : 'name'
    ,valueField     : 'value'
    ,value          : val
    ,editable       : allowAnyVal
    ,triggerAction  : 'all'
    ,mode           : 'local'
    ,width          : 130
    ,forceSelection : !allowAnyVal
    ,lastQuery      : ''
    ,listeners      : {
      afterrender : function(el) {
        new Ext.ToolTip({
           id     : 'tooltip.' + id + '.' + field
          ,target : id + '.' + field
          ,html   : tip
        });
        this.addListener('change',function(el,val) {
          if (fld[0] == 'styles') {
            var s = OpenLayers.Util.getParameters(lyr.getFullRequestString({}))['STYLES'].split('_');
            s[fld[1]] = val;
            val = s.join('_');
          }
          setParam(lyr,fld[0].toUpperCase(),val);
        });
      }
    }
  });
}

function setParam(lyr,param,val) {
  var h = {};
  h[param] = val;
  lyr.mergeNewParams(h);
  var sto = Ext.getCmp('layersGridPanel').getStore();
  var idx = sto.find('name',lyr.name);
  if (idx >= 0) {
    var rec = sto.getAt(idx);
    var p = OpenLayers.Util.getParameters(sto.getAt(idx).get('leg'));
    p[param] = val;
    var a = [];
    for (var i in p) {
      a.push(i + '=' + p[i]);
    }
    rec.set('leg',sto.getAt(idx).get('leg').split('?')[0] + '?' + a.join('&'));
    rec.commit();
  }
}

function getOffset(el) {
  var _x = 0;
  var _y = 0;
  while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
    _x += el.offsetLeft - el.scrollLeft;
    _y += el.offsetTop - el.scrollTop;
    el = el.offsetParent;
  }
  return {top: _y,left: _x};
}

function wmsGetCaps(node,cb) {
  if (!node.attributes.text) {
    cb([],{status : true});
    return;
  }

  function wmsGetCapsCallback(node,r) {
    var caps = new OpenLayers.Format.WMSCapabilities().read(r.responseText);
    if (!caps || !caps.capability) {
      Ext.Msg.alert('WMS exception','There was an error querying this data service.');
      cb([],{status : true});
      return;
    }
    var nodesByText = {};
    var nodesText   = [];
    for (var i = 0; i < caps.capability.layers.length; i++) {
      nodesByText[(caps.capability.layers[i].title + ' (' + caps.capability.layers[i].name + ')').toLowerCase()] = {
         id        : caps.capability.layers[i].name
        ,text      : caps.capability.layers[i].title + ' (' + caps.capability.layers[i].name + ')'
        ,qtip      : caps.capability.layers[i].title + ' (' + caps.capability.layers[i].name + ')'
        ,leaf      : true
        ,icon      : 'img/layer16.png'
        ,getMapUrl : caps.capability.request.getmap.href
        ,layer     : caps.capability.layers[i]
        ,minT      : isoDateToDate(node.attributes.minT).getTime() / 1000
        ,maxT      : isoDateToDate(node.attributes.maxT).getTime() / 1000
        ,bbox      : caps.capability.layers[i].llbbox ? caps.capability.layers[i].llbbox.join(',') : node.attributes.bbox
        ,version   : caps.version
      };
      nodesText.push(String(caps.capability.layers[i].title + ' (' + caps.capability.layers[i].name + ')').toLowerCase());
    }
    nodesText.sort();
    var nodes = [];
    for (var i = 0; i < nodesText.length; i++) {
      nodes.push(nodesByText[nodesText[i]]);
    }
    cb(nodes,{status : true});
  }

  OpenLayers.Request.issue({
     url      : 'get.php?u=' + encodeURIComponent(node.attributes.url)
    ,callback : OpenLayers.Function.bind(wmsGetCapsCallback,null,node)
  });
}
