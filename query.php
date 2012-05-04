<?php
  include_once('utils.php');

  header('Content-type:application/json');

  date_default_timezone_set('UTC');
  $today = mktime(0,0,0);

  $eventTime = explode('/',$_REQUEST['eventtime']);
  $eventTime = array(
     $eventTime[0]
    ,$eventTime[1]
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
      ,'minT' => date('Y-m-d',$today).'T'.date('H:i:s',$today).'Z'
      ,'maxT' => date('Y-m-d',$today + 3600 * 24 * 2).'T'.date('H:i:s',$today + 3600 * 24 * 2).'Z'
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
        ,'minT' => $q[$i]['sosTemporalBbox'][0]
        ,'maxT' => $q[$i]['sosTemporalBbox'][1]
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
        ,'minT' => $q[$i]['sosTemporalBbox'][0]
        ,'maxT' => $q[$i]['sosTemporalBbox'][1]
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
        ,'minT' => $q[$i]['sosTemporalBbox'][0]
        ,'maxT' => $q[$i]['sosTemporalBbox'][1]
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
        ,'minT' => $q[$i]['sosTemporalBbox'][0]
        ,'maxT' => $q[$i]['sosTemporalBbox'][1]
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
      ,'maxT' => date('Y-m-d',$today + 3600 * 24 * 2).'T'.date('H:i:s',$today + 3600 * 24 * 2).'Z'
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
       'name' => 'grid.Waves'
      ,'url'  => 'http://coastmap.com/ecop/wms.aspx'
      ,'lyr'  => 'WW3_WAVE_HEIGHT'
      ,'minT' => date('Y-m-d',$today).'T'.date('H:i:s',$today).'Z'
      ,'maxT' => date('Y-m-d',$today + 3600 * 24 * 2).'T'.date('H:i:s',$today + 3600 * 24 * 2).'Z'
    ));
  }


  $data = array();
  if ($_REQUEST['type'] == 'models') {
    for ($i = 0; $i < count($models); $i++) {
      if ((strtotime($eventTime[0]) <= strtotime($models[$i]['maxT'])) && (strtotime($eventTime[1]) >= strtotime($models[$i]['minT']))) {
        array_push($data,$models[$i]);
      }
    }
  }
  if ($_REQUEST['type'] == 'obs') {
    for ($i = 0; $i < count($obs); $i++) {
      if ((strtotime($eventTime[0]) <= strtotime($obs[$i]['maxT'])) && (strtotime($eventTime[1]) >= strtotime($obs[$i]['minT']))) {
        array_push($data,$obs[$i]);
      }
    }
  }
  if ($_REQUEST['type'] == 'grids') {
    for ($i = 0; $i < count($grids); $i++) {
      if ((strtotime($eventTime[0]) <= strtotime($grids[$i]['maxT'])) && (strtotime($eventTime[1]) >= strtotime($grids[$i]['minT']))) {
        array_push($data,$grids[$i]);
      }
    }
  }

  echo json_encode(array('data' => $data));
?>
