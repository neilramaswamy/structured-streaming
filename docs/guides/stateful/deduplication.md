# Deduplication in Structured Streaming

Data sources frequently have duplicate records. Duplication occurs because many data systems only have _at-least-once_ guarantees, which means that the same record may be present multiple times in the same stream. For example, a web server might be trying to send a log to a database cluster. If that web server has a retry mechanism that isn't idempotent, that record could be produced and written multiple times.

You can pass the columns on which you want to deduplicate to one of the following deduplication methods provided by Structured Streaming.

## Deduplication methods

Spark has these two deduplication methods:

- **dropDuplicatesWithinWatermark**: The `dropDuplicatesWithinWatermark` method holds onto duplicates for at least as much time as the watermark duration in your streaming job. Deduplication using a watermark is recommended, since records older than the watermark delay are removed, leading to less memory utilization.

- **dropDuplicates**: The `dropDuplicates` method removes duplicates across the entire stream. This method is used when you want _global_ deduplication across your entire stream. Global deduplication is unbounded by time and requires an unbounded amount of memory.

!!! warning
    Do not use the `dropDuplicates` method unless you are sure that the columns on which you are deduplicating have low cardinality. Otherwise, you may encounter out of memory errors.

## Example
 
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



## Local deduplication with `dropDuplicatesWithinWatermark`

The `dropDuplicatesWithinWatermark` method should be your first choice for deduplication when you know the interval of time within which you might receive duplicates. <!-- (TODO: is this true? what do people use to figure this out?) --> If you know that you'll have duplicates within an `x` minute interval, you can instruct the deduplication operator to hold onto records for at least `x` minutes. After a record has been around for at least `x` minutes, the deduplication operator will remove it from state, which reduces memory consumption.

<!-- add conceptual walkthrough-->
For example, suppose you know that you'll have duplicates within 5 minutes of each other. If you receive a record, `ID = foo`, with event-time 6, you might receive duplicates up to an event-time of 5+6 (11). Watermarks tell Structured Streaming when its done receiving events before a certain time (in this case, time 11). If duplicates for the record `ID = foo` can arrive up until time 11, once Structured Streaming knows that it'll no longer receive event-times _before_ time 11, Structured Streaming knows to purge that record. That's where the name `dropDuplicatesWithinWatermark` comes from: for at least as many units of time within your watermark delay, Structured Streaming performs deduplication.

<!--For an end-to-end example, see [example](). not sure what you intend here-->

!!! note
    When deduplicating with a watermark, you might have duplicates that arrive _after_ your watermark's maximum delay. In our example, another record with `ID = foo` that arrives after event-time 11 is _not_ deduplicated. If you have strict deduplication requirements, you have two options:

    - Keep state for longer via a larger watermark delay (a larger watermark means more records arrive _within_ your watermark).
    - Keep state forever, using `dropDuplicates`.

## Global deduplication with `dropDuplicates`

The `dropDuplicates` method allows you deduplicate over _all_ records of the stream. Since streams are unbounded, this means that `dropDuplicates` can deduplicate over an unbounded number of records, by keeping all the records in state. This behavior has pros and cons:

- **Pro**: Perfect, total deduplication.
- **Con**: Potential out-of-memory errors. If you have enough records, you'll run out of space to store records and cause a machine crash.

??? note "Historical note"
    Before `dropDuplicatesWithinWatermark` was introduced in Spark 3.5.0, the recommendation was to perform deduplication with state removal by passing an event-time column to `dropDuplicates`. This still works, but we highly recommend using `dropDuplicatesWithinWatermark` instead; it's far less error-prone. For a further discussion, see this [Stack Overflow post](https://stackoverflow.com/a/77441576).

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

## API reference
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

