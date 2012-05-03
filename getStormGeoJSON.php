<?php
  header('Content-type: application/json');
  $s = file_get_contents('stormTrack.dat/'.$_REQUEST['storm'].'.dat');

  $p = split('/',$_REQUEST['eventtime']);
  $tRange = array(
     strtotime($p[0])
    ,strtotime($p[1])
  );

  $features = array();
  $coords   = array();
  foreach (split("\n",$s) as $line) {
    $line = ltrim($line);
    $p = preg_split("/ +/",$line);
    if (count($p) >= 7 && $p[0] != 'ADV') {
      $dt = split('/',$p[3]);
      $d  = array(
         'lon' => $p[2]
        ,'lat' => $p[1]
        ,'t'   => strtotime(sprintf("%d-%d-%d %d:00 UTC",$_REQUEST['year'],$dt[0],$dt[1],str_replace('Z','',$dt[2])))
        ,'cat' => implode(' ',array_slice($p,6))
      );
      if ($tRange[0] <= $d['t'] && $d['t'] <= $tRange[1]) {
        array_push($features,array(
           'type'     => 'Feature'
          ,'geometry' => array(
             'type'        => 'Point'
            ,'coordinates' => array(
               $d['lon']
              ,$d['lat']
            )
          )
          ,'properties'  => array(
             'storm'      => $_REQUEST['storm']
            ,'t'          => $d['t']
            ,'cat'        => $d['cat']
          )
        ));
      }
      array_push($coords,array($d['lon'],$d['lat']));
    }
  }

  array_unshift($features,array(
     'type'     => 'Feature'
    ,'geometry' => array(
       'type'        => 'LineString'
      ,'coordinates' => $coords
    )
    ,'properties'  => array(
       'storm' => $_REQUEST['storm']
    )
  ));

  echo json_encode($features);
?>
