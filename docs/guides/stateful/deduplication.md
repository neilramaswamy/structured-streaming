# Depuplication

Very frequently, data sources have duplicate records. This mostly happens because many data systems only have at-least-once guarantees, so the same record can get delivered multiple times. For example, a web server might be trying to send a write to a database cluster; if the web server has a retry mechanism that isn't idempotent, it could produce that record many times. In that case, those records records would be duplicated!

As a result, deduplication of streams is needed. You can deduplicate on one or more columns, and you can simply pass the columns on which you want to deduplicate to a deduplication function. There are two such deduplication functions:

- `dropDuplicatesWithinWatermark`: this function will hold onto duplicates for at-least as much time as the watermark duration in your job. As a result, it will perform state removal (using the watermark), which is good for scalability.
- `dropDuplicates`: this function should be used when you want _global_ deduplication across your entire stream. Beware! Global deduplication requires unbounded amounts of memory, so unless you're sure your stream is low-cardinality, don't use this!

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




## Local deduplication with `dropDuplicatesWithinWatermark`

This is the deduplication operator you should reach for first. Most of the time with duplication, you know ahead of time the interval of time within which you might receive duplicates <!-- (TODO: is this true? what do people use to figure this out?) -->. If you know that you'll have duplicates within a `k` minute interval, you can instruct Structured Streaming to hold onto records for `k` minutes, within which it will perform deduplication. It will also remove the records that have been around for more than `k` minutes, so that it doesn't hold onto an infinite number of records.

For example, suppose we know that we'll have duplicates within 5 minutes of each other. If we receive a record, `ID = foo`, with event-time 6, we might receive duplicates up to event-time 5+6 = 11. So, take a moment to think: what tool tells us when we're out of the "danger" zone of receiving an event-time before 11?

??? success "See answer"
    Watermarks, by definition, are the tool that tell us when we're done receiving events before a certain time (in this case, time 11).
    
    If duplicates for the record can arrive up until 11, once we know that we'll no longer receive event-times _before_ 11, we can purge that record. That's where the name `dropDuplicatesWithinWatermark` comes from: for at least as many units of time as your watermark delay (i.e. _within_ your watermark delay), Structured Streaming will perform deduplication.

For an end-to-end example showing state removal, please see the [deduplication example]().

### When you might still have duplicates

There is one subtlety when deduplicating with a watermark: you might have duplicates that arrive _after_ your watermark's maximum delay.In our example, another record with ID `foo` that arrives after event-time 11 will _not_ be deduplicated. If you have strict deduplication requirements, you have two options:

1. Keep state for longer via a larger watermark delay (a larger watermark means more records arrive _within_ your watermark)
2. Keep state forever, using `dropDuplicates`, which is explained below

## Global deduplication with `dropDuplicates`

This function has a special power, but it must be wielded with care: `dropDuplicates` allows you deduplicate over _all_ records of the stream. Since streams are unbounded, this means that `dropDuplicates` can deduplicate over an unbounded number of records, by keeping all the records it sees in state. This behavior has an upside and a downside:

1. Upside: you get perfect, total deduplication!
2. Downside: it has to store every record in state. If you have enough records, you'll run out of space to store records. Your machines will then crash, due to Out-of-Memory errors.

!!! danger
    For this reason of unbounded state growth, `dropDuplicates` is one of the operators that does not cleanly transfer over from the batch APIs to the streaming APIs. If you have a batch job with `dropDuplicates` and you want to migrate it to a streaming job, you likely should modify your query use `dropDuplicatesWithinWatermark`.

With that out of the way, here's the syntax for it. You just pass it the columns, as strings, on which you want to deduplicate:

TODO.

??? note "Historical note"
    Before `dropDuplicatesWithinWatermark` was introduced in Spark 3.5.0, we used to suggest deduplication with state removal by passing an event-time column to `dropDuplicates`. This still works, but we highly recommend using `dropDuplicatesWithinWatermark` instead: it's far less error-prone.
