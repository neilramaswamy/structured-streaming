One of the most important parts of writing Structured Streaming queries is testing your code. For new users, the act of writing tests can turn you into a streaming expert; for expert users, writing tests is a quick way to sanity check your work.

## Basic Approach

The basic approach to writing Structured Streaming unit-tests is the same across all programming languages:

1. Create a query that reads from a source you can write to easily, such as the file source.
2. Write your Spark code.
3. Configure your query to write to the memory sink.

Then, repeatedly, take the following steps:

1. Write a few records to the source.
2. Wait for your query to process the records.
3. Read the memory sink as a `DataFrame`, and assert that it is equal to what you expect.
4. Optionally, you can write assertions about the metrics from the [streaming query's progress](../operations/query_progress.md).

## Examples

To setup your query, start by reading from a local directory of Parquet files. The choice of using Parquet is arbitrary; you can use any file format described in the [file source reference](../io/sources.md#file-source):

=== "Python"

    ```python
    import os
    from pyspark.sql.types import StructType, StringType, TimestampType

    assert(spark != None)

    # The directory from which your query incrementally reads files
    SOURCE_PATH = "/tmp/my-unit-test"
    os.makedirs(SOURCE_PATH, exist_ok=True)

    # The file source will require a schema, so we are defining one here.
    schema = (
        StructType()
            .add("name", StringType())
            .add("timestamp", TimestampType())
    )

    df = (spark
        .readStream
        .format("parquet")
        .schema(schema)
        .option("path", SOURCE_PATH)
        .load()
    )



    ```
=== "Scala"

    ```scala
    import org.apache.spark.sql.types.{StructType, StringType, TimestampType}
    import java.nio.file.{Files, Paths}

    // Ensure the Spark session is initialized
    assert(spark != null)

    // The directory from which your query incrementally reads files
    val SOURCE_PATH = "/tmp/my-unit-test"
    Files.createDirectories(Paths.get(SOURCE_PATH))

    // The file source will require a schema, so we are defining one here.
    val schema = (new StructType()
        .add("name", StringType)
        .add("timestamp", TimestampType))

    val df = (spark
        .readStream
        .format("parquet")
        .schema(schema)
        .option("path", SOURCE_PATH)
        .load())

    ```

Next, define your streaming Spark operators. In this example, we'll use a filter and a windowed aggregation, but you could also use other operators (such as stateless operators, deduplication, stream-stream joins, etc.).

=== "Python"

    ```python
    from pyspark.sql.functions import window, col

    windowed_counts = (df
        .withWatermark("timestamp", "15 seconds")
        .groupBy(window(col("timestamp"), "10 seconds"))
        .count()
    )

    ```

=== "Scala"

    ```scala
    import org.apache.spark.sql.functions.{window, col}

    val windowed_counts = (df
        .withWatermark("timestamp", "15 seconds")
        .groupBy(window(col("timestamp"), "10 seconds"))
        .count())

    ```

The final step is to set up the query to write to the [memory sink](). The memory sink provides us a convenient way to read the output of the Structured Streaming query via Spark APIs.

=== "Python"

    ```python
    QUERY_NAME = "my_unit_test"

    query = (windowed_counts
        .writeStream
        .format("memory") 
        .queryName(QUERY_NAME)
        .start()
    )

    ```

=== "Scala"

    ```scala
    val QUERY_NAME = "my_unit_test"

    val query = (windowed_counts
        .writeStream
        .format("memory")
        .queryName(QUERY_NAME)
        .start())

    ```

Now, the query is running. At this point, you can progress to repeatedly writing data to your source and making assertions about the sink. Recall that you have defined a 10-second tumbling window aggregation with a 15 second watermark. If you write two records between 10 seconds and 20 seconds to your source, you shouldn't see anything in your sink. See [aggregation operator]() and [watermark]().

=== "Python"

    ```python
    from datetime import datetime

    # A utility function to convert from seconds to timestamps
    # ts(1) -> 1970 00:00:01, 1 second after the UNIX epoch
    ts = datetime.fromtimestamp

    spark.createDataFrame(
        [("dog", ts(12)), ("cat", ts(17))],
        schema
    ).write.mode("overwrite").parquet(SOURCE_PATH)

    # Wait for the micro-batch(es) to finish before continuing
    query.processAllAvailable()

    # Write an assertion about the sink
    assert(spark.table(QUERY_NAME).count() == 0)
    ```

=== "Scala"

    ```scala
    import java.sql.Timestamp

    // We need these to create test data
    import org.apache.spark.sql.Row
    import scala.collection.JavaConverters._

    // A utility function to convert from seconds to timestamps
    // ts(1) -> 1970 00:00:01, 1 second after the UNIX epoch
    def ts(seconds: Long): Timestamp = new Timestamp(seconds * 1000)

    spark.createDataFrame(
        Seq(Row("dog", ts(12)), Row("cat", ts(17))).asJava,
        schema
    ).write.mode("overwrite").parquet(SOURCE_PATH)

    // Wait for the micro-batch(es) to finish before continuing
    query.processAllAvailable()

    // Write an assertion about the sink
    assert(spark.table(QUERY_NAME).count() == 0)

    ```

Now, let's say that you add another record that causes the window from 10 to 20 to close. Since the watermark is 15 seconds, such a record must have timestamp greater than 20 + 15, 35. So, add such a timestamp:

=== "Python"

    ```python
    spark.createDataFrame(
        [("bird", ts(36))],
        schema
    ).write.mode("append").parquet(SOURCE_PATH)

    query.processAllAvailable()

    assert(spark.table(QUERY_NAME).count() == 1)

    ```

=== "Scala"

    ```scala
    spark.createDataFrame(
        Seq(Row("bird", ts(36))).asJava,
        schema
    ).write.mode("append").parquet(SOURCE_PATH)

    query.processAllAvailable()

    assert(spark.table(QUERY_NAME).count() == 1)

    ```

You'll notice that in all of these examples, you are making an assertion about the output table's length. In practice, you should be doing `DataFrame` comparison, but that's out of scope for this guide.

For a reference on how to do `DataFrame` comparison, see the [PySpark reference](https://spark.apache.org/docs/latest/api/python/reference/api/pyspark.testing.assertDataFrameEqual.html) or use a 3rd party testing library, such as [Chispa](https://github.com/MrPowers/chispa).
