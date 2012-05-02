<?php

  function queryCatalog($title) {
    $xml = simplexml_load_string(
      file_get_contents(
         'http://testbedapps.sura.org/gi-cat/services/cswiso'
        ,false
        ,stream_context_create(array('http' => array(
           'method'  => 'POST'
          ,'header'  => 'Content-type: text/xml'
          ,'content' => str_replace('__TITLE__',$title,file_get_contents('post_template.xml'))
        )))
      )
    );

    $cswNs = 'http://www.opengis.net/cat/csw/2.0.2';
    $gmdNs = 'http://www.isotc211.org/2005/gmd';
    $srvNs = 'http://www.isotc211.org/2005/srv';
    $gcoNs = 'http://www.isotc211.org/2005/gco';
    $gmlNs = 'http://www.opengis.net/gml/3.2';

    $d = array();
    foreach ($xml->children($cswNs)->{'SearchResults'} as $searchResults) {
      foreach ($searchResults->children($gmdNs)->{'MD_Metadata'} as $mdMetadata) {
        $m = array();
        foreach ($mdMetadata->children($gmdNs)->{'identificationInfo'} as $identificationInfo) {
          foreach ($identificationInfo->children($gmdNs)->{'MD_DataIdentification'} as $dataIdentification) {
            $m['title'] = sprintf("%s",$dataIdentification->children($gmdNs)->{'citation'}[0]->children($gmdNs)->{'CI_Citation'}[0]->children($gmdNs)->{'title'}[0]->children($gcoNs)->{'CharacterString'});
          }
          foreach ($identificationInfo->children($srvNs)->{'SV_ServiceIdentification'} as $serviceIdentification) {
            if (sprintf("%s",$serviceIdentification->attributes()->{'id'}) == 'OGC-SOS') {
              $m['sosGetCaps'] = sprintf("%s",$serviceIdentification->children($srvNs)->{'containsOperations'}[0]->children($srvNs)->{'SV_OperationMetadata'}->children($srvNs)->{'connectPoint'}->children($gmdNs)->{'CI_OnlineResource'}->children($gmdNs)->{'linkage'}->children($gmdNs)->{'URL'});
              $eXGeographicBoundingBoxChildren = $serviceIdentification->children($srvNs)->{'extent'}[0]->children($gmdNs)->{'EX_Extent'}[0]->children($gmdNs)->{'geographicElement'}[0]->children($gmdNs)->{'EX_GeographicBoundingBox'}[0]->children($gmdNs);
              $m['sosGeographicBbox'] = array(
                 sprintf("%s",$eXGeographicBoundingBoxChildren->{'westBoundLongitude'}->children($gcoNs)->{'Decimal'})
                ,sprintf("%s",$eXGeographicBoundingBoxChildren->{'southBoundLatitude'}->children($gcoNs)->{'Decimal'})
                ,sprintf("%s",$eXGeographicBoundingBoxChildren->{'eastBoundLongitude'}->children($gcoNs)->{'Decimal'})
                ,sprintf("%s",$eXGeographicBoundingBoxChildren->{'northBoundLatitude'}->children($gcoNs)->{'Decimal'})
              );
              $timePeriodChildren = $serviceIdentification->children($srvNs)->{'extent'}[0]->children($gmdNs)->{'EX_Extent'}[0]->children($gmdNs)->{'temporalElement'}[0]->children($gmdNs)->{'EX_TemporalExtent'}[0]->children($gmdNs)->{'extent'}[0]->children($gmlNs)->{'TimePeriod'}->children($gmlNs);
              $m['sosTemporalBbox'] = array(
                 sprintf("%s",$timePeriodChildren->{'beginPosition'})
                ,sprintf("%s",$timePeriodChildren->{'endPosition'})
              );
            }
          } 
        }
        array_push($d,$m);
      }
    }
    
    return $d;
  }

  function fakeQueryCatalog($category) {
    $d = array();
    $col2idx = array();
    $f = fopen('catalog.csv','r');
    while (($csvData = fgetcsv($f)) !== FALSE) {
      if (count($col2idx) == 0) {
        foreach ($csvData as $k => $v) {
          $col2idx[$v] = count($col2idx);
        }
      }
      else {
        if ($category == $csvData[$col2idx['Category']]) {
          array_push($d,array(
             'title'             => $csvData[$col2idx['Title']]
            ,'sosGetCaps'        => $csvData[$col2idx['GetCapsUrl']].'?VERSION=1.0.0&SERVICE=SOS&REQUEST=GetCapabilities'
            ,'sosGeographicBbox' => array(-180,-90,180,90)
            ,'sosTemporalBbox'   => array('2008-09-08T00:30:00Z','2008-09-16T00:00:00Z')
          ));
        }
      }
    }

    return $d;
  }

?>
