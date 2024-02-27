One of the most important parts of writing Structured Streaming queries is testing your code. For new users, the act of writing tests can turn you into a streaming expert; for expert users, writing tests is a quick way to sanity check your work.

## Basic Approach

The basic approach to writing Structured Streaming unit-tests will be the same across all programming languages:

1. Create a query that reads from a source you can write to easily, like the file source
2. Write your Spark code (i.e. stateless, stateful, or custom operators)
3. Configure your query to write to the memory sink 

Then, repeatedly, you will want to take the following steps:

1. Write a few records to the source you configured earlier
2. Wait for your query to process all those records
3. Read the memory sink as a `DataFrame`, and assert that it is equal to what you expect
4. Optionally, you can write assertions about the metrics from the [streaming query's progress](../operations/query_progress.md)

## Examples

=== "Python"

    To setup your query, we're first going to read from a local directory of Parquet files. The choice of using Parquet is arbitrary; you can use any file format described in the [file source reference](../io/sources.md#file-source):

    ```python
    import os
    from pyspark.sql.types import StructType, StringType, TimestampType

    assert(spark != None)

    # The directory from which your query will incrementally read files
    SOURCE_PATH = "/tmp/my-unit-test"
    os.makedirs(SOURCE_PATH, exist_ok=True)

    # The file sources require a schema up-front
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

    Next, we'll want to use streaming Spark operators. In this example, we'll use a filter and a windowed aggregation, but you could also use other stateless operators, deduplication, stream-stream joins, etc.

    ```python hl_lines="1 5-9"
    from pyspark.sql.functions import window, col

    # -- snip -- (1)

    windowed_counts = (df
        .withWatermark("timestamp", "15 seconds")
        .groupBy(window(col("timestamp"), "10 seconds"))
        .count()
    )
    ```

    1. The "snip" statement indicates that we're excluding code from the previous code block (to avoid repeating ourselves).

    The final step we need to setup our query is to write it to the [memory sink](). The memory sink provides us a convenient way to read the output of our Structured Streaming query.

    ```python
    # -- snip --
    QUERY_NAME = "my_unit_test"

    query = (windowed_counts
        .writeStream
        .format("memory") 
        .queryName(QUERY_NAME)
        .start()
    )
    ```

    Now, our query is running. At this point, we can progress to repeatedly writing data to our source and making assertions about our sink. Recall that we have a 10-second tumbling window aggregation with a 15 second watermark. If we write two records between 10 seconds and 20 seconds to our source, we shouldn't see anything in our sink (if this is unclear, read up on the [aggregation operator]()).

    ```python
    # -- snip -- 
    from datetime import datetime

    # A utility function to convert from seconds to timestamps
    # ts(1) -> 1970 00:00:01, 1 second after the UNIX epoch
    ts = datetime.fromtimestamp

    spark.createDataFrame(
        [("dog", ts(12)), ("cat", ts(17))],
        schema
    ).write.mode("overwrite").parquet(SOURCE_PATH)

    # Make sure we wait for the micro-batch(es) to finish
    query.processAllAvailable()

    # Write an assertion about the sink
    assert(spark.table(QUERY_NAME).count() == 0)
    ```

    Now, let's say that we add another record that causes the window from 10 to 20 to close. Since the watermark is 15 seconds, such a record would need to have timestamp greater than 20 + 15, 35. So, we add just that:

    ```python
    # -- snip -- 
    import pyspark.testing.assertDataFrameEqual

    spark.createDataFrame(
        [("bird", ts(36))],
        schema
    ).write.mode("append").parquet(SOURCE_PATH)

    query.processAllAvailable()

    assert(spark.table(QUERY_NAME).count() == 1)
    ```

    You'll notice that in all of our examples, we just make an assertion about the output table's length. In practice, you should be doing `DataFrame` comparison, but that's slightly out of scope for this guide.

    For a reference on how to do `DataFrame` comparison, you can check [the PySpark reference](https://spark.apache.org/docs/latest/api/python/reference/api/pyspark.testing.assertDataFrameEqual.html) or use a 3rd party testing library, such as [Chispa](https://github.com/MrPowers/chispa).



