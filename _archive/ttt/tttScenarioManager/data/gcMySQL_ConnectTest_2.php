<?php

try {
    // Note: Saving credentials in environment variables is convenient, but not
    // secure - consider a more secure solution such as
    // Cloud Secret Manager (https://cloud.google.com/secret-manager) to help
    // keep secrets safe.
    $username = "'root'@'%'"; // e.g. 'your_db_user'
    $password = 'tdms4All!'; // e.g. 'your_db_password'
    $dbName = 'billtest'; // e.g. 'your_db_name'
    $instanceHost = '34.106.230.153'; // e.g. '127.0.0.1' ('172.17.0.1' for GAE Flex)

    // Connect using TCP
    $dsn = sprintf('mysql:dbname=%s;host=%s', $dbName, $instanceHost);

    // Connect to the database
    $conn = new PDO(
        $dsn,
        $username,
        $password,
        # ...
    );
} catch (TypeError $e) {
    throw new RuntimeException(
        sprintf(
            'Invalid or missing configuration! Make sure you have set ' .
                '$username, $password, $dbName, and $instanceHost (for TCP mode). ' .
                'The PHP error was %s',
            $e->getMessage()
        ),
        $e->getCode(),
        $e
    );
} catch (PDOException $e) {
    throw new RuntimeException(
        sprintf(
            'Could not connect to the Cloud SQL Database. Check that ' .
                'your username and password are correct, that the Cloud SQL ' .
                'proxy is running, and that the database exists and is ready ' .
                'for use. For more assistance, refer to %s. The PDO error was %s',
            'https://cloud.google.com/sql/docs/mysql/connect-external-app',
            $e->getMessage()
        ),
        $e->getCode(),
        $e
    );
}

?>