# Deduplication

Data sources frequently have duplicate records. This occurs because many data systems only have _at-least-once_ guarantees, which means that the same record can get delivered to the source system multiple times. For example, a web server might be trying to send a write to a database cluster. If that web server has a retry mechanism that isn't idempotent, that record could be produced and written multiple times. The result is duplicate records in the source, that we want to eliminate within the stream, where practical.

To accomplish this, a method for deduplication of streaming data is needed. You can deduplicate on one or more columns, and then pass the columns on which you want to deduplicate data to one of the following deduplication methods.


## What are the deduplication methods?

Spark has two deduplication methods:

- `dropDuplicatesWithinWatermark`: This method holds onto duplicates for at least as much time as the watermark duration in your streaming job. As a result, this method performs state removal (using the watermark). Deduplication using a watermark is more scalable than without watermarking because less memory is required as the watermark places a timne-based bound on the amount of memory required for deduplication.
- `dropDuplicates`: This method is used when you want _global_ deduplication across your entire stream. Global deduplication is unbounded by time and requires an unbounded amount of memory. It is therefore less scalable.

!!! warning
    Do not use the `dropDuplicates method unless you are sure that your data stream has low cardinality. Otherwise, you may encounter out of memory errors.


???+ abstract "API Reference"

    === "Python"
        :material-api: [`dropDuplicatesWithinWatermark`](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.dropDuplicatesWithinWatermark.html)

        :material-api: [`dropDuplicates`](https://spark.apache.org/docs/3.1.2/api/python/reference/api/pyspark.sql.DataFrame.dropDuplicates.html)
    
    === "Scala"
        :material-api: [`dropDuplicatesWithinWatermark`](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/Dataset.html#dropDuplicatesWithinWatermark(col1:String,cols:String*):org.apache.spark.sql.Dataset%5BT%5D)

        :material-api: [`dropDuplicates`](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/Dataset.html#dropDuplicates(col1:String,cols:String*):org.apache.spark.sql.Dataset%5BT%5D)
    
    === "Java"
        :material-api: [`dropDuplicatesWithinWatermark`](https://spark.apache.org/docs/latest/api/java/index.html?org/apache/spark/sql/Dataset.html)

        :material-api: [`dropDuplicates`](https://spark.apache.org/docs/latest/api/java/index.html?org/apache/spark/sql/Dataset.html)

    === "R"
        :material-api: [`dropDuplicates`](https://spark.apache.org/docs/latest/api/R/reference/dropDuplicates.html)

## Local deduplication with `dropDuplicatesWithinWatermark`

The `dropDuplicatesWithinWatermark` method should be your first choice for deduplication when you know the interval of time within which you might receive duplicates. <!-- (TODO: is this true? what do people use to figure this out?) --> If you know that you'll have duplicates within a `k` minute interval, you can instruct Structured Streaming to hold onto records for `k` minutes, within which this method performs deduplication. Structured Streaming also removes the records that have been around for more than `k` minutes, so that it doesn't hold onto an infinite number of records and consume large amounts of memory to hold those records.

For example, suppose we know that we'll have duplicates within 5 minutes of each other. If we receive a record, `ID = foo`, with event-time 6, we might receive duplicates up to event-time 5+6 = 11. What tool tells Structured Streaming when we're out of the "danger" zone of receiving an event-time before 11?

??? success "See answer"
    Watermarks tell Structured Streaming when its done receiving events before a certain time (in this case, time 11).
    
    If duplicates for the record `ID = foo` can arrive up until time 11, once Structured Streaming knows that it'll no longer receive event-times _before_ time 11, Structured Streaming knows to purge that record. That's where the name `dropDuplicatesWithinWatermark` comes from: for at least as many units of time within your watermark delay, Structured Streaming performs deduplication.

??? example
 
    === "Python"

        ``` python
                
        spark = SparkSession. ...

        # deduplicate using guid column with watermark based on eventTime column
        streamingDf \
            .withWatermark("eventTime", "10 hours") \
            .dropDuplicatesWithinWatermark("guid")
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        // deduplicate using guid column with watermark based on eventTime column
        streamingDf
            .withWatermark("eventTime", "10 hours")
            .dropDuplicatesWithinWatermark("guid")        
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        // deduplicate using guid column with watermark based on eventTime column
        streamingDf
            .withWatermark("eventTime", "10 hours")
            .dropDuplicatesWithinWatermark("guid");        
        ```

    === "R"
        Not available in R.

For an end-to-end example showing state removal, see [aggregation example](/examples/aggregation-with-watermark).

### When you might still have duplicates

When deduplicating with a watermark, you might have duplicates that arrive _after_ your watermark's maximum delay. In our example, another record with `ID = foo` that arrives after event-time 11 is _not_ deduplicated. If you have strict deduplication requirements, you have two options:

- Keep state for longer via a larger watermark delay (a larger watermark means more records arrive _within_ your watermark).
- Keep state forever, using `dropDuplicates`.

## Global deduplication with `dropDuplicates`

The `dropDuplicates` method allows you deduplicate over _all_ records of the stream. Since streams are unbounded, this means that `dropDuplicates` can deduplicate over an unbounded number of records, by keeping all the records in state. This behavior has pros and cons:

- **Pro**: Total deduplication.
- **Con**: Potential out-of-memory errors. If you have enough records, you'll run out of space to store records and cause a machine crash.

!!! danger
    For this reason of unbounded state growth, `dropDuplicates` is one of the Spark operators that does not cleanly transfer over from the batch APIs to the streaming APIs. If you have a batch job with `dropDuplicates` and you want to migrate it to a streaming job, modify your query use `dropDuplicatesWithinWatermark`.

With that out of the way, here's the syntax for it. You just pass it the columns, as strings, on which you want to deduplicate:

??? note "Historical note"
    Before `dropDuplicatesWithinWatermark` was introduced in Spark 3.5.0, we used to suggest deduplication with state removal by passing an event-time column to `dropDuplicates`. This still works, but we highly recommend using `dropDuplicatesWithinWatermark` instead; it's far less error-prone.

??? example
 
    === "Python"

        ``` python
                
        spark = SparkSession. ...

        # Without watermark using guid column
        streamingDf.dropDuplicates("guid")

        # With watermark using guid and eventTime columns
        streamingDf \
            .withWatermark("eventTime", "10 seconds") \
            .dropDuplicates("guid", "eventTime")  
  
        ```

    === "Scala"

        ```scala

        val spark: SparkSession = ...

        // Without watermark using guid column
        streamingDf.dropDuplicates("guid")

        // With watermark using guid and eventTime columns
        streamingDf
            .withWatermark("eventTime", "10 secon        
        ```

    === "Java"

        ```java

        SparkSession spark = ...

        // Without watermark using guid column
        streamingDf.dropDuplicates("guid");

        // With watermark using guid and eventTime columns
        streamingDf
            .withWatermark("eventTime", "10 seconds")
            .dropDuplicates("guid", "eventTime");        
        ```

    === "R"

        ```r

        sparkR.session(...)

        # Without watermark using guid column
        streamingDf <- dropDuplicates(streamingDf, "guid")

        # With watermark using guid and eventTime columns
        streamingDf <- withWatermark(streamingDf, "eventTime", "10 seconds")
        streamingDf <- dropDuplicates(streamingDf, "guid", "eventTime")        
        ```
