# Output Mode

Output modes allow you to specify how stateful operators should write possibly-changing outputs to the streaming query's sink.

## Why do we need an output mode?

Some types of stateful streaming queries have outputs that can change when new data arrives. Let's look at an example.

Consider a [streaming aggregation]() that calculates the total revenue made _every hour_ at a store. Suppose our Structured Streaming job processes the following records in its first micro-batch:

- $15 at 2:45pm
- $10 at 2:30pm
- $30 at 3:30pm

At this point, the streaming aggregation operator has the following in its state:

- \[2pm, 3pm\]: $25
- \[3pm, 4pm\]: $30

The streaming aggregation operator could emit these results downstream now, or it could wait for more records that might be part of those windows. The stream could, for example, receive two more records and processes them in a second micro-batch:

- $20 at 2:15pm
- $25 at 3:15pm

After processing these records, the streaming aggregation operator now has these results in its state:

- \[2pm, 3pm\]: $45
- \[3pm, 4pm\]: $55

Again, the streaming aggregation operator could emit these results downstream now, since the aggregates have new values, or it could wait until its more confident that those aggregates won't change. How does it choose? The query's _output mode_ configures how its operators deal with changing values:

- In the _update_ output mode, the streaming aggregation operator emits all the windows that have changed during the micro-batch [^1].
- In the _append_ output mode, the streaming aggregation operator emits the windows that won't change; it determines this by using the [watermark]().

[^1]:
    Technically, streaming aggregation operator emits all the windows that have changed since the last _trigger_, not the last micro-batch. With the Available Now trigger, there could be multiple micro-batches in one trigger, so this distinction only makes sense for the Available Now trigger.

### Emitting aggregates with every update

One output mode is _update_ mode, where the streaming aggregation operator emits all the updated aggregate values every micro-batch. This behavior means that for the same window, the operator can emit a record multiple times (up to once per trigger). From our example earlier, this would mean that after the first micro-batch, it would emit two records downstream:

1. [2pm, 3pm): `$15 + $10` = $25
2. [3pm, 4pm): `$30` = $30

Then, after processing the next micro-batch, it would emit the two updated aggregates:

1. [2pm, 3pm): `$15 + $10 + `**`$20`** = $45
2. [3pm, 4pm): `$30 + `**`$25`** = $55

So, in total, across these two triggerings of micro-batches, Structured Streaming has made _two_ writes to the downstream sink.

### Emitting aggregates only once

Another output mode is _append_ mode, where the streaming aggregation operator emits aggregates only once once its sure those aggregate values won't change. The operator determines that an aggregate won't change once the streaming query's watermark exceeds the end of an aggregate's window. A [watermark]() is defined to be the earliest timestamp in the streaming query that the engine could now receive by the engine; if a window ended at 3pm and the watermark was 3:05pm, the engine would know that there would be no more records contributing to the aggregate whose window ended at 3pm.

So suppose the streaming aggregation operator had the following items in its state:

- \[2pm, 3pm\]: $25
- \[3pm, 4pm\]: $30

If the watermark were 1pm, the engine could still receive records for either of those two windows. As a result, it wouldn't emit _anything_. On the other hand, if the watermark were 3:30pm, it would know that it would no longer recieve records for the 2pm to 3pm window. In that case, it would emit `([2pm, 3pm], $25)` downstream, but _not_ emit `([3pm, 4pm], $30)`. At that point, the engine would consider the aggregate for 2pm to 3pm _finalized_, and would _never_ emit an aggregate for 2pm to 3pm again (unless a failure happened, and it had to reprocess that batch).

!!! info "Interactions with delivery semantics"
    Append mode differs from exactly-once delivery semantics in that a streaming aggregation operator in append mode emits its results only once, assuming that you don't have any failures. If you have a failure and the micro-batch has to be retried, then the same record might be appended to the sink twice. At that point, you must rely on the supported delivery semantics of your sink. See [link]().

### Emitting all aggregates

In addition to the update and append output modes, there exists one final output mode: _complete_ output mode. All the writes for the query are written downstream _every_ batch, no matter how many micro-batches ago they were originally created. It is generally unadvisable to use this output mode, since it requires keeping all historical writes in the query's state. If these are a lot of rows, you might experience an Out of Memory error for large amounts of data.

## Output Modes

These three output modes for streaming aggregations don't apply only to streaming aggregations. //QQ?// More broadly, they tell operators _when_ to emit their results: 

| Output Mode         | Description                             |
|---------------------|-----------------------------------------|
| Append Mode (default)    | By default, streaming queries run in Append mode. Operators emit rows once they're sure that resulting row won't change. |
| Update Mode | Operators emit all rows that were updated since the last trigger. |
| Complete mode | Supported only with aggregations: _all_ resulting rows ever produced are written to the [sink](). |

!!! warning
    You will rarely want to use the Complete output mode. It's only supported for aggregations, and it writes all the query's resulting rows across every trigger, so it needs to store every single row it has ever written. If these are a lot of rows, you might experience an Out of Memory error for large amounts of data.

### Operator compatibility

Some operators behave in ways that make supporting certain output modes difficult, if not impossible. This compatibility matrix is somewhat complicated. See [operator comppatibility matrix]().

### Sink compatibility

Not all sinks support all output modes. This is not a Structured Streaming limitation. Rather, to support update mode, sinks need to have some notion of recency, so that they serve the most recent update that Structured Streaming wrote to them. See [sink compatibility matrix]().

## Choosing the Right Output Mode

First, if you're using only stateless operators, output mode doesn't really matter for you: you can stick with the default of append mode. In stateless pipelines, an individual record doesn't depend on any other record, so an emitted row can never change, so update mode behaves the same way as append mode.

However, if you have stateful pipelines, see the following considerations.

### Consider application semantics

Primarily, you want to consider the semantics of your application:

- If downstream services are trying to take a single action for every write to the sink, use append mode in most cases. For example, if you have a downstream notification service sending notifications for every new record written to the sink, update mode would mean you send a notification for _every_ new update; this is likely be annoying for users.
- If downstream services are reading from your sink and need fresh results (such as a machine learning model that is reading features from your sink in real-time), using update mode ensures your sink stays as up-to-date as possible.

### Consider operator and sink compatibility

Recall that not all operators support all output modes. You'll want to make sure that the output mode that fits the semantics of your application is compatible with the operators you are trying to use.

Also, note that update mode is only supported by a handful of sinks. See [sinks supporting update mode]().

### Consider non-functional requirements

Finally, you should also keep in mind some non-functional (such as latency and cost) implications of particular output modes:

- Append mode forces stateful operators to emit results only once their resulting rows won't change. For stateful aggregations and joins, this is _at least_ as long as your watermark delay. A watermark delay of `1 hour` in the append output mode means that your records _will_ have at least a 1 hour delay.
- Update mode results in one write to your sink per trigger, per aggregate value. If you are using the [foreachBatch or foreach sink]() and are writing to an OLTP database that charges per write (such as like DynamoDB), your database bill might be expensive.

### Closing thoughts

You might go through the suggestions above and find that your semantics, operator or sink compatibility, and non-functional requirements don't align. For example, you might be in the following situation:

- You need an outer join, but data can be really delayed on one side. You want to update your sink when a join happens, but Structured Streaming joins don't support the update output mode.
- You want to use update mode with your streaming aggregation operator, but you have a file sink; file sinks don't support update output mode.

In these cases, you need to use one of Structured Streaming's "escape" hatches. You will need to use [arbitrary stateful processing](), likely in combination with the `foreach`/`foreachBatch` sinks to make this work.

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
