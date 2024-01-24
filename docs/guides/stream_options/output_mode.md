# Output Mode

The output mode of a stream query determines when results are released downstream (to the next operator or the sink). Data can be released downstream with each trigger, or can be released downstream only when the operator determines that a value in a row won't change.

- With stateless operators, an individual record doesn't depend on any other record, so a released row can never change as the result of a subsequent row in the stream. In this scenario, results are released downstream with each trigger regardless of the output mode.
- With stateful operators, a row can contain a record with an aggregated value that can (and frequently does) change with subsequent rows (such as an aggregation of values over a period of time). In this scenario, you need to choose when results should be released downstream. Results can be released with each trigger (regardless of the fact that the value of a record in a row might be updated by a subsequent trigger). You can also choose to only have results released downstream when an [aggregation operator]() determines that a row can no longer change - because the time window defined by the [watermark]() specifies that no new rows can appear that modify the aggregated value.

## What are the available output modes

There are three output modes that tell an operator _when_ to release their results downstream: 

| Output Mode         | Description                             |
|---------------------|-----------------------------------------|
| **Append mode (default)**    | By default, streaming queries run in append mode. In this mode, operators release rows once they're sure that resulting row won't change - either because no stateful operators are involved or because the stateful operator (such as an aggregation operator) has determined that the time window specified by the watermark has passed. |
| **Update mode** | In this mode, operators release all rows that were updated since the last trigger, regardless of the fact that the value of a record in a row might be updated by a subsequent trigger. |
| **Complete mode** | This mode is supported only with aggregations, with _all_ resulting rows ever produced are released downstream. |

## Why do we need an output mode?

Consider a [streaming aggregation]() that calculates the total revenue made _every hour_ at a store. Suppose our Structured Streaming job processes the following records in its first micro-batch:

- $15 at 2:45pm
- $10 at 2:30pm
- $30 at 3:30pm

At this point, the streaming aggregation operator has the following in its state:

- \[2pm, 3pm\]: $25
- \[3pm, 4pm\]: $30

The streaming aggregation operator could release these results downstream now, or it could wait for more records from a subsequent query that might be part of those time windows. The stream could, for example, receive two more records and processes them in a second micro-batch:

- $20 at 2:15pm
- $25 at 3:15pm

After processing these records, the streaming aggregation operator now has these results in its state:

- \[2pm, 3pm\]: $45
- \[3pm, 4pm\]: $55

Again, the streaming aggregation operator could release these results downstream now, since the aggregates have new values, or it could wait until its more confident that those aggregates won't change (determined using the [watermark]()). How does he streaming aggregation operator choose? The query's _output mode_ configures how its operators deal with changing values:

- In _update_ output mode, the streaming aggregation operator releases all the windows that have changed during the micro-batch [^1].
- In _append_ output mode, the streaming aggregation operator releases the windows that won't change.

[^1]:
    Technically, streaming aggregation operator releases all the windows that have changed since the last _trigger_, not the last micro-batch. With the Available Now trigger, there could be multiple micro-batches in one trigger, so this distinction only makes sense for the Available Now trigger.

### Releasing aggregates with every update

If the output mode is _update_ mode, the streaming aggregation operator releases all the updated aggregate values in every micro-batch. This behavior means that for the same window, the operator can release a record multiple times (up to once per trigger). From our previoius example, this would mean that after the first micro-batch, it would release two records downstream:

1. [2pm, 3pm): `$15 + $10` = $25
2. [3pm, 4pm): `$30` = $30

Then, after processing the next micro-batch, it would release the two updated aggregates:

1. [2pm, 3pm): `$15 + $10 + `**`$20`** = $45
2. [3pm, 4pm): `$30 + `**`$25`** = $55

So, in total, across these two triggerings of micro-batches, Structured Streaming has made _two_ downstream writes.

### Releasing aggregates only once

If the output mode is _append_ mode, the streaming aggregation operator releases aggregates only once once its sure those aggregate values won't change. The operator determines that an aggregate won't change once the streaming query's watermark exceeds the end of an aggregate's window. A [watermark]() is defined to be the earliest timestamp in the streaming query that the engine could now receive by the engine; if a window ended at 3pm and the watermark was 3:05pm, the engine would know that there would be no more records contributing to the aggregate whose window ended at 3pm.

So suppose the streaming aggregation operator had the following items in its state:

- \[2pm, 3pm\]: $25
- \[3pm, 4pm\]: $30

If the watermark were 1pm, the engine could still receive records for either of those two windows. As a result, it wouldn't release _anything_. On the other hand, if the watermark were 3:30pm, it would know that it would no longer recieve records for the 2pm to 3pm window. In that case, it would release `([2pm, 3pm], $25)` downstream, but _not_ release `([3pm, 4pm], $30)`. At that point, the engine would consider the aggregate for 2pm to 3pm _finalized_, and would _never_ release an aggregate for 2pm to 3pm again (unless a failure happened, and it had to reprocess that batch).

!!! info "Interactions with delivery semantics"
    Append mode differs from exactly-once delivery semantics in that a streaming aggregation operator in append mode releases its results only once, assuming no failures. If you have a failure and the micro-batch has to be retried, then the same record might be appended downstream twice. At that point, you must rely on the supported delivery semantics of your sink to resolve this duplication. See [link]().

### Releasing all aggregates

In addition to the Update and Append output modes, there also _Complete_ output mode. In this mode, all the writes for the query are written downstream _every_ batch, no matter how many micro-batches ago they were originally created. It is generally unadvisable to use this output mode as it requires the engine to store every single row it has ever written in the query's state. If these are a lot of rows, you might experience an Out of Memory error for large amounts of data.

## Choosing the right Output Mode

Choosing append or update mode:

- If you're using only stateless operators, output mode doesn't really matter for you: you can stick with the default of append mode. In stateless pipelines, an individual record doesn't depend on any other record, so an releaseted row can never change, so update mode behaves the same way as append mode.

- If you have stateful operators, see the following considerations.

### Consider application semantics

Primarily, you want to consider the semantics of your application:

- If downstream services are trying to take a single action for every downstream write, use append mode in most cases. For example, if you have a downstream notification service sending notifications for every new record written to the sink, update mode would mean you send a notification for _every_ new update; this is likely be annoying for users.
- If downstream services need fresh results (such as a machine learning model that is reading features in real-time), update mode ensures your sink stays as up-to-date as possible.

### Operator compatibility

Some operators behave in ways that make supporting certain output modes difficult, if not impossible. This compatibility matrix is somewhat complicated. See [operator comppatibility matrix]().

### Sink compatibility

Not all sinks support all output modes. This is not a Structured Streaming limitation. Rather, to support update mode, sinks need to have some notion of recency, so that they serve the most recent update that Structured Streaming wrote to them. Also, note that update mode is only supported by a handful of sinks. See [sink compatibility matrix]().

### Consider non-functional requirements

Finally, you should also keep in mind some non-functional (such as latency and cost) implications of particular output modes:

- Append mode forces stateful operators to release results only once their resulting rows won't change. For stateful aggregations and joins, this is _at least_ as long as your watermark delay. A watermark delay of `1 hour` in the append output mode means that your records _will_ have at least a 1 hour delay.
- Update mode results in one write to your sink per trigger, per aggregate value. If you are using the [foreachBatch or foreach sink]() and are writing to an OLTP database that charges per write, your database bill might be expensive.

### Closing thoughts

You might go through the suggestions above and find that your semantics, operator or sink compatibility, and non-functional requirements don't align. For example, you might be in the following situation:

- You need an outer join, but data can be really delayed on one side. You want to update your sink when a join happens, but Structured Streaming joins don't support the update output mode.
- You want to use update mode with your streaming aggregation operator, but you have a file sink; file sinks don't support update output mode.

In these cases, you need to use one of Structured Streaming's "escape" hatchesto make this work: [arbitrary stateful processing]() in combination with the `foreach`/`foreachBatch` sinks.

## Examples

=== "Python"

    [:material-api: `DataStreamWriter.outputMode`](https://spark.apache.org/docs/latest/api/python/reference/pyspark.ss/api/pyspark.sql.streaming.DataStreamWriter.outputMode.html)

    ``` python hl_lines="9 15 21"
    # Append output mode (default)
    df.writeStream \
        .format("console") \
        .start()

    # Append output mode (same as default behavior)
    df.writeStream \
        .format("console") \
        .outputMode("append") \
        .start()

    # Update output mode
    df.writeStream \
        .format("console") \
        .outputMode("update") \
        .start()

    # Complete output mode
    df.writeStream \
        .format("console") \
        .outputMode("complete") \
        .start()
    ```

=== "Scala"

    [:material-api: `DataStreamWriter.outputMode`](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/streaming/DataStreamWriter.html#outputMode(outputMode:String):org.apache.spark.sql.streaming.DataStreamWriter%5BT%5D)

    ``` scala hl_lines="9 15 21"
    // Append output mode (default)
    df.writeStream
        .format("console")
        .start()

    // Append output mode (same as default behavior)
    df.writeStream
        .format("console")
        .outputMode("append")
        .start()

    // Update output mode
    df.writeStream
        .format("console")
        .outputMode("update")
        .start()

    // Complete output mode
    df.writeStream
        .format("console")
        .outputMode("complete")
        .start()
    ```

=== "Java"

    [:material-api: `DataStreamWriter.outputMode`](https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/streaming/DataStreamWriter.html#outputMode-java.lang.String-)

    ``` java hl_lines="9 15 21"
    // Append output mode (default)
    df.writeStream
        .format("console")
        .start()

    // Append output mode (same as default behavior)
    df.writeStream
        .format("console")
        .outputMode("append")
        .start()

    // Update output mode
    df.writeStream
        .format("console")
        .outputMode("update")
        .start()

    // Complete output mode
    df.writeStream
        .format("console")
        .outputMode("complete")
        .start()
    ```
