<?php
  include_once('utils.php');

  header('Content-type:application/json');

  date_default_timezone_set('UTC');
  $today = mktime(0,0,0);

  $eventTime = explode('/',$_REQUEST['eventtime']);
  $eventTime = array(
     strtotime($eventTime[0])
    ,strtotime($eventTime[1])
  );

  $providers = explode(',',$_REQUEST['providers']);

  $models = array();
  $obs    = array();
  $grids  = array();

  if (in_array('gomaine',$providers)) {
    array_push($models,array(
       'name' => 'model.elevation_gomaine.nc'
      ,'url'  => 'xml/elevation_gomaine.xml'
      // ,'url' => 'http://mcqueen.gomoos.org:8080/oostethys/sos?VERSION=1.0.0&SERVICE=SOS&REQUEST=GetCapabilities'
      ,'minT' => strtotime(date('Y-m-d',$today).'T'.date('H:i:s',$today).'Z')
      ,'maxT' => strtotime(date('Y-m-d',$today + 3600 * 24 * 2).'T'.date('H:i:s',$today + 3600 * 24 * 2).'Z')
      ,'properties' => array(
        'Water level' => array(
           'prop'        => 'http://mmisw.org/cf/parameter/water_level'
          ,'getObsExtra' => '&result=VerticalDatum==urn:ioos:def:datum:noaa::MSL'
        )
      )
    ));
  }

  if (in_array('sura',$providers)) {
/*
    $q = queryCatalog('Imeds CRMS watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.IMEDS');
    for ($i = 0; $i < count($q); $i++) {
      array_push($models,array(
         'name' => 'model.'.$q[$i]['title']
        ,'url'  => $q[$i]['sosGetCaps'].'&useCache=true'
        ,'minT' => strtotime($q[$i]['sosTemporalBbox'][0])
        ,'maxT' => strtotime($q[$i]['sosTemporalBbox'][1])
        ,'properties' => array(
          'Water level' => array(
             'prop'        => 'watlev'
            ,'getObsExtra' => '&result=VerticalDatum==urn:ogc:def:datum:epsg::5103'
          )
        )
      ));
    }
    $q = queryCatalog('Imeds CRMS watlev_CRMS_2008.F.C.IMEDS');
    for ($i = 0; $i < count($q); $i++) {
      array_push($obs,array(
         'name' => 'obs.'.$q[$i]['title']
        ,'url'  => $q[$i]['sosGetCaps'].'&useCache=true'
        ,'minT' => strtotime($q[$i]['sosTemporalBbox'][0])
        ,'maxT' => strtotime($q[$i]['sosTemporalBbox'][1])
        ,'properties' => array(
          'Water level' => array(
             'prop'        => 'watlev'
            ,'getObsExtra' => '&result=VerticalDatum==urn:ogc:def:datum:epsg::5103'
          )
        )
      ));
    }
*/

    $q = fakeQueryCatalog('Simulation');
    for ($i = 0; $i < count($q); $i++) {
      array_push($models,array(
         'name' => 'model.'.$q[$i]['title']
        ,'url'  => $q[$i]['sosGetCaps'].'&useCache=true'
        ,'minT' => strtotime($q[$i]['sosTemporalBbox'][0])
        ,'maxT' => strtotime($q[$i]['sosTemporalBbox'][1])
        ,'properties' => array(
          'Water level' => array(
             'prop'        => 'watlev'
            ,'getObsExtra' => '&result=VerticalDatum==urn:ogc:def:datum:epsg::5103'
          )
        )
      ));
    }

    $q = fakeQueryCatalog('Measurement');
    for ($i = 0; $i < count($q); $i++) {
      array_push($obs,array(
         'name' => 'obs.'.$q[$i]['title']
        ,'url'  => $q[$i]['sosGetCaps'].'&useCache=true'
        ,'minT' => strtotime($q[$i]['sosTemporalBbox'][0])
        ,'maxT' => strtotime($q[$i]['sosTemporalBbox'][1])
        ,'properties' => array(
          'Water level' => array(
             'prop'        => 'watlev'
            ,'getObsExtra' => '&result=VerticalDatum==urn:ogc:def:datum:epsg::5103'
          )
        )
      ));
    }
  }

  if (in_array('coops',$providers)) {
    array_push($obs,array(
       'name' => 'obs.coops'
      ,'url'  => 'xml/coops.xml'
      // ,'url' => 'http://opendap.co-ops.nos.noaa.gov/ioos-dif-sos/SOS?service=SOS&request=GetCapabilities'
      ,'minT' => '1970-02-01T00:00Z'
      ,'maxT' => strtotime(date('Y-m-d',$today + 3600 * 24 * 2).'T'.date('H:i:s',$today + 3600 * 24 * 2).'Z')
      ,'properties' => array(
        'Water level' => array(
           'prop'        => 'http://mmisw.org/ont/cf/parameter/water_surface_height_above_reference_datum'
          ,'getObsExtra' => ''
        )
      )
    ));
  }

  if (in_array('eds',$providers)) {
    array_push($grids,array(
       'name' => 'grid.NOAA NGOM : Sea surface elevation'
      ,'url'  => 'http://testbedapps.sura.org/ncWMS/wms?COLORSCALERANGE=-0.5,1.0'
      ,'lyr'  => 'noaa_ngom/zeta'
      ,'stl'  => 'boxfill/rainbow'
      ,'sgl'  => true
      ,'leg'  => 'http://testbedapps.sura.org/ncWMS/wms?TRANSPARENT=true&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&EXCEPTIONS=application/vnd.ogc.se_xml&FORMAT=image/gif&LAYER=noaa_ngom/zeta&TIME=&COLORSCALERANGE=-0.5,1.0&STYLES=boxfill/rainbow'
      ,'minT' => strtotime('2008-09-11T00:00:00.000Z')
      ,'maxT' => strtotime('2008-09-13T22:00:00.000Z')
      ,'varName'  => 'Sea surface elevation'
      ,'varUnits' => 'm'
      ,'abstract' => 'No information available.'
      ,'bbox'    => '-180,-90,180,90'
    ));

    array_push($grids,array(
       'name' => 'grid.SLOSH - Ike - GOM : Water Surface Height Above Reference Datum'
      ,'url'  => 'http://testbedapps.sura.org/thredds/wms/inundation/mdl/slosh/ike/gom?COLORSCALERANGE=-0.5,1.0'
      ,'lyr'  => 'eta'
      ,'stl'  => ''
      ,'sgl'  => true
      ,'leg'  => 'http://testbedapps.sura.org/thredds/wms/inundation/mdl/slosh/ike/gom?TRANSPARENT=true&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&EXCEPTIONS=application/vnd.ogc.se_xml&FORMAT=image/gif&LAYER=eta&TIME=&COLORSCALERANGE=-0.5,1.0'
      ,'minT' => strtotime('2008-09-11T00:00:00.000Z')
      ,'maxT' => strtotime('2008-09-13T22:00:00.000Z')
      ,'varName'  => 'Sea surface elevation'
      ,'varUnits' => 'm'
      ,'abstract' => 'No information available.'
      ,'bbox'    => '-180,-90,180,90'
    ));

    array_push($grids,array(
       'name' => 'grid.FVCOM Mass Bay'
      ,'url'  => 'http://coastmap.com/ecop/wms.aspx?EXCEPTIONS=application/vnd.ogc.se_xml'
      ,'lyr'  => 'FVCOM_MASS_CURRENTS'
      ,'stl'  => 'CURRENTS_RAMP-Jet-False-1-True-0-2-High'
      ,'sgl'  => true
      ,'leg'  => 'http://coastmap.com/ecop/wms.aspx?FORMAT=image/png&TRANSPARENT=TRUE&STYLES=CURRENTS_RAMP-Jet-False-1-True-0-2-High&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&TIME=&SRS=EPSG:3857&LAYERS=FVCOM_MASS_CURRENTS'
      ,'minT' => strtotime(date('Y-m-d',$today).'T'.date('H:i:s',$today).'Z')
      ,'maxT' => strtotime(date('Y-m-d',$today + 3600 * 24 * 2).'T'.date('H:i:s',$today + 3600 * 24 * 2).'Z')
      ,'abstract' => 'FVCOM is a prognostic, unstructured-grid, finite-volume, free-surface, 3-D primitive equation coastal ocean circulation model developed by UMASSD-WHOI joint efforts. The model consists of momentum, continuity, temperature, salinity and density equations and is closed physically and mathematically using turbulence closure submodels. The horizontal grid is comprised of unstructured triangular cells and the irregular bottom is preseented using generalized terrain-following coordinates. The General Ocean Turbulent Model (GOTM) developed by Burchardâresearch group in Germany (Burchard, 2002) has been added to FVCOM to provide optional vertical turbulent closure schemes. FVCOM is solved numerically by a second-order accurate discrete flux calculation in the integral form of the governing equations over an unstructured triangular grid. This approach combines the best features of finite-element methods (grid flexibility) and finite-difference methods (numerical efficiency and code simplicity) and provides a much better numerical representation of both local and global momentum, mass, salt, heat, and tracer conservation.  The ability of FVCOM to accurately solve scalar conservation equations in addition to the topological flexibility provided by unstructured meshes and the simplicity of the coding structure has make FVCOM ideally suited for many coastal and interdisciplinary scientific applications.'
      ,'bbox'    => '-72,39,-70,44'
      ,'customize' => array(
         'imageQuality' => 7
        ,'baseStyle'    => 0
        ,'colorMap'     => 1
        ,'striding'     => 3
        ,'barbLabel'    => 2
        ,'tailMag'      => 4
        ,'min'          => 5
        ,'max'          => 6
        ,'minMaxBounds' => '0-6'
      )
    ));
  }


  $data = array();
  if ($_REQUEST['type'] == 'models') {
    for ($i = 0; $i < count($models); $i++) {
      if ($eventTime[0] <= $models[$i]['maxT'] && $eventTime[1] >= $models[$i]['minT']) {
        array_push($data,$models[$i]);
      }
    }
  }
  if ($_REQUEST['type'] == 'obs') {
    for ($i = 0; $i < count($obs); $i++) {
      if ($eventTime[0] <= $obs[$i]['maxT'] && $eventTime[1] >= $obs[$i]['minT']) {
        array_push($data,$obs[$i]);
      }
    }
  }
  if ($_REQUEST['type'] == 'grids') {
    for ($i = 0; $i < count($grids); $i++) {
      if ($eventTime[0] <= $grids[$i]['maxT'] && $eventTime[1] >= $grids[$i]['minT']) {
        array_push($data,$grids[$i]);
      }
    }
  }

  echo json_encode(array('data' => $data));
?>
