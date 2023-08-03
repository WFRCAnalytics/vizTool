<?php

try {
    // Note: Saving credentials in environment variables is convenient, but not
    // secure - consider a more secure solution such as
    // Cloud Secret Manager (https://cloud.google.com/secret-manager) to help
    // keep secrets safe.
    $username = 'root'; // e.g. 'your_db_user'
    $password = 'tdms4All!'; // e.g. 'your_db_password'
    $dbName = 'billtest'; // e.g. 'your_db_name'
    $servername = '34.106.46.2'; // e.g. '127.0.0.1' ('172.17.0.1' for GAE Flex)
    
    // Connect using TCP
    //$dsn = sprintf('mysql:dbname=%s;host=%s', $dbName, $instanceHost);

    // Connect to the database
    $conn = new PDO("mysql:host=$servername;dbname=myDB", $username, $password);
    // set the PDO error mode to exception
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo ($conn);
}  catch (PDOException $err) {
    echo "ERROR : Unable to connect: " . $err->getMessage();
}

?>