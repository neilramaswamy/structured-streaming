# Output Mode

!!! info
    Before reading this article, you should be familiar with [watermarks]() and [triggers]().

A Structured Streaming query's output mode configures what records the query's operators emit during each trigger. For example, operators could emit the records that changed since the last trigger, or the rows that will never change in _future_ triggers.

This distinction is important for [stateful operators](), since a particular row produced by a stateful operator may change from trigger to trigger. For example, as a streaming aggregation operator recevies more rows for a particular window, that window's aggregation value (like the minimum, maximum, or sum) may change across triggers. Output mode configures whether the streaming aggregation operator should emit the latest result at the end of each trigger, or just emit the result once, when the watermark determines that the particular window's aggregation value will never change again.

For [stateless operators](), this distinction does not affect the behavior of the operator. The records a stateless operator emits during a trigger are _only_ the source records processed during that trigger: unlike stateful operators, results do not change as more triggers execute.

## Available output modes

There are three output modes that tell an operator _what_ records to emit during a particular trigger: 

| Output Mode         | Description                             |
|---------------------|-----------------------------------------|
| **Append mode (default)**    | By default, streaming queries run in append mode. In this mode, operators only emits rows that won't change in future triggers; stateful operators use the watermark to deterine when this happens. |
| **Update mode** | In update mode, operators emit all rows that changed during the trigger, even if the emitted record might change in a subsequent trigger. |
| **Complete mode** | In complete mode, _all_ resulting rows ever produced by the operator are emitted downstream. It is supported only with streaming aggregations. |

Note that append mode and update mode are semantically equivalent for stateless operators. For a stateless operator like `.select`, the row that results from taking a subset of a a source record's columns in a given trigger has two properties: it will never change in the future  (i.e. it satisfies append mode), and that particular record must not have existed in the previous trigger (i.e. it satisfies update mode).

## Why do we need an output mode?

Consider a [streaming aggregation]() that calculates the total revenue generatee _every hour_ at a store. Let's also assume that it uses a watermark delay of 15 minutes. Suppose our Structured Streaming query processes the following records in its first micro-batch:

- $15 at 2:40pm
- $10 at 2:30pm
- $30 at 3:10pm

At this point, the engine's watermark must be 2:55pm, since it would have subtracted 15 minutes (the delay) from the maximum time seen (3:10pm). Additionally, the streaming aggregation operator would have the following in its state:

- \[2pm, 3pm\]: $25
- \[3pm, 4pm\]: $30

In append mode, the streaming aggregation operator wouldn't emit anything downstream. This is because both of these windows still could change as new values appear with a subsequent trigger: the watermark of 2:55pm indicates that records _after_ 2:55pm can still arrive, and those records could fall into either the \[2pm, 3pm\] window or the \[3pm, 4pm\] window. In update mode, on the other hand, _both_ of these records would be emitted downstream, since they were just updated. In complete mode, both of these records would be emitted, simply because _all_ records are emitted.

Now, suppose that the stream received one more record:

- $20 at 3:20pm

The watermark would then update to 3:05pm, since the engine would subtract 15 minutes from 3:20pm. At _this_ point, the streaming aggregation operator would have the following in its state:

- \[2pm, 3pm\]: $25
- \[3pm, 4pm\]: $50

In append mode, the streaming aggregation operator would notice that the watermark of 3:05pm was greater than the end of the \[2pm, 3pm\] window. By the definition of the watermark, that window would _never_ change, so it could emit just that one window downstream. In update mode, however, the streaming aggregation operator would only emit the \[3pm, 4pm\] window because it had changed from $30 to $50. Finally, in complete mode, both of these records would be emitted.

<!-- TODO(neil): check if in update mode the closed window would be emitted if it didn't change -->

To summarize, stateful operators behave in the following way:

- In append mode, records are emitted once they will no longer change, where "no longer change" is determined using the watermark
- In update mode, records that changed since the previous trigger are (re-)emitted
- In complete mode, all records ever produced by the stateful operator are (re-)emitted

## Selecting the right output mode

If you're using only stateless operators in your query, you don't need to configure an output mode. With a query using only stateless operators, an individual record doesn't depend on any other record, so an emitted row can never change; thus, update mode behaves the same way as append mode.

If you have _any_ stateful operators in your pipeline, see the following considerations.

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

- Append mode forces stateful operators to emit results only once their resulting rows won't change. For stateful aggregations and joins, this is _at least_ as long as your watermark delay. A watermark delay of `1 hour` in the append output mode means that your records _will_ have at least a 1 hour delay before being emitted downstream.
- Update mode results in one write per trigger, per aggregate value. If you are using the [foreachBatch or foreach sink]() and are writing to an OLTP database that charges per write, your database bill might be expensive.

### Closing thoughts

After going through the suggestions above, you may find that your semantics, operator or sink compatibility, and non-functional requirements don't align. For example, consider the following situation:

- You want to use update mode with your streaming aggregation operator, but you have a file sink; file sinks don't support update output mode.
- You need an outer join, but data can be substantially delayed on one side. You want to update your sink when a join happens, but Structured Streaming joins don't support the update output mode.

In these cases, you need to use one of Structured Streaming's "escape" hatches to make this work: [arbitrary stateful processing]() in combination with the `foreach`/`foreachBatch` sinks.

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
