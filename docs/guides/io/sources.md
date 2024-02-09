# Sources

All Structured Streaming queries start with defining a source, some place from which to read a stream of data (such as Apache Kafka). When you _load_ a source (which we'll show shortly), you'll get back a _streaming DataFrame_, which is a [Spark DataFrame](https://spark.apache.org/docs/latest/sql-programming-guide.html#datasets-and-dataframes) that can be incrementally processed.

## What are the built-in data sources?

Structured Streaming supports the following production sources out-of-the-box:

- **File source** - Reads the files from a directory. Files are processed in the order of the file modification time. Supported file formats are: text, CSV, JSON, ORC, and Parquet. Streaming from a file source enables you to keep your structured data in cloud storage, which is cheaper than storing your data in some other type of location, such as a relational database.
- **Kafka source** - Reads data from a Kafka-compatible broker, such as a Confluent cluster or Azure EventHubs.

!!! note
    Some Spark vendors support additional production sources. See your vendor's documentation.

Structured Streaming also supports the following non-production sources for testing purposes:

- **Socket source**: Reads UTF-8 text data from a socket connection into a streaming DataFrame. Never use this in production, since it isn't fault-tolerant[^1].
- **Rate source**: Generates data at the specified number of rows _per second_ into a streaming DataFrame to test performance. This source is useful when load testing your jobs, since it allows you to easily generate thousands of rows per second.
- **Rate source per micro-batch**: Generates data at the specified number of rows _per micro-batch_ into a streaming DataFrame for performance testing. Unlike the rate data source, this data source provides a consistent set of input rows per micro-batch regardless of query execution (such as query lagging or trigger configuration).

[^1]:
    A source is fault-tolerant if it is able to replay data in the case of failure. The socket source doesn't persist the data it receives, so it can't replay data. The file source and Kafka source both support replay, so they are considered fault-tolerant.

Each of these sources support many options. See [Source reference](#source-reference). 

!!! tip
    You can also use the file source as a testing source, rather than the socket source. To do this, create static DataFrames via `spark.createDataFrame` and write them to a specific directory on your system. Then, read those files using a Structured Streaming job with the `files` source.

## Source reference

Expand the supported options boxes for each source type to find the specific option name and its supported values.

### File source

The name for the file source format is one of the following:`csv`, `text`, `JSON`, or `Parquet`. In addition to the generically supported options for any file type, there is documentation of file-format-specific options for [Parquet](https://spark.apache.org/docs/latest/sql-data-sources-parquet.html), [ORC](https://spark.apache.org/docs/latest/sql-data-sources-orc.html), [JSON](https://spark.apache.org/docs/latest/sql-data-sources-json.html), [CSV](https://spark.apache.org/docs/latest/sql-data-sources-csv.html), and [text files](https://spark.apache.org/docs/latest/sql-data-sources-text.html).

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `path`                  | The path to the input directory. Glob paths are supported, but multiple comma-separated globs are not supported.                                                           | None            | Yes         |
    | `maxFilesPerTrigger`    | The maximum number of new files to be considered in every trigger.                                     | None      | No          |
    | `latestFirst`           | Whether to process the latest new files first. This is useful when there is a large backlog of files.      | False           | No          |
    | `fileNameOnly`          | Whether to check new files based on only the filename instead of on the full path. With this set to `true`, the following files are considered as the same file: `file:///dataset.txt` and `s3://a/dataset.txt`.                                                  | False           | No          |
    | `maxFileAge`            | All files older than this age are ignored. For the first batch though, all files are considered valid. If `latestFirst` is set to `true`, `maxFilesPerTrigger` takes precedence over `maxFilesAge`. The max age is specified with respect to the timestamp of the latest file, and not the current system time.                                                                                              | 7 days          | No |
    | `cleanSource`           | Whether to clean up files after processing. Available options are: `archive`, `delete`, and `off`. The `delete` option deletes files permanently. The `archive` option copies files to the `sourceArchiveDir`; if the source file is `/a/data.txt` and the archive directory is `/archive`, the file is moved to `/archive/a/data.txt`.                                                       | None | No |
    | `sourceArchiveDir`      | Specifies the archive directory for cleaned-up files. It cannot be a sub-directory of `path`; if it were, archived files would be considered new and processed over and over again.                 | None | Only if `cleanSource` is set to `archive`. |

??? example 
    === "Python"

        ```python

        spark = SparkSession. ...

        # Read all the csv files written atomically in a directory
        userSchema = StructType().add("name", "string").add("age", "integer")
        fileDF = (spark
            .readStream
            .format("csv")
            .schema(userSchema)
            .option("path", "/path/to/directory")
            .option("sep", ";")
            .load()
        )
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        // Read all the csv files written atomically in a directory
        val userSchema = new StructType().add("name", "string").add("age", "integer")
        val csvDF = spark
            .readStream
            .format("csv")
            .schema(userSchema)      // Specify schema of the csv files
            .option("path", "/path/to/directory")
            .option("sep", ";")
            .load()
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        // Read all the csv files written atomically in a directory
        StructType userSchema = new StructType().add("name", "string").add("age", "integer");
        Dataset<Row> csvDF = spark
            .readStream()
            .format("csv")
            .schema(userSchema)      // Specify schema of the csv files
            .option("path", "/path/to/directory")
            .option("sep", ";")
            .load()
        ```

    === "R"

        ```r

        sparkR.session(...)

        # Read all the csv files written atomically in a directory
        schema <- structType(structField("name", "string"), structField("age", "integer"))
        csvDF <- read.stream("csv", path = "/path/to/directory", schema = schema, sep = ";")

        ```

!!! note 
    The previous CSV examples for the file source specify the separator (`sep`) for the data in the CSV file. Specifying a seperator is only required for the CSV file source. It is not required for any of the other file sources.

### Kafka source

The Kafka source is named `kafka`. It's compatible with Kafka broker versions 0.10.0 or higher. See the [Kafka Integration Guide](https://spark.apache.org/docs/latest/structured-streaming-kafka-integration.html) for the supported options and examples.

### Socket source

The socket source is named `socket`. The listening server socket is at the driver.

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `host` | The string of the host to connect to, such as localhost. | None | Yes |
    | `port` | The integer of the host to connect to, such as 9999. | None | Yes |

??? example

    === "Python"

        ```python

        spark = SparkSession. ...

        # Read text from socket
        socketDF = spark \
            .readStream \
            .format("socket") \
            .option("host", "localhost") \
            .option("port", 9999) \
            .load()
        ```
    === "Scala"
        ```scala

        val spark: SparkSession = ...

        // Read text from socket
        val socketDF = spark
            .readStream
            .format("socket")
            .option("host", "localhost")
            .option("port", 9999)
            .load()
        ```

    === "Java"

        ```java
        SparkSession spark = ...

        // Read text from socket 
        Dataset<Row> socketDF = spark
            .readStream()
            .format("socket")
            .option("host", "localhost")
            .option("port", 9999)
            .load();
        ```
    === "R"
        ```r

        sparkR.session(...)

        # Read text from socket
        socketDF <- read.stream("socket", host = hostname, port = port)
        ```

### Rate Source

The name for the rate source format is `rate`. Each output row contains a timestamp and value, where timestamp is a `timestamp` data type containing the time of message dispatch, and value is of `long` data type containing the message count, starting from 0 as the first row.

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `rowsPerSecond` | How many rows should be generated per second. | 1 | No |
    | `rampUpTime` | How long to ramp up before the generating speed becomes `rowsPerSecond`. Using finer granularities than seconds truncates to integer seconds. This option is not supported with the continuous mode trigger. | 0 | No |
    | `numPartitions` | The number of partitions for the generated rows. The source will try its best to reach `rowsPerSecond`, but the query may be resource constrained. `numPartitions` can be tweaked to help reach the desired speed.| Spark's default parallelism[^2] | No | 
    
??? example
    === "Python"

        ```python

        spark = SparkSession. ...

        # Create a streaming DataFrame
        df = spark.readStream \
            .format("rate") \
            .option("rowsPerSecond", 10) \
            .load()

        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        // Create a streaming DataFrame
        val df = spark.readStream
            .format("rate")
            .option("rowsPerSecond", 10)
            .load()
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        // Create a streaming DataFrame
        Dataset<Row> df = spark.readStream()
            .format("rate")
            .option("rowsPerSecond", 10)
            .load();
        ```

    === "R"
        Not available in R.

### Rate source per micro-batch

The name for the rate source per micro-batch format is `rate-micro-batch`. Each output row contains a timestamp and value, where timestamp is a `timestamp` data type containing the time of message dispatch, and value is of `long` data type containing the message count, starting from 0 as the first row. For example, batch 0 produces values 0~999 and batch 1 produces values 1000~1999, and so on. Every record produced has a different message count value and a different generated time stamp, even across partitions.

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `rowsPerBatch` |  How many rows should be generated per micro-batch. | 0 | No |
    | `numPartitions` | The partition number for the generated rows. | Spark's default parallelism[^2] | No |
    | `startTimestamp` | Starting value of generated time. | 0 | No |
    | `advanceMillisPerBatch` | The number of milliseconds being advanced in generated time on each micro-batch. | 1000 | No |

??? example
    === "Python"

        ```python

        spark = SparkSession. ...

        # Create a streaming DataFrame
        df = spark.readStream \
            .format("rate-micro-batch") \
            .option("rowsPerBatch", 10) \
            .load()
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        // Create a streaming DataFrame
        val df = spark.readStream
            .format("rate-micro-batch")
            .option("rowsPerBatch", 10)
            .load()
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        // Create a streaming DataFrame
        Dataset<Row> df = spark.readStream()
            .format("rate-micro-batch")
            .option("rowsPerBatch", 10)
            .load();
        ```

    === "R"
        Not available in R.

[^2]:
    Default parallelism refers to `spark.sql.shuffle.partitions`. It defaults to 200 as of Spark 3.4, but may change in future releases.
