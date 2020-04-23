<?php
header("Content-type: text/plain");
echo "received:";
var_dump(file_get_contents('php://input'));
print_r($_POST);
?>