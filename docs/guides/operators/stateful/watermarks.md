# Watermarks in Structured Streaming

In Structured Streaming, having out of order data is normal and expected. For the streaming engine and stateful operators to produce complete, correct, and repeatable results, there must be a mechanism for determining when a given stream won't receive any more events before a certain time. It needs to know, for example, "I've received everything from before 4pm".

In this example, 4pm would be called the stream's watermark. When the watermark is at 4pm, the engine will know that it won't receive any new records with timestamps less than 4pm. As the streaming engine receives new data and the largest time seen so far increases, the watermark increases. We'll talk about why this makes sense in [Calculating the watermark]().

Practically, a watermark is used for one (or both) the following reasons:

- Emitting results: if you are computing an aggregation for a window from 3pm to 4pm, this aggregate will not change once the watermark exceeds 4pm. At that point, the aggregate value for that window will be emitted. See [Output mode]() for more on this.
- Cleaning up state: stateful operators only hold state for a finite amount of time. For example, the deduplication operator only "remembers" values its seen for as long as the watermark delay. After that much time has passes, the "remembered" values are evicted.

## Overview of watermark behavior

The operator-specific articles will go into more detail about watermarks, but here's a quick summary:

- Aggregations: the engine uses the watermark to know when to emit results and to clean up state. By default, when the watermark exceeds the end of a window, that window's result is emitted downstream, and the intermediary state associated with that aggregation is cleaned up.
- Deduplication: the engine uses the watermark to know when to clean up state. For example, if you have a record that had timestamp 5 on it, the `dropDuplicates` operator would remove it from state when the watermark exceeded 5 [^2].
- Joins: the engine uses the watermark to know when to emit results and to clean up state. Because data might be delayed on either side, records are buffered in state on either side of the join for approximately as long as the watermark delay, and after that much time has passed, they are removed from state.
- Groups with State: the engine provides the watermark to the user-defined function. The user-defined function decides how to use the watermark.

In general, a longer watermark delay means that results will take longer to appear in your sink and state will stay around for longer. A shorter watermark means that results will take less time to appear in your sink and state will be evicted faster. While you might be tempted to set a small watermark, that can lead to not waiting long enough for late data. We explore this below.

## Computing the watermark

The engine computes the watermark by subtracting a user-provided maximum delay value (called the watermark delay) from the maximum timestamp seen on the records so far. A very reasonable question is, "how does having a delay help us capture delayed and out of order data, and why does the engine subtract the delay from the maximum timestamp seen so far?"

Let's look at an example.

Suppose that we receive a record `foo` generated at timestamp 60, and the user-provided maximum delay that a record can have is 20 seconds. What is the range of timestamps may still arrive?

Let's consider some options. Can we receive 41? Yes, a record with timestamp 41 may arrive anywhere between 41 and 61, so at time 60, we can still receive it (there's still one second left in which it may arrive). But what about a record with timestamp 39? Even if 39 is _maximally_ delayed, it would have arrived by timestamp 59. Thus, we cannot receive a timestamp of 39 any longer.

What these small examples tell us is that if we receive a record at time 60 and the maximum delay that events can have is 20, then every record _before_ 60 - 20 must have already arrived, including 39:

<join-diagram one-sided left-label="Event Time" left-events="(foo, 60)" left-zones="(0, 40, All records by time = 40 have arrived, red)" ></join-diagram>

Because anything before 40 must have arrived, 40 is the stream's current watermark. It designates that no more records before time 40 will be received. In other words, we can write the diagram above as the following:

<join-diagram one-sided left-label="Event Time" left-events="(foo, 60)" left-zones="(0, 40, Watermark = 40, red)" ></join-diagram>

Unfortunately, in practice, there might still be some records that are more delayed by your watermark delay. Perhaps most of your events arrive within one day, but 0.001% of them are delayed by a week. Structured Streaming designates these records as being "too late". In our example, if we were to receive a record `bar` at timestamp 10 when the most recent record we've seen is 60, `bar`'s delay would be 50:

<join-diagram one-sided left-label="Event Time" left-events="(bar, 10), (foo, 60)" left-zones="(0, 40, Watermark = 40, red)" ></join-diagram>

In that case, Structured Streaming would drop the record. Our diagram would go back to looking like it was before, almost as if `(bar, 10)` never arrived.

Let's see how this is useful. Suppose you define an [aggregation operator](../stateful/aggregation.md) that aggregates data for non-overlapping 5 minute windows and the watermark delay is 1 minute. If the largest event time processed in a micro-batch is 4:02 PM and the watermark delay is 1 minute, then we should have received all events before 4:01pm. That becomes our watermark, and it tells the aggregation operator that all data before 4:01pm has been received. Then, the 3:55pm to 4:00pm window could never receive new records, and the aggregation operator could safely emit that window's aggregate value downstream.

## Setting a watermark delay

To tell your stream how to calculate the watermark, you'll use the `withWatermark` method on DataFrames. The first argument is the name of the timestamp column on your incoming records, and the second argument is the _watermark delay_, which can be a duration like "1 minute" or "5 seconds" or "2 hours".

If your incoming stream doesn't have a field that is explicitly of `TimestampType`, you'll have to use conversion functions like `timestamp_seconds` and `timestamp_millis`.

=== "Python"
    :material-api: [`PySpark Reference`](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.withWatermark.html)

    ```python
    df = spark.readStream.format("...").load()

    df = (df
        .withWatermark("timestamp", "1 minute")
        # Use other stateful operators here
    )

    df.writeStream.format("...").start()
    ```
=== "Scala"
    :material-api: [`Scala Reference`](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/Dataset.html?search=withWatermark)

    ```scala
    val df = spark.readStream.format("...").load()

    val dfWithWatermark = df
      .withWatermark("timestamp", "1 minute")
      // Use other stateful operators here

    dfWithWatermark.writeStream.format("...").start()
    ```
=== "Java"
    :material-api: [`Java Reference`](https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/Dataset.html#withWatermark(java.lang.String,java.lang.String))

    ```java
    Dataset<Row> df = spark.readStream().format("...").load();

    Dataset<Row> dfWithWatermark = df
      .withWatermark("timestamp", "1 minute")
      // Use other stateful operators here

    dfWithWatermark.writeStream().format("...").start();
    ```

## The tradeoff between completeness and latency

Watermark delays have the ability to configure the tradeoff between latency and completeness in your stream. Let's understand this claim by considering the three principles:

1. [Principle 1](#principle-1) dictates that watermarks are the boundary between event-times you will and won't receive. So, if you receive records that are less than the current watermark, they will be dropped. Dropping records means that your stream will not have a "complete" view of all records.
2. [Principle 2](#principle-2) tells us that watermarks evaluate at the end of each micro-batch. This means that if you _don't_ run any micro-batches, then your watermark won't update. This will mean that stateful operators won't be able to emit results, and your stream will have high latency.
3. [Principle 3](#principle-3) states that watermarks trail behind the maximum event-time seen so far by the watermark delay. This means that if your watermark delay is too small, you might drop records that you shouldn't have. If your watermark delay is too large, you might have to wait longer to emit results.

Practically, what does this mean for you? Usually, you'll have SLAs on how delayed your data can be. If you want more correctness than lower latency, you should set your waterkmark delay to be near the 100th percentile of the delay that your SLA gives you. If you want lower latency and are fine with dropping some records, you can set your watermark delay to be lower.

## Monitoring and tuning your watermark delay

In the [Monitoring the Query Lifecycle](../../operations/monitoring.md) guide, we discuss how to register a listener that receives `StreamingQueryProgress` events. In the streaming query progress, you have access to the `StateOperatorProgress`, which contains information on the number of dropped rows (`numRowsDroppedByWatermark`). In your listener, you can monitor the number of dropped rows and stop your stream (or send an alert) if the number of dropped rows exceeds a certain threshold.

If you notice that the number of records dropped by the watermark is 0, two things are possible: your watermark delay could be too large, or it could actually be "just right." Unfortunately, it's difficult to automatically assess which situation you're in. You could try to reduce the watermark delay and see if the number of dropped rows increases. However, this isn't quite practical for production jobs, especially if they're dealing with sensitive data that you don't want to drop.

## Advanced watermarks

The information in this section isn't vital for you to get started with Structured Streaming, but if you really want to understand how the engine is working, you should read it. We outline the three principles that Structured Streaming uses to compute and apply watermarks and then illustrate them with an example.

### The three principles of watermarks

There are three basic principles of watermarks in Structured Streaming. You can use the helpful pneumonic "WET" to remember them.

#### Principle 1

Watermarks **W**alk the boundary between event-times the stream won't receive and event-times the stream will receive. For example, a stream's watermark being at 40 seconds tells the engine that it won't have to process any more events with timestamps less than 40 seconds.

#### Principle 2

Watermarks **E**valuate at the end of each micro-batch. This principle has implications for completeness and latency, so we'll explore it more shortly.

#### Principle 3

Watermarks **T**rail behind the maximum event-time seen so far by the watermark delay. That is, the watermark is computed by subtracting the watermark delay from the largest event-time seen so far. (See the explanation in the introduction for why this makes sense.)

### Conceptual watermark example

Let's assume a watermark delay defined as 20 seconds. In our first batch, suppose that we receive the following records:

<join-diagram one-sided left-label="Event Time" left-events="(a, 10), (b, 30), (c, 55)" ></join-diagram>

As per Principle 2, that watermarks **e**valute at the end of every micro-batch, we now have to compute the watermark. Using Principle 3, that watermarks **t**rail behind the maximum event-time by the watermark delay, we subtract 20 from 55 to give us 35:

<join-diagram one-sided left-label="Event Time" left-zones="(0, 35, Watermark = 35, red)" left-events="(a, 10), (b, 30), (c, 55)" ></join-diagram>

Now, suppose that we receive the record `(d, 10)` in the next micro-batch. As per Principle 1, the record `(d, 10)` is discarded as its timestamp is less than 35, the watermark value. The only reason this could happen is if the watermark delay of 20 wasn't the _maximum_ delay. If the maximum delay was something like 50, then the watermark would have been 55 - 50 = 5, and `(d, 10)` would not have been dropped.

Finally, let's consider what happens when we receive `(e, 95)` and then `(f, 70)` in the same micro-batch.

<join-diagram one-sided left-label="Event Time" left-zones="(0, 35, Watermark = 35, red)" left-events="(a, 10), (b, 30), (c, 55), (d, 10), (e, 95), (f, 70)" ></join-diagram>

You might think that once processing `(e, 95)`, the watermark updates to 95 - 20 and that `(f, 70)` is dropped. But that's not the case: we must stick to our principles. Principle 2 tells us that the watermark **e**valuates at the end of every micro-batch. Thus, we process both `e` and `f`, and _then_ we go to update the watermark. We can then use Principle 3, that watermarks **t**rail behind the maximum event-time seen so far by the watermark delay, to update the watermark to 95 - 20 = 75:

<join-diagram one-sided left-label="Event Time" left-zones="(0, 75, Watermark = 75, red)" left-events="(a, 10), (b, 30), (c, 55), (d, 10), (e, 95), (f, 70)" ></join-diagram>

So what's the takeaway? You generally will never have to employ these rules, but it's good to know that these principles can effect latency and correctness. 

### Example of watermarks and aggregations

To see a real, runnable example of a streaming aggregation and its interaction with watermarks, please read the [aggregation with watermark](../../../examples/aggregation-with-watermark.md) example.
