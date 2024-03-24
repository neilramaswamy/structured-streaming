# Joins

<!-- Note: there are several things that were removed from the Structured Streaming programming guide, including the support matrix. This matrix makes stream-stream joins out to be unnecessarily complex, and we shouldn't be telling users that "time-interval conditions for left-outer joins need a watermark on the right to emit null records and optionally need a watermark on the left to evict all state." We should simply tell users to *always* specify 2 watermarks and a time-bound, and then everything will JUST work. Advanced users can ask questions on SO or the dev@ list, and we can provide this nuance there. But we shouldn't degrade the experience for the 99% just to cater to the 1%. -->

Structured Streaming supports joining streaming DataFrames with another static or streaeming DataFrame. A _stream-static_ join can be useful if you want to augment the rows of a stream you're reading—for example, you could augment a `Purchases` stream with product information by joining with a static `Products` DataFrame. A stream-static join is actually a [_stateless_ operation](), since for every incoming row in the stream, Structured Streaming "just" has to look it up in the static table—there's no need to buffer any rows in a [state store](../../stream_options/state_stores.md).

A more powerful type of streaming join is the _stream-stream_ join, where both DataFrames are streaming DataFrames. For example, if you want to measure the success of an advertising campaign, you might want to join all product purchases that happen within an hour of an ad impression. Stream-stream joins have some subtleties around watermarks and state cleanup, so we'll explore them in more detail shortly.

## Stream-static joins

Stream-static joins consist of joining a streaming DataFrame with a static DataFrame (or vice-versa: you can have a static DataFrame on the left and a streaming DataFrame on the right). It would look something like the following:

=== "Python"
    ```python
    import pyspark.sql.functions.expr

    staticDf = spark.read.format("...").load()
    streamingDf = spark.readStream.format("...").load()

    streamingDf.join(staticDf, expr("..."), "inner") # Or "leftOuter" or "leftSemi"
    ```
=== "Scala"
    ```scala
    import org.apache.spark.sql.functions.expr

    val staticDf = spark.read.format("...").load()
    val streamingDf = spark.readStream.format("...").load()

    streamingDf.join(staticDf, expr("..."), "inner")  // Or "leftOuter" or "leftSemi"
    ```
=== "Java"
    ```java
    import static org.apache.spark.sql.functions.expr;

    Dataset<Row> staticDf = spark.read().format("...").load();
    Dataset<Row> streamingDf = spark.readStream().format("...").load();

    streamingDf.join(staticDf, expr("..."), "inner")  // Or "leftOuter" or "leftSemi"
    ```

Note: full outer joins are not supported for stream-static joins. If you do an outer join, then the "outer" side needs to be the streaming side. That is, a left-outer (or left-semi) join is only supported for stream-static joins, and right-outer joins are only supported for static-stream joins.

??? question "Why are these limitations in place?"
    Suppose you had a stream-static joins and you specified a right-outer join. To implement this, the engine would need to know when a record in the static DataFrame would _never_ join with an element from the streaming DataFrame; at that point, it could emit a record with `null` left columns. To do that, you would need a time-bound on the join condition, which we [explore below](#time-bounding-joins). In theory, this is possible to implement but it's not very common.

    There is an escape hatch here: if you _really_ want a stream-static right-outer join, you could read the static DataFrame as a streaming DataFrame. Then, you could just do a right-outer join with your stream-stream join. This would only work if there was a streaming connector for your static data source (e.g. the file source).

## Stream-stream joins

In stream-stream joins, each stream can progress independently of the other: one stream's data could not be delayed at all, and the other stream's data could be delayed by many minutes. To accomodate this, the stream-stream join operator needs to _buffer_ data from both streams in its [state store](../../stream_options/state_stores.md). 

However, we need some way to _remove_ records from state, for two reasons:

1. For all types of joins, if we retain state indefinitely, then we'll run out of disk space to store the state.
2. Outer joins need some way to decide that a certain record (say, `r`) will not join with the other side so that it can emit a `null` join for `r`. The correct time to emit such a `null` join happens when we remove `r` from state. (Do not worry if this doesn't make sense—we will explain it in detail.)

To buffer and subsequently remove records from state, as with all of the other [stateful operators](), we need to define [watermarks]() on our streams. We need to tell Structured Streaming the maximum delay that records in each stream may have. Then, the the streaming join operators can properly remove state. So, in general, you always need to specify a watermark on every single stream you're doing a join with.

In addition to specifying watermarks on your streams, you also need to time-bound your join. You need to specify the time-range in which a certain record may join with another record. There are two ways to do this:

1. Join on an event-time window (e.g. "join two records if they belong to the same event-time window")
2. Join with a time-interval condition (e.g. "join records if the left timestamp is between the right timestamp and the right timestamp plus an hour")

The following template is where you should *always* start for writing a stream-stream join. It will help you avoid major pitfalls:

=== "Python"
    ```python
    import pyspark.sql.functions.window

    left = spark.readStream().format("...").load()
    right = spark.readStream().format("...").load()

    # Rename columns to have the join side name to avoid ambiguity
    left = (left
        .withColumnRenamed("id", "leftId")
        .withColumnRenamed("timestamp", "leftTimestamp")
    )
    right = (right
        .withColumnRenamed("id", "rightId")
        .withColumnRenamed("timestamp", "rightTimestamp")
    )

    left = left.withWatermark("leftTimestamp", "15 seconds")
    right = right.withWatermark("rightTimestamp", "20 seconds")

    # For the sake of this example, we'll have a toggle to switch
    # between the type of time-bound we're using
    should_use_window = False

    joined_df = None

    if should_use_window:
        left = left.select("*", window("leftTimestamp", "1 hour"))
        right = right.select("*", window("rightTimestamp", "1 hour"))

        joined_df = left.join(right, "window", "inner")
    else:
        # Otherwise, use time-interval constraints
        joined_df = left.join(right, expr(
            "leftId = rightId AND leftTimestamp BETWEEN \
                rightTimestamp - INTERVAL 1 MINUTE AND \
                rightTimestamp + INTERVAL 1 MINUTE"
        ), "inner")

    joined_df.writeStream().format("...").start()
    ```

### Time-bounding joins

As mentioned earlier, you need to time-bound your joins for state to be evicted properly. The curious reader might wonder, "why is time-bounding necessary at all?" The answer to this is tricky but optional. You can read about it more, if you'd like, by expanding the box:

??? info "In-depth motivation for time-bounding joins"
    Let's try an inner join with watermarks on both sides, but _without_ a time-interval condition. For the rest of this article, we'll generally work with two streams, `L`eft and `R`ight, both with schemas `(id, timestamp)`. For simplicity, our timestamp will be an integer number of seconds. Suppose that each stream has a watermark of 15 seconds, and that we're joining with the condition `L.id == R.id`. If we receive `(foo, 10)` on the left, this is what things would look like:

    <join-diagram left-events="(foo, 10)" ></join-diagram>

    Now, suppose that we received an event `(foo, 30)` on the right. Our right-hand side watermark would advance to 15 (30 - 15):

    <join-diagram left-events="(foo, 10)" right-events="(foo, 30)" right-zones="(0, 15, Watermark = 15, red)" ></join-diagram>

    We can join these two records together, and thus emit something like `(foo, 10, 30)` downstream. However, we cannot remove _any_ of these from state, since a single record can join with _multiple_ records on the other side. Thus, if we recieve `(foo, 40)` on the left, we'd have the following:

    <join-diagram left-events="(foo, 10), (foo, 40)" right-events="(foo, 30)" left-zones="(0, 25, Watermark = 25, red)" right-zones="(0, 15, Watermark = 15, red)" ></join-diagram>

    And then, we'd have to emit `(foo, 40, 30)` downstream. So at this point, can we remove any records?

    You might say, "oh, well the left-hand side's watermark is 25, so just like in aggregations, we can remove `(foo, 10)`". This is **not** true: while we will not receive a record with timestamp less than 25 on the left, we may receive a record on the right with an ID of `foo`, and we'd have to join `(foo, 10)` with that. For example, if our right stream received `(foo, 90)`, we'd need to emit `(foo, 10, 90)` and `(foo, 40, 90)` downstream.

    So, when _can_ we remove records? To remove records, we need some way of relating the event-times between our two streams together. We can only remove a record when it will _never_ join with a record on the other side.

    For the sake of example, consider a situation where we joined _directly_ on an event-time column. You would rarely do this, but suppose we did an inner join on `L.timestamp == R.timestamp`. And then, consider a 15 second watermark delay and a record `(lucy, 50)` on the left:

    <join-diagram left-events="(lucy, 50)" left-zones="(0, 35, Watermark = 35, red)" ></join-diagram>

    So, we have to ask ourselves the question: when will the condition for `L.timestamp == R.timestamp` _never_ be true for the record we have? Substituting, this condition is effectively `50 == R.timestamp`. This becomes false once the right will never receive a record with timestamp 50, which happens once the right-hand side's watermark exceeds 50. To make that visual, we could receive `(ray, 60)`, but the right-watermark would only be 45, meaning that a timestamp of 50 was still possible:

    <join-diagram left-events="(lucy, 50)" right-events="(ray, 60)" left-zones="(0, 35, Watermark = 35, red)" right-zones="(0, 45, Watermark = 45, red)" ></join-diagram>

    It's still possible that we could receive a record with timestamp 50 on the right, and we'd have to join that with `(lucy, 50)`. But once the right-hand side's watermark exceeds 50, we can remove `(lucy, 50)` from state. So, consider receiving `(rob, 90)` on the right:

    <join-diagram left-events="(lucy, 50)" right-events="(ray, 60), (rob, 90)" left-zones="(0, 35, Watermark = 35, red)" right-zones="(0, 75, Watermark = 75, red)" ></join-diagram>

    From the definition of a watermark, we know that at this point, we'll never recieve a record on the right with tjimestamp 50. Thus, we can safely evict `(lucy, 50)` from state:

    <join-diagram left-zones="(0, 35, Watermark = 35, red)" right-events="(ray, 60), (rob, 90)" right-zones="(0, 75, Watermark = 75, #6791e0)" ></join-diagram>

    The main takeaway from this explanation is the following: to properly remove state from stream-stream joins, you need to utilize event-times columns in your join condition  so that the join operator can use the watermark to determine when the join condition will _never_ be true any longer. At that point, it can clean up records.


The first way to time-bound your joins is by `select`ing an event-time window on both of your streams, and then performing a join on that window. Note: this is not saying that you should _group by_ a window: it's just saying that you need to join on a window. In the example above, we used the `window` function to create a window column on both sides, and then joined on that window column.

<!-- Yes, users can use >= and <= but this is more trouble than it's worth. If you forget to have two time-interval conditions, you will have unbounded amounts of state, your outer/semi joins won't emit any records, and you'll be very sad. So, we'll just tell users to ONLY use BETWEEN, since that prevents you from shooting yourself in the foot. -->
Another way to time-bound your joins is by specifying a time-interval condition. In the example above, we used the `expr` function to specify a time-interval condition. In the string that you pass to `expr`, you can refer to any column name from either of the streams. In addition to joining on specific columns using `=`, you should use `BETWEEN`, `INTERVAL`, and arithmetic operators (`+` and `-`) to create time-bounds. Some examples are as follow:

1. `expr("leftKey = rightKey AND leftTimestamp BETWEEN rightTimestamp - INTERVAL 1 MINUTE AND rightTimestamp + INTERVAL 1 MINUTE")`
2. `expr("leftKey = rightKey AND rightTimestamp BETWEEN leftTimestamp AND leftTimestamp + INTERVAL 1 HOUR")`: the time-interval condition here effectively says that the right timestamp must be after, but within an hour of, the left timestamp.

!!! tip "Picking your time-bound strategy"
    You might wonder which time-bound strategy to use. Windowed joins are useful when you want to join records that happened in the same logical period of time. If you want to determine all purchases that happened in the same _day_ as an ad impression, you would use windowed joins with a 1-day [tumbling window](). However, this would mean that if you had an ad impression at 11:59pm and a purchase at 12:01am, they would not join together.
    
    Time-interval conditions (i.e. using `BETWEEN`) is most useful when you want to join records that happened within a certain time of each other. For example, you want to join all purchases that happened within an hour of an ad impression, whenever that ad impression was. If you joined all purchases that happened within an hour of an ad impression, you _would_ end up joining an ad impression at 11:59pm with a purchase at 12:01am.


### Inner, outer, and semi joins

Structured Streaming supports inner, all types of outer, and left-semi joins. To specify the type of join that you'd like, your third argument to the `join` method can be either `inner`, `leftOuter`, `rightOuter`, `fullOuter`, or `leftSemi`. For inner and outer joins, the output schema from the join will be the union of the left and right schemas, but certain values may be `null` if the outer join condition was not met; for left-semi joins, only the left-hand side schema will be present in the output.

If you followed the instructions and example from earlier in this article, using any of these join types should _just work_: records should be evicted from state properly, and records with appropriately set `null` columns (for outer and semi joins) should be emitted.

### Reasoning about latency

When running a stream-stream join, you might be curious about _why_ a certain record hasn't been emitted yet. At a high-level, a record will be emitted when the query's watermark exceeds the event-time of the _largest_ event-time allowed by the time-bound condition. Suppose our watermark delay is `d`. Let's look at two examples:

1. Suppose we have a record `(lucy, 45 seconds)` on the left and we are joining on 60 second tumbling windows. The _largest_ timestamp that this record could join with on the right is 60, the end of its window. So, we need to wait for the stream's watermark to exceed 60, i.e. the both streams receive records with event-times larger than `60 + d` [^1]. This calculation is based on [Principle 3]() of watermarks.
2. Again, suppose we have a record `(lucy, 45)` on the left and we are joining with a time-interval condition of `leftTimestamp BETWEEN rightTimestamp - INTERVAL 1 MINUTE AND rightTimestamp + INTERVAL 1 MINUTE`. The _largest_ timestamp that this record could join with on the right is `1 MINUTE` after 45, which is 45 + 60. So, we need to wait for the stream's watermark to exceed 105, i.e. the both streams receive records with event-times larger than `105 + d` [^1].

So, if you're wondering why a certain record is still in state, [check your watermark](). If you need lower latency, you can reduce the the watermark delay on both your streams. Please the [stream-stream outer join]() guide for an example of this type of tuning.

[^1]: With default configuration, this is true. However, if you set the multiple watermark policy, `spark.sql.streaming.multipleWatermarkPolicy` to `min`, then the watermark will be the minimum of the watermarks of all streams, and the record will be emitted when at least one of the streams has a watermark exceeding the time-bound.

## Multiple stateful operators

As of Spark 3.5, you can use multiple stateful operators in a single query. This means that you can use an aggregation on two streams and _then_ a stream-stream join, a deduplication followed by a stream-stream join, or even multiple joins chained together. The only limitation is that you cannot use Flat(MapGroupsWithState) before or after a stream-stream join.

=== "Python"
    ```python
    clicksWindow = clicksWithWatermark.groupBy(
        clicksWithWatermark.clickAdId,
        window(clicksWithWatermark.clickTime, "1 hour")
    ).count()

    impressionsWindow = impressionsWithWatermark.groupBy(
        impressionsWithWatermark.impressionAdId,
        window(impressionsWithWatermark.impressionTime, "1 hour")
    ).count()

    clicksWindow.join(impressionsWindow, "window", "inner")
    ```

<!-- TODO(neil): Port over more of the examples from the Programming Guide. -->

## Limitations

Currently, the stream-stream join operator _only_ works in Append mode. This means that if you need very low-latency stream-stream joins, you will either need to use a very low watermark delay, or implement a bespoke joining operator using `flatMapGroupsWithState`.

