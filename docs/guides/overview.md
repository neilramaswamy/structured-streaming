# Overview of Structured Streaming

Thesse guides are _opinionated_ articles that walk you through specific APIs and workflows. They primarily aim to give more clarity than precision; if you are looking for precision and nothing else, you'll want to look at the auto-generated documentation. In each guide, we link to the language-specific reference. For example, when linking to the top-level pages of the language-specific documentation, we'd show the following:

???+ abstract "API Reference"
    === "Python"
        :material-api: [`PySpark Reference`](https://spark.apache.org/docs/latest/api/python/index.html)
    
    === "Scala"
        :material-api: [`Scala Reference`](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/index.html)

    === "Java"
        :material-api: [`Java Reference`](https://spark.apache.org/docs/latest/api/java/)

For a very brief, example-oriented introduction to Structured Streaming, see the following example. On most lines, there is a button you can click that concisely explains what that line does and links you to the relevant guide.

=== "Python"

    ```python
    spark = (SparkSession #(1)!
        .builder
        .appName("DemoApp")
        .getOrCreate())
    
    source_df = (spark
        .readStream # (2)!
        .format("parquet") # (3)!
        .option("path", "s3a://demo-app/data") # (4)!
        .load()) # (5)!
    
    transformed_df = (source_df
        .filter("age > 25") # (6)!
        .withWatermark("timestamp", "15 minutes") # (7)!
        .groupBy(window("timestamp", "10 minutes")) # (8)!
        .count())
    
    query = (transformed_df
        .writeStream # (9)!
        .trigger(processingTime="1 minute") # (10)!
        .outputMode("update") # (11)!
        .option("checkpointLocation", "s3a://demo-app/checkpoint") # (12)!
        .format("parquet") # (13)!
        .option("path", "s3a://demo-app/sink") # (14)!
        .start()) # (15)!

    # Configure monitoring
    class QueryListener(StreamingQueryListener): # (16)!
        def onQueryProgress(self, event: QueryProgressEvent):
            print("Query made progress: ", event.progress)
    spark.streams.addListener(QueryListener())

    try:
        query.awaitTermination() # (17)!
    except Exception as e:
        # Send alert to your own service
        print(f"Got exception {e}")
    ```

    1. As with any Spark program, you construct a `SparkSession` object. See the [setup]() guide.
    2. You must call `spark.readStream` to get a `DataStreamReader`, which you use to configure your [source stream]().
    3. You specify the format of your source. This can be a directory of files (like Parquet), Kafka, etc.
    4. Every source has its own set of supported options. For the file source, the only required option is the `path` from which to read.
    5. Once you call `.load()` on a `DataStreamReader`, you get back a streaming `DataFrame`, where you effectively use the same API as batch Spark.
    6. This is the selection operator, one of many [stateless operators]().
    7. This line sets a [watermark](), which configures one of the few APIs that only exists on streaming `DataFrame`s. It effectively tells the engine how delayed data might be.
    8. This is the aggregation operator, one of the most common [stateful operators](). Here, it puts incoming records into 10-minute windows, based on the given record's `timestamp`.
    9. After you've applied all the operators you'd like, you must call `writeStream` on a `DataFrame` to get a `DataStreamWriter`, which you use to configure various stream options and set a sink to write the transformed records.
    10. Structured Streaming has a micro-batch architecture, and [triggers]() configure how frequently micro-batches run. In this case, we configure the engine to "trigger" a micro-batch every 1 minute.
    11. [Output mode]() configures what records operators write out each trigger.
    12. To maintain fault-tolerance, Structured Streaming writes its progress through the source stream (and other data) to a durable, cloud storage-backed directory called the [checkpoint location]().
    13. On a `DataStreamWriter`, you can configure the [sink]() that Structured Streaming writes its data to.
    14. Just like sources, every sink has its own set of supported options. For the file sink, we must specify a `path` to which to write results.
    15. After you have configured your stream and set a sink, you call `.start()` to start it on your cluster. This returns a `StreamingQuery`.
    16. You can configure a `StreamingQueryListener` to handle various callbacks from the streaming query. In this case, we configure a listener to handle the event `onQueryProgress`, which is called at the end of each trigger, to `#!python print()` the metrics for that trigger.
    17. You can [wait for your query to terminate](../guides/operations/lifecycle.md) by calling `query.awaitTermination()`. However, this method will throw an exception if your query has a runtime exception, so its wise to wrap this call in a `try`/`catch`.

There are a few concepts not explicitly mentioned in this brief overview. In particular, you should be aware of the following:

- There are many more operators than just `.filter` and `.groupBy`. See the sections on [stateless operators](), [stateful operators](), and [custom streaming logic]().
- Structured Streaming uses key-value stores called [state stores](./stream_options/state_stores.md) to manage state created by operators.
- To tune the performance of your Structured Streaming jobs, see [performance tuning]().
