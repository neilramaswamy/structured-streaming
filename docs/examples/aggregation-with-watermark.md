In this example, we'll discuss how to write an aggregation with a watermark. We'll then step through the example so you understand precisely how it works. You should read the following guides first:

- [Aggregations]()
- [Watermarks]()
- [Unit testing](../guides/testing/unit_testing.md)

## Write the code

As with all Structured Streaming code, you want to create a source, transform it, set stream options, and then write it to a sink. For ease of understanding examples, we'll use the file source and enhanced console sink, available in Spark 4.0 and higher. See the inline annotations for information about what we're doing.

=== "Python"

    ```python
    from pyspark.sql import SparkSession
    from pyspark.sql.types import StructType, StringType, TimestampType
    from pyspark.sql.functions import window, col
    from datetime import datetime

    assert(spark != None)

    schema = (StructType()
        .add("name", StringType())
        .add("timestamp", TimestampType()))

    source_path = "/tmp/streaming-agg"

    ts = datetime.fromtimestamp
    spark.createDataFrame(
        [("neil", ts(12)), ("ryan", ts(10))],
        schema
    ).write.mode("overwrite").parquet(source_path)

    df = (spark
        .readStream
        .format("parquet")
        .schema(schema)
        .option("path", source_path)
        .load())
    
    windowed_counts = (df
        .withWatermark("timestamp", "15 seconds")
        .groupBy(window(col("timestamp"), "10 seconds"))
        .count())

    query = (windowed_counts
        .writeStream
        .format("console") # (3)!
        .outputMode("append")
        .start())
    ```

    1. If you're in an interactive environment like a notebook or REPL, you likely don't need this line. You can test out whether you need it by typing `spark` into your REPL and verifying that there is no error.
    2. In PySpark, you have to explicitly _call_ (i.e. `()`) the SQL types. If you don't, you'll get an error
    3. Note: this prints to the driver's Log4J logs. In an interactive environment, you won't see them inline. Be sure to check the driver logs (from the SparkUI) to see these.

## Run your example

While it might be tempting to write a huge amount of data to your stream and see Spark work really quickly and reliably, when writing examples, it's imperative that you first test your code, as described in [Unit Testing](../guides/testing/unit_testing.md). You should pass small amounts of data through your stream and inspect the output; this way, you'll be able to precisely see how source data, operator transformations, watermarks, state, and resulting data _actually_ behave.o


After you run the code above, you should see the following in your console. Please see the inline annotations, which explain what precisely is going on:


```py
  |-------------------------------------------------|
  |              QUERY STATUS (Batch = 0)           |
  |-------------------------------------------------|
  |                    SINK ROWS                    |
  +-------------------------------------------+-----+
  | nothing in sink                                 |
  +-------------------------------------------+-----+
  |                   EVENT TIME                    |
  |-------------------------------------------------|
  | maxEventTime -> 12 seconds                      |
  | watermark -> 0 seconds                          | # (1)!
  | numDroppedRows -> 0                             |
  |-------------------------------------------------|
  |                    STATE ROWS                   |
  +-------------------------------------------+-----+
  |key                                        |value|
  +-------------------------------------------+-----+
  |{10 seconds, 20 seconds}                   |{2}  | # (2)!
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
    ).write.mode("append").parquet(source_path)

    query.processAllAvailable()
    ```

We choose a timestamp of `36` so that the watermark advances _just_ enough, so that the window is closed. To close the window, Structured Streaming runs two batches:

- The first batch processes all the data, which is reflected in the "max event-time seen"
- The next batch updates its watermark based on the previous batch's max event-time, and closes windows

As such, you should see the following:

```py
  |-------------------------------------------------|
  |              QUERY STATUS (Batch = 1)           |
  |-------------------------------------------------|
  |                    SINK ROWS                    |
  +-------------------------------------------+-----+
  | nothing in sink                                 |
  +-------------------------------------------+-----+
  |                   EVENT TIME                    |
  |-------------------------------------------------|
  | Max event time seen -> 36 seconds               |
  | Watermark -> 0 seconds                          |
  | Num dropped rows -> 0                           |
  |-------------------------------------------------|
  |                    STATE ROWS                   |
  +-------------------------------------------+-----+
  |key                                        |value|
  +-------------------------------------------+-----+
  |{10 seconds, 20 seconds}                   |{2}  |
  +-------------------------------------------+-----+
```

And immediately after that, you should see this:

```py
  |-------------------------------------------------|
  |             WRITES TO SINK (Batch = 2)          |
  +-------------------------------------------+-----+
  |window                                     |count|
  +-------------------------------------------+-----+
  |{10 seconds, 20 seconds}                   |2    | # (1)!
  +-------------------------------------------+-----+
  |                   EVENT TIME                    |
  |-------------------------------------------------|
  | Max event time seen -> N/A                      |
  | Watermark -> 21 seconds                         |
  | Num dropped rows -> 0                           |
  |-------------------------------------------------|
  |                    STATE ROWS                   |
  +-------------------------------------------+-----+
  |key                                        |value|
  +-------------------------------------------+-----+
  |{30 seconds, 40 seconds}                   |{1}  | # (3)!
  +-------------------------------------------+-----+
```

1.  This record gets emitted to the sink because the watermark of 21 seconds (see the next annotation) _exceeds_ the end of the window, 20 seconds.
2.  The watermark updates to 21 seconds, since the largest event-time is 36 seconds, and the engine subtracts of the watermark duration, 15 seconds.
3.  The `michael` record gets added into state for the 30 second to 40 second window.