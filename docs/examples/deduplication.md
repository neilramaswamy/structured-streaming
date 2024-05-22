This example will show you how to write a deduplication job with Structured Streaming. In particular, the scenario below discusses deduplicating a click-stream based on the unique ID embedded within each record; it uses watermarks to limit the amount of state that the engine needs to keep.

The operator that you should usually for deduplication is `dropDuplicatesWithinWatermark`. This operator will keep a history of records for at least as much time as your watermark delay. For example, if your watermark delay is 1 hour, Structured Streaming will keep at least the last hour of records in state; when a new record arrives, the engine emits it to the sink only if it doesn't already exist in state. The engine automatically garbage collects old state at the end of each micro-batch.

## Full example

A fairly good deduplication template is as follows. For an in-depth explanation of how it works with real-data, you can read the rest of this article.

TODO.


## Setting up your query

All Structured Streaming queries start by creating a source. As explained in [Unit testing](../guides/testing/unit_testing.md), it is recommended to write small examples by using the file source, since you can read and write to it on your local machine with no external infrastructure.

=== "Python"

    ```python
    import os
    from pyspark.sql.types import StructType, StringType, TimestampType
    from datetime import datetime

    # Define the path of our local source table
    source_path = "/tmp/streaming-dedup" 
    os.makedirs(SOURCE_PATH, exist_ok=True)

    # Define the schema of your source table
    schema = (StructType()
        .add("clickId", IntegerType())
        .add("timestamp", TimestampType()))
    
    click_stream = (spark
        .readStream
        .format("parquet")
        .schema(schema)
        .option("path", SOURCE_PATH)
        .load()
    )
    ```

At this point, `click_stream` is just a streaming DataFrame. There's no real "data" in it; so far, it just contains enough information to read from our source table. Let's now add the deduplication:

=== "Python"

    ```python
    # Continued from previous code snippet

    deduplicated_stream = (click_stream
        .withWatermark("timestamp", "10 seconds")
        .dropDuplicatesWithinWatermark("clickId)
    )
    ```

-------------

TODO(neil): Need to workshop the ideas below.

A 10 second watermark delay tells Structured Streaming that records may arrive up to 10 seconds late. That is, if we have a record arrive at timestamp 20...

A 10 second watermark delay tells Structured Streaming, "a record may have duplicates up to 10 seconds after it." The `dropDuplicatesWithinWatermark` operator then knows to hold records it previously saw for at least 10 seconds, after which it can remove them. The operator also knows to deduplicate only using the `clickId` field on each record.

-------------

Lastly, we'll add a sink so that we can see the result of our query:

=== "Python"

    ```python
    # Continued from previous code snippet

    query = (deduplicated_stream
        .writeStream
        .format("console")
        .start()
    )
    ```

The `query` above is a `StreamingQuery`, which is introduced in [Managing the query lifecycle](../guides/operations/lifecycle.md). One of the most important pieces of information that it contains is the [streaming query progress](../guides/operations/query_progress.md), which contains metrics about each micro-batch that the engine runs. The actual data that your query returns is written to your sink; in our case, it will be written to your console.

Assuming you've called `start` on your query, it's already running in the background. Shortly, we'll add some data to our source to see the deduplication happen.

=== "Python"

    ```python
    # Continued from previous code snippet

    # A utility function to convert from seconds to timestamps
    # ts(1) -> 1970 00:00:01, 1 second after the UNIX epoch
    ts = datetime.fromtimestamp

    spark.createDataFrame(
        [("a", ts(4)), ("a", ts(8)), ("a", ts(16))],
        schema
    ).write.mode("overwrite").parquet(SOURCE_PATH)
    ```

We'll now explore how the engine deduplicates these records.

### Which records get deduplicated?

The `dropDuplicatesWithinWatermark` operator will deduplicate two records with equivalent values for their deduplication columns if **either** of the following is true:

1. They occur within the same batch
2. Their event-times differ by less than the watermark delay

The second condition is where the name "drop duplicates _within_ watermark" comes from: any records whose event-times are within the watermark delay of each other will be deduplicated.

Suppose the watermark delay is 10 seconds, and assume records have the form `(id, timestamp)`. We will deduplicate based on `id`. Consider the following examples:

- `(a, 10)` and `(a, 25)` would be deduplicated if they were part of the same batch, due to rule 1.
- `(b, 10)` and `(b, 15)` would always be deduplicated, due to rule 2.
- `(c, 10)` and `(d, 10)` would _not_ be deduplicated, since their `id`'s are different

Let's see the deduplication actually happen by sending these records through. Let's add the first two records, `(a, 10)` and `(a, 25)`:

=== "Python"

    ```python
    # Continued from previous code snippet

    # A utility function to convert from seconds to timestamps
    # ts(1) -> 1970 00:00:01, 1 second after the UNIX epoch
    ts = datetime.fromtimestamp

    spark.createDataFrame(
        [("a", ts(10)), ("a", ts(25))],
        schema
    ).write.mode("overwrite").parquet(SOURCE_PATH)
    ```

Because these two records were processed in the same batch, they are deduplicated even though differ by more than 10 seconds, the watermark delay. You should only see `(a, ts(10))` in your console:

TODO.

Now, let's add the following:

=== "Python"

    ```python
    spark.createDataFrame(
        [("b", ts(10)), ("b", ts(15))],
        schema
    ).write.mode("append").parquet(SOURCE_PATH)
    ```

These two records both occur within the same batch and are within the watermark delay of each other, so you should only see the first record in your console:

TODO.

And of course, if you have two records whose `id`'s are distinct, then they aren't deduplicated. So, we'll add the following records:

=== "Python"

    ```python
    spark.createDataFrame(
        [("c", ts(10)), ("d", ts(10))],
        schema
    ).write.mode("append").parquet(SOURCE_PATH)
    ```

Even though their timestamps are the same, they are _not_ deduplicated becaues their ID's differ:

TODO.

### Data that is too late is dropped

All stateful operators in Structured Streaming _drop_ records whose event-times are less than the current watermark. Such records are considered "too late", and are dropped before the deduplication operator even sees them.

The [Watermarks](../guides/operators/stateful/watermarks.md) guide explains that the watermark is calculated by subtracing the watermark delay from the largest event-time. Assuming you've already inserted the last 3 records shown earlier in this article, our current watermark would be 25 - 10 = 15 seconds. The 25 comes from `(a, 25)`, whose event-time is still considered the largest, even though it was deduplicated.

We'll now insert `(e, 14)` and `(f, 16)`. Even though both of their `id`'s are unique, `(e, 14)` will _not_ show up in the output. This is because its event-time of 14 is less than the watermark of 15, so it is dropped as late data. On the other hand, `(f, 16)` has an event-time..


if you have [(a, 10)] and then [(a, 100)], the second is still deduplicated. And then `[(a, 101)]` is not deduplicated.


but note, if 25 had come first...

Structured Streaming will deduplicate two records 

Two records `foo` and `bar` are deduplicated if the following criteria are met:

1. They are in the same batch.
2. They are in separate batches, and their event-times differ by less than the watermark duration.

There are two rules that you should keep in mind 

In each micro-batch, the following logic is employed:

1. For each record:
    1. If the record's `clickId` already exist in state, drop the record.
    2. Otherwise, add the record to the state store, and emit it to the sink.
2. Remove old records, if any, from the state store
3. Set the watermark for the next batch

Using this logic, only the first record, `("a", ts(4))` makes it to the sink. Indeed, you should see the console sink render the following in your terminal:

TODO.

Also, the query progress should reflect this. In the 0th micro-batch, 3 records were read and only 1 was emitted downstream:

=== "Python"

    ```python
    # Sources is an array, since if you're doing joins, you can have multiple sources
    assert(query.recentProgress[0].sources[0].numInputRows == 3)

    # 2 rows are deduplicated
    assert(query.recentProgress[0].statefulOperators[0].numDroppedDuplicateRows == 2)

    # Sink is not an array, since Structured Streaming only supports one sink per query
    assert(query.recentProgress[0].sink.numOutputRows == 1)
    ```

One subtlety is that `("a", ts(16))` was _more_ than 10 seconds (the watermark delay) away from `("a", ts(4))`, yet it was still deduplicated. This is because Structured Streaming only evicts records from the state store after all records in a micro-batch are processed. So, when `("a", ts(16))` is being considered for deduplication, `("a", ts(4))` stll exists in state.

Then, using the current watermark, records in state are removed. Each record has to stay in state for at least its timestamp plus the watermark delay. So, `("a", ts(4))` has to stay until timestamp 14. Thus, we will only evict it once the watermark of the stream exceeds 14. However, since the _current_ watermark is 0 seconds, nothing should be evicted from state:

=== "Python"

    ```python
    # The current watermark is 0 seconds
    assert(query.recentProgress[0].eventTime.watermark == ts(0))

    # Queries can have multiple stateful operators, but we only have 1 right now
    # As such, we look at the 0th stateful operator
    assert(query.recentProgress[0].stateOperators[0].numRowsRemoved == 0)
    assert(query.recentProgress[0].stateOperators[0].numRowsTotal == 1)
    ```

After all records are processed and old records are evicted, the watermark is updated [^1]. Even though `("a", ts(16))` was deduplicated, its event-time is still recorded. The new watermark is computed by subtracting the watermark delay (10 seconds) from the largest event-time seen (16 seconds) [^2], so the watermark becomes 6 seconds for the _next_ batch.

Because there _might_ be records in state whose event-times are less than the new watermark, Structured Streaming runs a special type of batch called a "no data batch." No data batches are effectively garbage collection batches; they process no new data, but rather just apply the new watermark to the state store in an attempt to clean up state. But since the minimum eviction timestamp in the state store is 14 but the watermark is 6, the state store's metadata does not change:

[^1]: This fact comes from [Principle 2 of watermarks](../guides/operators/stateful/watermarks.md#principle-2). 
[^2]: This fact comes from [Principle 3 of watermarks](../guides/operators/stateful/watermarks.md#principle-3). 

=== "Python"

    ```python
    # Watermark of the second batch is 6 seconds
    assert(query.recentProgress[1].eventTime.watermark == ts(6))

    # No changes to the state store for the second batch
    assert(query.recentProgress[1].stateOperators[0].numRowsRemoved == 1)
    assert(query.recentProgress[1].stateOperators[0].numRowsTotal == 0)
    ```

### Dropping late data is not deduplication

Now, let's process some more data:

=== "Python"

    ```python
    spark.createDataFrame(
        [("b", ts(5))],
        schema
    ).write.mode("append").parquet(SOURCE_PATH)
    ```

Recall that the watermark of the stream is 6 seconds. Even though the `clickId` of `("b", ts(5))` is unique, its timestamp of 5 seconds is less than the watermark of 6 seconds, so it is considered "too late", and it is dropped by the watermark. Critically, it is not considered deduplicated. You should see this property reflected in the metrics:

=== "Python"

    ```python
    # ("b", ts(5)) is dropped by the watermark
    assert(query.recentProgress[2].numRowsDroppedByWatermark == 1)

    # But no rows are considered deduplicated
    assert(query.recentProgress[2].statefulOperators[0].numDroppedDuplicateRows == 0)

    # The watermark hasn't changed for the 3rd micro-batch
    assert(query.recentProgress[2].eventTime.watermark == ts(6))
    ```

### Cleaning up state

We still have `("a", ts(4))` in state, and our watermark is still at 6 seconds. This record in state will be evicted when the watermark exceeds 4 + the watermark delay, which is 14; the watermark will exceed 14 when we a record has a timestamp that exceeds 14 + the watermark delay, which is timestamp 24. Let's insert records with timestamp 25 to see what happens:

=== "Python"

    ```python
    spark.createDataFrame(
        [("a", 25), ("c", ts(25))],
        schema
    ).write.mode("append").parquet(SOURCE_PATH)
    ```

Following the algorithm outlined [Which records get deduplicated](#which-records-get-deduplicated), `("a", 25)` is considered a duplicate since an "a" still exists in state; as such, it is dropped. However, no record with `clickId` "c" still exists in state. As such, `("c", ts(25))` is emitted to the sink, and your console should show that:

TODO.

<!-- 4th micro-batch so far -->

In this micro-batch (the 4th), 1 row was dropped as a duplicate (the "a"), but since the watermark is still 6 seconds, no records are removed from state:

=== "Python"

    ```python
    assert(query.recentProgress[3].statefulOperators[0].numDroppedDuplicateRows == 1)

    # The watermark hasn't changed for the 4th micro-batch
    assert(query.recentProgress[3].eventTime.watermark == ts(6))

    # No state was removed
    assert(query.recentProgress[3].statefulOperators[0].numRowsRemoved == 0)
    ```

However, the _next_ batch's watermark is computed to be 25 seconds minus 10 seconds, which gives us 15 seconds. At this point, 15 seconds exceeds the timestamp of 14, the time at which `("a", 4)` will be removed. Indeed, we see one row removed for the 5th micro-batch:

=== "Python"

    ```python
    # No data was processed
    assert(query.recentProgress[4].sources.numInputRows == 0)

    # The watermark updates to 15 for the 5th micro-batch
    assert(query.recentProgress[4].eventTime.watermark == ts(15))

    # One record was removed
    assert(query.recentProgress[4].statefulOperators[0].numRowsRemoved == 1)
    ```

### Duplicates can still get through

The deduplication within watermark operator only guarantees that it will keep records around for at least as long as the watermark delay. After that point, it removes records. So what if we receive a duplicate after such a removal?

Let's now receive `("a", 16)`. Its timestamp is greater than our watermark of 15, which means it won't be dropped due to the watermark. However, since we _just_ evicted `("a", 4)` from state, there's nothing to tell Structured Streaming that it's a duplicate. So, Structured Streaming will add it to state and emit it downstream. In your console, you'll see:

TODO.

If you look at the query progress for the 6th batch, you'll also see that one more record was added to the state store:

=== "Python"

    ```python
    assert(query.recentProgress[5].statefulOperators[0].numRowsUpdated == 1)
    ```

## Summary

These semantics can be fairly tricky to intuitively grasp, so here is some intuition that you should use:

1. With `dropDuplicatesWithinWatermark`, if you have two identical records in your sink (e.g. they have the same `clickId`), they will be separated by _at least_ the watermark delay.
    1. In our example, we emitted both `("a", 4)` and `("a", 16)`. These differ by 12, which is more than the watermark delay of 10. This property will **always** hold.
2. Some records might be dropped because they are considered "too late". This is different from deduplication. Any [stateful operator](../guides/operators/overview.md#stateful-operators) in Structured Streaming will drop records whose event-times are less than the watermark.
