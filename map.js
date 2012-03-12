var map;
var proj3857   = new OpenLayers.Projection("EPSG:3857");
var proj900913 = new OpenLayers.Projection("EPSG:900913");
var proj4326   = new OpenLayers.Projection("EPSG:4326");
var mouseoverObs;
var hiliteCtl;
var popupObs;
var popupCtl;
var chartData = [];
var logsStore = new Ext.data.ArrayStore({
   fields    : ['type','name','url','t']
  ,listeners : {add : function(store,recs,idx) {
    pendingTransactions[recs[0].get('url')] = true;
  }}
});
var pendingTransactions = {};

var logsWin;

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

  var modelTypesFormPanel = new Ext.FormPanel({
     id              : 'modelTypesFormPanel'
    ,layout          : 'fit'
    ,border          : false
    ,items           : new Ext.form.ComboBox({
      store : new Ext.data.ArrayStore({
         fields : ['id']
        ,data   : [['Inundation']]
      })
      ,id             : 'modelTypesComboBox'
      ,displayField   : 'id'
      ,valueField     : 'id'
      ,mode           : 'local'
      ,forceSelection : true
      ,triggerAction  : 'all'
      ,editable       : false
      ,value          : 'Inundation'
    })
  });

  var eventsFormPanel = new Ext.FormPanel({
     id              : 'eventsFormPanel'
    ,layout          : 'fit'
    ,border          : false
    ,items           : new Ext.form.ComboBox({
      store : new Ext.data.ArrayStore({
         fields : ['id']
        ,data   : [['Hurricane Ike']]
      })
      ,id             : 'eventsComboBox'
      ,displayField   : 'id'
      ,valueField     : 'id'
      ,mode           : 'local'
      ,forceSelection : true
      ,triggerAction  : 'all'
      ,editable       : false
      ,value          : 'Hurricane Ike'
    })
  });

  var parametersFormPanel = new Ext.FormPanel({
     id              : 'parametersFormPanel'
    ,layout          : 'fit'
    ,border          : false
    ,items           : new Ext.form.ComboBox({
      store : new Ext.data.ArrayStore({
         fields : ['id']
        ,data   : [['Water level']]
      })
      ,id             : 'parametersComboBox'
      ,displayField   : 'id'
      ,valueField     : 'id'
      ,mode           : 'local'
      ,forceSelection : true
      ,triggerAction  : 'all'
      ,editable       : false
      ,value          : 'Water level'
    })
  });

  var observationsSelModel = new Ext.grid.CheckboxSelectionModel({
     header    : ''
    ,listeners : {
      rowselect : function(sm,rowIndex,rec) {
        getCaps(rec.get('url'),rec.get('name'));
      }
      ,rowdeselect : function(sm,rowIndex,rec) {
        map.getLayersByName(rec.get('name'))[0].setVisibility(false);
      }
    }
  });
  var observationsGridPanel = new Ext.grid.GridPanel({
     height      : 50
    ,id          : 'observationsGridPanel'
    ,store : new Ext.data.ArrayStore({
       fields : ['name','url']
      ,data   : [['obs.coops','xml/coops.xml'],['obs.watlev_CRMS_2008.F.C.nc','xml/obs.watlev_CRMS_2008.F.C.nc.getcaps.xml']]
//      ,data   : [['obs.watlev_CRMS_2008.F.C.nc','xml/obs.watlev_CRMS_2008.F.C.nc.getcaps.xml']]
//      ,data   : [['obs.watlev_CRMS_2008.F.C.nc','http://testbedapps-dev.sura.org/thredds/sos/alldata/acrosby/watlev_CRMS_2008.F.C.nc?service=sos&version=1.0.0&request=GetCapabilities']]
    })
    ,selModel    : observationsSelModel
    ,autoExpandColumn : 'name'
    ,columns     : [
       observationsSelModel
      ,{id : 'name',dataIndex :'name',renderer : renderName}
    ]
    ,hideHeaders : true
    ,listeners   : {viewready : function() {
      this.getSelectionModel().selectAll();
    }}
  });

  var modelsSelModel = new Ext.grid.CheckboxSelectionModel({
     header    : ''
    ,listeners : {
      rowselect : function(sm,rowIndex,rec) {
        getCaps(rec.get('url'),rec.get('name'));
      }
      ,rowdeselect : function(sm,rowIndex,rec) {
        map.getLayersByName(rec.get('name'))[0].setVisibility(false);
      }
    }
  });
  var modelsGridPanel = new Ext.grid.GridPanel({
     height      : 50
    ,id          : 'modelsGridPanel'
    ,store : new Ext.data.ArrayStore({
       fields : ['name','url']
      ,data   : [['model.watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc','xml/model.watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc.getcaps.xml']]
//      ,data   : [['model.watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc','http://testbedapps-dev.sura.org/thredds/sos/alldata/acrosby/watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc?service=sos&version=1.0.0&request=GetCapabilities']]
    })
    ,selModel    : modelsSelModel
    ,autoExpandColumn : 'name'
    ,columns     : [
       modelsSelModel
      ,{id : 'name',dataIndex :'name',renderer : renderName}
    ]
    ,hideHeaders : true
    ,listeners   : {viewready : function() {
      this.getSelectionModel().selectAll();
    }}
  });

  new Ext.Viewport({
     layout : 'border'
    ,items  : [
      {
         region      : 'west'
        ,width       : 275
        ,items       : [
          {title : 'Catalog query filters',id : 'queryFiltersPanel',border : false,bodyStyle : 'padding:5px 5px 0',items : [
            {
               border : false
              ,cls    : 'directionsPanel'
              ,html   : 'Select a model type, a storm or an event, and a parameter to begin your search.'
            }
            ,new Ext.form.FieldSet({
               title : '&nbsp;Model type&nbsp;'
              ,items : modelTypesFormPanel
            })
            ,new Ext.form.FieldSet({
               title : '&nbsp;Storm or event&nbsp;'
              ,items : eventsFormPanel
            })
            ,new Ext.form.FieldSet({
               title : '&nbsp;Parameter&nbsp;'
              ,items : parametersFormPanel
            })
          ]}
          ,{title : 'Catalog query results',id : 'queryResultsPanel',border : false,bodyStyle : 'padding:5px 5px 0',items : [
            {
               border : false
              ,cls    : 'directionsPanel'
              ,html   : 'Select models and observations for time series comparisons.  Once you click on a site, it will be used as a pivot point, and any companion datasets that you have checked ON will subsequently be queried.  Only the closest point from each companion dataset will be queried.'
            }
            ,new Ext.form.FieldSet({
               title : '&nbsp;Model datasets&nbsp;'
              ,id    : 'modelsFieldSet'
              ,items : modelsGridPanel
            })
            ,new Ext.form.FieldSet({
               title : '&nbsp;Observation datasets&nbsp;'
              ,id    : 'observationsFieldSet'
              ,items : observationsGridPanel
            })
          ]}
        ]
        ,listeners        : {afterrender : function() {this.addListener('bodyresize',function(p,w,h) {
          var targetH = h - Ext.getCmp('queryResultsPanel').getPosition()[1] - 210; 
          targetH < 80 ? targetH = 80 : null;
          Ext.getCmp('observationsGridPanel').setHeight(targetH / 2);
          Ext.getCmp('modelsGridPanel').setHeight(targetH / 2);
        })}}
      }
      ,{
         region    : 'center'
        ,layout    : 'border'
        ,border    : false
        ,items     : [
          {
             split     : true
            ,region    : 'center'
            ,html      : '<div id="map"></div>'
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
                 text    : 'View transaction logs'
                ,icon    : 'img/file_extension_log.png'
                ,id      : 'transactionLogsButton'
                ,handler : function() {
                  if (!logsWin || !logsWin.isVisible()) {
                    logsWin = new Ext.Window({
                       title  : 'Transcation logs'
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
                    });
                    logsWin.show();
                  }
                }
              }
              ,'->'
              ,{
                 text    : 'Clear graph'
                ,icon    : 'img/trash-icon.png'
                ,handler : function() {
                  chartData = [];
                  Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
                }
              }
            ]
            ,bbar      : [
               '->'
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
                  el.style.height = win.getHeight() - 55;
                  if (!chartData || chartData.length <= 0) {
                    el.innerHTML = '<table width="100%" class="directionsPanel"><tr><td style="padding:10px 40px 0px 40px">Begin by selecting values for the catalog query filters.  Then select observation and model datasets to analyze.  Once you see dots on the map, click one, and then click on the parmater link in the popup window.  A time series graph will appear here.</td></tr></table>';
                  }
                  else {
                    $.plot(
                     $('#chart')
                      ,chartData
                      ,{
                         xaxis  : {mode : 'time'}
                        ,pan    : {interactive : true}
                        ,grid   : {backgroundColor : {colors : ['#fff','#eee']},borderWidth : 1,borderColor : '#99BBE8',hoverable : true}
                        ,legend : {show : Ext.getCmp('legendPositionComboBox').getValue() != 'Off',position : Ext.getCmp('legendPositionComboBox').getValue().toLowerCase(),backgroundOpacity : 0.3}
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

  OpenLayers.Util.onImageLoadError = function() {this.src = 'img/blank.png';}

  // patch openlayers 2.11RC to fix problem when switching to a google layer
  // from a non google layer after resizing the map
  // http://osgeo-org.1803224.n2.nabble.com/trunk-google-v3-problem-resizing-and-switching-layers-amp-fix-td6578816.html
  OpenLayers.Layer.Google.v3.onMapResize = function() {
    var cache = OpenLayers.Layer.Google.cache[this.map.id];
    cache.resized = true;
  };
  OpenLayers.Layer.Google.v3.setGMapVisibility_old =
  OpenLayers.Layer.Google.v3.setGMapVisibility;
  OpenLayers.Layer.Google.v3.setGMapVisibility = function(visible) {
    var cache = OpenLayers.Layer.Google.cache[this.map.id];
    if (visible && cache && cache.resized) {
      google.maps.event.trigger(this.mapObject, "resize");
      delete cache.resized;
    }
    OpenLayers.Layer.Google.v3.setGMapVisibility_old.apply(this,arguments);
  };

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
    ]
    ,projection        : proj900913
    ,displayProjection : proj4326
    ,units             : 'm'
    ,maxExtent         : new OpenLayers.Bounds(-20037508,-20037508,20037508,20037508.34)
  });

  map.setCenter(new OpenLayers.LonLat(-89.2,24.3).transform(proj4326,map.getProjectionObject()),5);
}

function renderName(val,metadata,rec) {
  metadata.attr = 'ext:qtip="' + val + '"';
  return val;
}

function renderUrl(val,metadata,rec) {
  return '<a target=_blank href="' + val + '">' + val + '</a>';
}

function getCaps(url,name) {

  function getCapsCallback(l,url,r) {
    delete pendingTransactions[url];
    var sos = new SOSCapabilities(new OpenLayers.Format.XML().read(r.responseText));
    if (sos.type === 'EXCEPTION') {
      Ext.Msg.alert('SOS exception',sos.exception_error);
      return;
    }
    for (var i = 0; i < sos.offerings.length; i++) {
      var f = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(sos.offerings[i].llon,sos.offerings[i].llat).transform(proj4326,map.getProjectionObject()));
      f.attributes = {
         type     : 'getCaps'
        ,offering : sos.offerings[i]
        ,dataset  : name
      };
      l.addFeatures(f);
    }
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
    map.addLayer(l);

    if (!hiliteCtl) {
      hiliteCtl = new OpenLayers.Control.SelectFeature(l,{
         hover         : true
        ,highlightOnly : true
        ,renderIntent  : 'temporary'
        ,eventListeners : {
          beforefeaturehighlighted : function(e) {
            if (mouseoverObs && mouseoverObs.isVisible()) {
              mouseoverObs.hide();
            }
            mouseoverObs = new Ext.ToolTip({
               html         : e.feature.attributes.dataset + ' : ' + e.feature.attributes.offering.shortName
              ,anchor       : 'bottom'
              ,target       : 'OpenLayers.Geometry.Point_' + (Number(e.feature.id.split('_')[e.feature.id.split('_').length - 1]) - 1)
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
      });
      map.addControl(hiliteCtl);
      hiliteCtl.activate();
    }
    else {
      var layers = [l];
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
    
    if (!popupCtl) {
      popupCtl = new OpenLayers.Control.SelectFeature(l,{
        eventListeners : {
          featurehighlighted : function(e) {
            if (popupObs && popupObs.isVisible()) {
              popupObs.hide();
            }
            var properties = getProperties(e.feature.attributes);
            var propertiesLinks = [];
            for (p in properties) {
              var shortP = p.split('/');
              shortP = shortP[shortP.length-1];
              shortP = shortP.substr(0,40) + (shortP.length > 40 ? '...' : '');
              propertiesLinks.push('<a href="#" onclick="getObs(\'' + e.feature.layer.name + '\',\'' + properties[p] + '\',\'' + p + '\',\'' + e.feature.attributes.offering.shortName + ' ' + e.feature.attributes.dataset + '\',' + e.feature.attributes.offering.llon + ',' + e.feature.attributes.offering.llat + ',true)">' + shortP + '</a>');
            }
            var tr = [
               '<td><b>time&nbsp;range</b></td><td>' + shortDateStringNoTime(isoDateToDate(e.feature.attributes.offering.begin_time)) + '&nbsp;\u2011&nbsp;' + shortDateStringNoTime(isoDateToDate(e.feature.attributes.offering.end_time)) + '</td>'
              ,'<td><b>properties</b></td><td>' + propertiesLinks.join(', ') + '</td>'
              ,'<td><b>dataset</b></td><td>' + e.feature.attributes.dataset + '</td>'
            ];
            popupObs = new Ext.ToolTip({
               title     : e.feature.attributes.dataset + ' : ' + e.feature.attributes.offering.shortName
              ,items     : {bodyCssClass : 'obsPopup',html : '<table><tr>' + tr.join('</tr><tr>') + '</tr></table>'}
              ,anchor    : 'bottom'
              ,width     : 345
              ,target    : 'OpenLayers.Geometry.Point_' + (Number(e.feature.id.split('_')[e.feature.id.split('_').length - 1]) - 1)
              ,autoHide  : false
              ,closable  : true
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
          }
        }
      });
      map.addControl(popupCtl);
      popupCtl.activate();
    }
    else {
      var layers = [l];
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

    logsStore.insert(0,new logsStore.recordType({
       type : 'GetCaps'
      ,name : name
      ,url  : url
      ,t    : 0
    }));

    OpenLayers.Request.issue({
       url      : url
//       url      : 'get.php?u=' + encodeURIComponent(url)
      ,callback : OpenLayers.Function.bind(getCapsCallback,null,l,url)
    });
  }
  else {
    l.setVisibility(true);
  }
}

function getObsCallback(property,name,url,r) {
  delete pendingTransactions[url];
  var sos = new SOSObservation(new OpenLayers.Format.XML().read(r.responseText));
  if (sos.type === 'EXCEPTION') {
    Ext.Msg.alert('SOS exception',sos.exception_error);
    return;
  }

  // Look to see if only one index outside of stationId and Time was pulled back.
  // If so, use it, and don't worry about a crosswalk.
  var properties = [];
  if (sos.observations.length > 0) {
    for (var i in sos.observations[0]) {
      if (!new RegExp(/^stationId|Time$/).test(i)) {
        properties.push(i);
      }
    }
  }
  if (properties.length == 1) {
    property = properties[0];
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
      d.push([t.getTime(),sos.observations[i][property]]);
    }
  }

  if (d.length > 0) {
    var uom = '';
    for (var i = 0; i < sos.fields.length; i++) {
      if (sos.fields[i].name == property) {
        uom = ' (' + sos.fields[i].uom + ')';
      }
    }
    chartData.push({
       data  : d
      ,label : property + ' ' + name + uom
      ,lines : {show : true}
    });
  }
  Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
}

function getObs(layerName,url,property,name,lon,lat,drill) {
  logsStore.insert(0,new logsStore.recordType({
     type : 'GetObs'
    ,name : name
    ,url  : url
    ,t    : 0
  }));

  OpenLayers.Request.issue({
     url      : 'get.php?u=' + encodeURIComponent(url)
    ,callback : OpenLayers.Function.bind(getObsCallback,null,property,name,url)
  });

  // if this is an obs, go find the nearest model point to plot
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
            if (p == property) {
              getObsFired = true;
              getObs(f.layer.name,properties[p],p,f.attributes.offering.shortName + ' ' + f.attributes.dataset,f.attributes.llon,f.attributes.llat,false);
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
                ,f.attributes.llon
                ,f.attributes.llat
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
                       fields : ['short','id','layerName','url','shortName','dataset','llon','llat']
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
                      getObs(rec.get('layerName'),rec.get('url'),rec.get('id'),rec.get('shortName') + ' ' + rec.get('dataset'),rec.get('llon'),rec.get('lat'),false);
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
  attr.offering.properties.sort();
  for (var i = 0; i < attr.offering.properties.length; i++) {
    p[attr.offering.properties[i]] = attr.offering.getObsUrl(attr.offering.properties[i]) + '&eventtime=2008-09-08T00:30:00Z/2008-09-16T00:00:00Z'; // '&eventtime=' + attr.offering.begin_time + '/' + attr.offering.end_time;
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
  var el = Ext.getCmp('transactionLogsButton');
  if (el) {
    if (hits > 0) {
      el.setIcon('img/blueSpinner.gif');
    }
    else {
      el.setIcon('img/file_extension_log.png');
    }
  }
  setTimeout('refreshTimer()', 1000);
}
