# Sinks

Structured Streaming writes its results to a sink that you specify.

## Built-in sinks

Structured Streaming supports the following production sinks out-of-the-box:

- **File sink** - Stores the output to a specified directory and format. Supports exactly-once fault tolerance.
- **Kafka sink** - Stores the output to one or more topics in Kafka. Supports at-least-once fault tolerance.
- **ForeachBatch sink** - Allows you to specify a function that is executed on the output data of every micro-batch of a streaming query. Fault tolerance depends upon the implementation. <!--not clear what this means-->
- **Foreach sink** - Allows custom write logic on every row of a streaming query. Supports at-least-once fault tolerance.
- **Console sink (for debugging)** - Prints the output to the console/stdout every time there is a trigger. Both, Append and Complete output modes, are supported. This should be used for debugging purposes on low data volumes as the entire output is collected and stored in the driver’s memory after every trigger.  Never use this in production, since it isn't fault-tolerant.
- **Memory sink (for debugging)** - he output is stored in memory as an in-memory table. Both, Append and Complete output modes, are supported. This should be used for debugging purposes on low data volumes as the entire output is collected and stored in the driver’s memory. Hence, use it with caution. This sink isn't fault-tolerant. However, in Complete Mode, a restarted query recreates the full table.

## Sink reference

Not all [output modes](../stream_options/output_mode.md#available-output-modes) are supported by every sink.

### File sink

Only supports Append output mode. The file sink supports writes to partitioned tables. Partitioning by time may be useful. For file-format-specific options, see the related methods in DataFrameWriter for [Scala](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/DataFrameWriter.html), [Java](https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/DataFrameWriter.html), [Python](https://spark.apache.org/docs/latest/api/python/reference/pyspark.ss/api/pyspark.sql.streaming.DataStreamWriter.html#pyspark.sql.streaming.DataStreamWriter), and [R](https://spark.apache.org/docs/latest/api/R/write.stream.html). <!--R reference is invalid - but did not find a good link -->

??? info "Supported Options"
    |  Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    |  `path`                  | The path to the output directory. | None | Yes |
    | `retention` | time to live (TTL) for output files. Output files which batches were committed older than TTL will be eventually excluded in metadata log. This means reader queries which read the sink's output directory may not process them. You can provide the value as string format of the time. (like "12h", "7d", etc.) | Disabled | No | <!--Neil to do - investigate what this means-->

??? example 
    === "Python"

        ```python

        spark = SparkSession. ...

        # Write new data to Parquet files
        fileDF \
            .writeStream \
            .format("parquet")        // can be "orc", "json", "csv", etc. \
            .option("checkpointLocation", "path/to/checkpoint/dir") \
            .option("path", "path/to/destination/dir") \
            .start()
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        // Write new data to Parquet files
        fileDF
        .writeStream
        .format("parquet")       // can be "orc", "json", "csv", etc. 
        .option("checkpointLocation", "path/to/checkpoint/dir")
        .option("path", "path/to/destination/dir")
        .start()
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        // Write new data to Parquet files
        fileDF
        .writeStream()
        .format("parquet")      // can be "orc", "json", "csv", etc.
        .option("checkpointLocation", "path/to/checkpoint/dir")
        .option("path", "path/to/destination/dir")
        .start();
        ```

    === "R"

        ```r

        sparkR.session(...)

        # Write new data to Parquet files
        write.stream(fileDF,
            "parquet",     # can be "orc", "json", "csv", etc.
            path = "path/to/destination/dir",
            checkpointLocation = "path/to/checkpoint/dir")
        ```

### Kafka sink

Supports Append, Update, Complete output modes. 

See the [Kafka Integration Guide](https://spark.apache.org/docs/latest/structured-streaming-kafka-integration.html) for the supported options and examples.

### ForeachBatch sink

Supports Append, Update, Complete output modes. 

The `foreachBatch` sink allows you to specify a function that is executed on the output data of every micro-batch of a streaming query. Since Spark 2.4, this is supported in Scala, Java and Python. It takes two parameters: a DataFrame or Dataset that has the output data of a micro-batch and the unique ID of the micro-batch.

??? example 
    === "Python"

        ```python

        spark = SparkSession. ...

        def foreach_batch_function(df, epoch_id):
            # Transform and write batchDF
            pass

        streamingDF.writeStream.foreachBatch(foreach_batch_function).start()
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        streamingDF.writeStream.foreachBatch 
            { (batchDF: DataFrame, batchId: Long) =>
            // Transform and write batchDF
            }.start()
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        streamingDatasetOfString.writeStream().foreachBatch(
        new VoidFunction2<Dataset<String>, Long>() {
            public void call(Dataset<String> dataset, Long batchId) {
            // Transform and write batchDF
            }
        }
        ).start();
        ```

    === "R"

        ```r

        R is not yet supported.

        ```

With `foreachBatch`, you can do the following.

- **Reuse existing batch data sources** - For many storage systems, there may not be a streaming sink available yet, but there may already exist a data writer for batch queries. Using `foreachBatch`, you can use the batch data writers on the output of each micro-batch.
- **Write to multiple locations** - If you want to write the output of a streaming query to multiple locations, then you can simply write the output DataFrame/Dataset multiple times. However, each attempt to write can cause the output data to be recomputed (including possible re-reading of the input data). To avoid recomputations, you should cache the output DataFrame/Dataset, write it to multiple locations, and then uncache it.
- **Apply additional DataFrame operations** - Many DataFrame and Dataset operations are not supported in streaming DataFrames because Spark does not support generating incremental plans in those cases. Using `foreachBatch`, you can apply some of these operations on each micro-batch output. However, you will have to reason about the end-to-end semantics of doing that operation yourself.

    !!! note 
        By default, `foreachBatch` provides only at-least-once write guarantees. However, you can use the `batchId` provided to the function as way to deduplicate the output and get an exactly-once guarantee.
        
        `foreachBatch` does not work with the continuous processing mode as it fundamentally relies on the micro-batch execution of a streaming query. If you write data in the continuous mode, use `foreach` instead.

### Foreach sink

Supports Append, Update, Complete output modes.

If `foreachBatch` is not an option (for example, corresponding batch data writer does not exist, or continuous processing mode), then you can express your custom writer logic using `foreach`. Specifically, you can express the data writing logic by dividing it into three methods: open, process, and close. Since Spark 2.4, `foreach` is available in Scala, Java and Python.

??? example 
    === "Python"

        ```python

        spark = SparkSession. ...

        # In Python, you can invoke foreach in two ways: in a function or in an object. 
        # The function offers a simple way to express your processing logic.
        # But, it does not allow you to deduplicate generated data when failures cause reprocessing of some input data. 
        # For that situation you must specify the processing logic in an object.

        # First, the function takes a row as input.
        def process_row(row):
        # Write row to storage
            pass

        query = streamingDF.writeStream.foreach(process_row).start()

        # Second, the object has a process method and optional open and close methods.
        class ForeachWriter:
            def open(self, partition_id, epoch_id):
                # Open connection. This method is optional in Python.
                pass

            def process(self, row):
                # Write row to connection. This method is NOT optional in Python.
                pass

            def close(self, error):
                # Close the connection. This method in optional in Python.
                pass

        query = streamingDF.writeStream.foreach(ForeachWriter()).start()
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        # In Scala, you have to extend the class ForeachWriter. See https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/ForeachWriter.html

        streamingDatasetOfString.writeStream.foreach(
            new ForeachWriter[String] {

                def open(partitionId: Long, version: Long): Boolean = {
                // Open connection
                }

                def process(record: String): Unit = {
                // Write string to connection
                }

                def close(errorOrNull: Throwable): Unit = {
                // Close the connection
                }
            }
        ).start()
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        # In Java, you have to extend the class ForeachWriter. See https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/ForeachWriter.html
        
        streamingDatasetOfString.writeStream().foreach(
            new ForeachWriter<String>() {

                @Override public boolean open(long partitionId, long version) {
                // Open connection
                }

                @Override public void process(String record) {
                // Write string to connection
                }

                @Override public void close(Throwable errorOrNull) {
                // Close the connection
                }
            }
        ).start();
        ```

    === "R"

        ```r

        R is not yet supported.

        ```

When the streaming query is started, Spark calls the function or the object’s methods in the following way:

- A single copy of this object is responsible for all the data generated by a single task in a query. In other words, one instance is responsible for processing one partition of the data generated in a distributed manner.

- This object must be serializable, because each task will get a fresh serialized-deserialized copy of the provided object. Hence, it is strongly recommended that any initialization for writing data (for example, opening a connection or starting a transaction) is done after the open method has been called, which signifies that the task is ready to generate data.

- The lifecycle of the methods are as follows:

    - For each partition with `partition_id`:

        - For each batch/epoch of streaming data with `epoch_id`:

            - Method `open(partitionId, epochId)` is called.

            - If `open` returns true, for each row in the partition and batch/epoch, method process(row) is called.

            - Method `close(error)` is called with error (if any) seen while processing rows.

- The `close` method (if it exists) is called if an `open` method exists and returns successfully (irrespective of the return value), except if the JVM or Python process crashes in the middle.

!!! note
    Spark does not guarantee same output for (partitionId, epochId), so deduplication cannot be achieved with (partitionId, epochId). For example, source provides different number of partitions for some reasons, Spark optimization changes number of partitions, etc. See [SPARK-28650](https://issues.apache.org/jira/browse/SPARK-28650) for more details. If you need deduplication on output, try out `foreachBatch` instead.

### Console sink

Supports Append, Update, Complete output modes.

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    |  `numRows` | Number of rows to print every trigger | 20 | No |
    | `truncate` | Whether to truncate the output if too long | True | No |

??? example 
    === "Python"

        ```python

        spark = SparkSession. ...

        # Print new data to console
        consoleDF \
            .writeStream \
            .format("console") \
            .start()
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        // Print new data to console
        consoleDF
            .writeStream
            .format("console")
            .start()
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        // Print new data to console
        consoleDF
        .writeStream()
            .format("console")
            .start();
        ```

    === "R"

        ```r

        sparkR.session(...)

        # Print new data to console
        write.stream(consoleDF, "console")
        ```

### Memory sink

Supports Append, Update, Complete output modes.

??? example 
    === "Python"

        ```python

        spark = SparkSession. ...

        # Write new data to memory
        writeStream
            .format("memory")
            .queryName("tableName")
            .start()
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        // Write new data to memory
        writeStream
            .format("memory")
            .queryName("tableName")
            .start()
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        // Write new data to memory
        writeStream
            .format("memory")
            .queryName("tableName")
            .start()
        ```

    === "R"

        ```r

        sparkR.session(...)

        # Write new data to memory
        write.stream("memory", queryName ="tableName")
        ```
