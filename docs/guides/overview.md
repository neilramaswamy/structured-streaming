The guides in this section are _opinionated_ articles that aim to walk users through specific APIs and workflows. They primarily aim to give more clarity than precision; if you are looking for precision and nothing else, please see the auto-generated documentation here (TODO).

All of these guides assume that you have gone through the [Tour](../tour/welcome.md). If you don't already know what you're looking for, here's generally the approach you should take to use Structured Streaming end-to-end, with inlined links to the relevant guides:

=== "Python"

    ```python
    spark = (SparkSession #(1)!
        .builder
        .appName("DemoApp")
        .getOrCreate())
    
    source_df = (spark
        .readStream # (2)!
        .format("parquet") # (3)!
        .option("path", "s3a://demo-app/data")
        .load()) # (4)!
    
    transformed_df = (source_df
        .filter("age > 25") # (5)!
        .withWatermark("timestamp", "15 minutes") # (6)!
        .groupBy(window("timestamp", "10 minutes")) # (7)!
        .count())
    
    query = (transformed_df
        .writeStream # (8)!
        .trigger(processingTime="1 minute") # (9)!
        .outputMode("update") # (10)!
        .option("checkpointLocation", "s3a://demo-app/checkpoint") # (11)!
        .format("parquet") # (12)!
        .start()) # (13)!

    # Configure monitoring
    class QueryListener(StreamingQueryListener): # (14)!
        def onQueryProgress(self, event: QueryProgressEvent):
            print("Query made progress: ", event.progress)
    spark.streams.addListener(QueryListener())

    try: # (15)!
        query.awaitTermination()
    except Exception as e:
        # Send alert to your own service
        print(f"Got exception {e}")
    ```

    1. Hello world?
    2. Hello world?
    3. Hello world?
    4. Hello world?
    5. Hello world?
    6. Hello world?
    7. Hello world?
    8. Hello world?
    9. Hello world?
    10. Hello world?
    11. Hello world?
    12. Hello world?
    13. Hello world?
    14. Hello world?
    15. Hello world?

- Connect to a [source](./connectors/sources.md)
- Once you have a `DataFrame`, you can apply [stateless](), [stateful](), or [custom operators]()
- After transformations, you can configure your stream in many ways:
    - Set a [checkpoint location](./stream_options/checkpointing.md) for fault tolerance
    - Choose how frequently your stream runs with [triggers](./stream_options/triggers.md)
    - For stateful queries, choose the [output mode](./stream_options/output_mode.md) and [state store]()
- Then, you can write your results to a [sink](./connectors/sinks.md)
- You can start/stop/pause your stream with [lifecycle operations]()
- You can [manage streaming queries]() in your `SparkSession`, including starting and stopping individual queries
- Now you're ready for production. You can:
    - Proactively [handle exceptions]()
    - Configure [metrics and monitoring]()
    - Mitigate performance issues with [performance tuning]()
