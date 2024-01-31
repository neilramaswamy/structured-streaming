In this example, we'll discuss how to write an aggregation with a watermark. We'll then step through the example so you understand precisely how it works. You should read the following guides first:

- [Aggregations]()
- [Watermarks]()
- [Unit testing](../guides/testing/unit_testing.md)

## Writing the code

As with all Structured Streaming code, you want to create a source, transform it, set stream options, and then write it to a sink. For ease of understanding examples, we'll use the file source and enhanced console sink, available in Spark 4.0 and higher. See the inline annotations for information about what we're doing.

=== "Python"

    ```python
    from pyspark.sql import SparkSession
    from pyspark.sql.types import StructType, StringType, TimestampType
    from pyspark.sql.functions import window, col

    spark = SparkSession.builder.appName("streaming-agg").getOrCreate() # (1)!

    schema = (StructType()
        .add("name", StringType()) # (2)!
        .add("timestamp", TimestampType()))

    source_path = "/tmp/streaming-agg"

    df = (spark
        .readStream
        .format("parquet")
        .schema(schema)
        .option("path", source_path)
        .load())
    
    windowed_counts = (df
        .withWatermark("timestamp", "15 minutes")
        .groupBy(window(col("timestamp"), "30 minutes"))
        .count())

    query = (windowed_counts
        .writeStream
        .format("console") # (3)!
        .outputMode("append")
        .start())
    ```

    1. If you're in an interactive environment like a notebook, you likely don't need this line. You can test out whether you need it by typing `spark` into your REPL and verifying that there is no error.
    2. In PySpark, you have to explicitly _call_ (i.e. `()`) the SQL types. If you don't, you'll get an error
    3. Note: this prints to the driver's Log4J logs. In an interactive environment, you won't see them inline. Be sure to check the driver logs (from the SparkUI) to see these.

=== "Scala"

    ```scala
    import org.apache.spark.sql.SparkSession
    import org.apache.spark.sql.types.{StructType, StringType, TimestampType}
    import org.apache.spark.sql.functions.window

    val spark = SparkSession.builder.appName("streaming-agg").getOrCreate()

    val schema = new StructType()
        .add("name", StringType)
        .add("timestamp", TimestampType)

    val sourcePath = "/tmp/streaming-agg"

    val df = spark
        .readStream
        .format("parquet")
        .schema(schema)
        .option("path", sourcePath)
        .load()

    val windowedCounts = df
        .withWatermark("timestamp", "15 minutes")
        .groupBy(window($"timestamp", "30 minutes"))
        .count()

    val query = windowedCounts
        .writeStream
        .format("console")
        .outputMode("append")
        .start()
    ```

## Running your example

While it might be tempting to write a huge amount of data to your stream and see Spark work really quickly and reliably, when writing examples, it's imperative that you first test your code, as described in [Unit Testing](../guides/testing/unit_testing.md). You should pass small amounts of data through your stream and inspect the output; this way, you'll be able to precisely see how source data, operator transformations, watermarks, state, and resulting data _actually_ behave.o

To that end, we'll start with by writing a small amount of data to our source directory, using the `parquet` file format:


=== "Python"

    ```python
    from datetime import datetime

    # The rest of your code goes here

    ts = datetime.fromtimestamp

    spark.createDataFrame(
        [("neil", ts(12)), ("ryan", ts(10))],
        schema
    ).write.mode("overwrite").parquet(local_source_path)

    query.processAllAvailable()
    ```

After you run this, you should see the following in your console. Please see the inline annotations, which explain what precisely is going on:


```scala
  |-------------------------------------------------|
  |              QUERY STATUS (Batch = 0)           |
  |-------------------------------------------------|
  |                    SINK ROWS                    |
  +-------------------------------------------+-----+
  | nothing in sink                                 |
  +-------------------------------------------+-----+
  |                    WATERMARK                    |
  |-------------------------------------------------|
  | value -> 0 seconds                              | // (1)!
  | numDroppedRows -> 0                             |
  |-------------------------------------------------|
  |                    STATE ROWS                   |
  +-------------------------------------------+-----+
  |key                                        |value|
  +-------------------------------------------+-----+
  |{10 seconds, 20 seconds}                   |{2}  | // (2)!
  +-------------------------------------------+-----+
```

1. Since the maximum event-time is 12 seconds (from record `neil`), the engine subtracts the watermark delay (15 seconds) from 12 seconds and yields a negative number. However, watermarks must be at least 0 seconds, so it "rounds up" to 0.
2. Nothing has been written to the sink, since the watermark hasn't crossed the end of the window that ends at 20 seconds. However, the `value` is 2, since 2 records, `neil` and `ryan`, are buffered in state.


Now, let's add one more record so that the watermark advances past the _end_ of the 20 seconds and emits the window from 10 to 20 seconds:

=== "Python"

    ```python
    # Your earlier code goes here
    spark.createDataFrame(
        [("michael", ts(36))],
        schema
    ).write.mode("append").parquet(local_source_path)

    query.processAllAvailable()
    ```

We choose a timestamp of `36` so that the watermark advances _just_ enough, so that the window is closed:


```scala
  |-------------------------------------------------|
  |             WRITES TO SINK (Batch = 1)          |
  +-------------------------------------------+-----+
  |window                                     |count|
  +-------------------------------------------+-----+
  |{10 seconds, 20 seconds}                   |2    | // (1)!
  +-------------------------------------------+-----+
  |                    WATERMARK                    |
  |-------------------------------------------------|
  | value -> 21 seconds                             | // (2)!
  | numDroppedRows -> 0                             |
  |-------------------------------------------------|
  |                    STATE ROWS                   |
  +-------------------------------------------+-----+
  |key                                        |value|
  +-------------------------------------------+-----+
  |{30 seconds, 40 seconds}                   |{1}  | // (3)!
  +-------------------------------------------+-----+
```

1. This record gets emitted to the sink because the watermark of 21 seconds (see the next annotation) _exceeds_ the end of the window, 20 seconds.
2. The watermark updates to 21 seconds, since the largest event-time is 36 seconds, and the engine subtracts of the watermark duration, 15 seconds.
3. The `michael` record gets added into state for the 30 second to 40 second window.