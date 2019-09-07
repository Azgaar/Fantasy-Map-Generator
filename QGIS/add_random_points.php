<?php

$max_deviation = 0.2;
$max_abs = 0.02;
$min_distance = 0.1;

$iterations = 4;

if ($argc < 2 ) {
    exit( "Usage: add_random_points.php <filename.json>\n" );
}

// FIXME: This script created a few cases of self-intersection that must be fixed manually
//          in QGIS: Vector -> Geometry Tools -> Check Validity

$cells = json_decode(file_get_contents($argv[1]), true);


for ($i=0; $i<$iterations; $i++) {
    $lookup = array();

    foreach ($cells['features'] as &$cell) {
        $points = $cell['geometry']['coordinates'][0];

        $prev = null;
        $newpoints = array();

        foreach ($points as $point) {
            if ($prev) {
                $distance = sqrt(pow($prev[0] - $point[0], 2) + pow($prev[1] - $point[1], 2));
                if ($distance == 0) continue;

                if ($distance > $min_distance) {
                    $id_a = $prev[0]."-".$prev[1];
                    $id_b = $point[0]."-".$point[1];

                    if (isset($lookup[$id_a."--".$id_b])) {
                        $newpoints[] = $lookup[$id_a."--".$id_b];
                    } elseif (isset($lookup[$id_b."--".$id_a])) {
                            $newpoints[] = $lookup[$id_b."--".$id_a];
                    } else {
                        $x = ($prev[0]+$point[0])/2.0;
                        $y = ($prev[1]+$point[1])/2.0;

                        $r = mt_rand() / mt_getrandmax(); // 0-1
                        $r = ($r+1) / 2; // 0.5 - 1.0

                        // if we define dx=x2-x1 and dy=y2-y1, then the normals are (-dy, dx) and (dy, -dx).
                        $dx = $point[0] - $x;
                        $dy = $point[1] - $y;

                        if (mt_rand() / mt_getrandmax() < 0.5) {
                            $x_off = -$dy;
                            $y_off = $dx;
                        } else {
                            $x_off = $dy;
                            $y_off = -$dx;
                        }

                        $x_off *= $r * $max_deviation;
                        $x_off = max(min($x_off, $max_abs), $max_abs*-1);

                        $y_off *= $r * $max_deviation;
                        $y_off = max(min($y_off, $max_abs), $max_abs*-1);

                        $p = array($x + $x_off, $y + $y_off);
                        $lookup[$id_a."--".$id_b] = $p;
                        $newpoints[] = $p;
                    }
                }
            }
            $newpoints[] = $point;
            $prev = $point;
        }
        $cell['geometry']['coordinates'][0] = $newpoints;
    }
}

echo json_encode($cells);

?>
