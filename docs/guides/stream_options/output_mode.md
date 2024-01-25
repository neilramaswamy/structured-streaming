# Output Mode

!!! info
    Before reading this article, you should be familiar with [watermarks]().

With a Structured Streaming query, output mode configures what records operators emit during a trigger. For a [stateless operator](), there’s only one behavior; for a [stateful operator](), you can choose to have the operator only emit the records that will no longer change or emit all the records that chamged during the trigger. For example, a stateful aggregation might end a micro-batch with a window with aggregate value 10; after processing more data in the next micro-batch, the streaming aggregator could update that aggregate value to 20. The output mode configures whether to emit the aggregate value at the end of every batch or once the aggregate value won't change anymore.

!!! note 
    _Stateless_ operators never emit resulting rows that change as more data arrives. Per the definition of a stateless operator, every record can be processed fully on its own. As such, setting an output mode on a stateless query won't change its behavior.

## What are the available output modes

There are three output modes that tell an operator _what_ records to emit their results downstream: 

| Output Mode         | Description                             |
|---------------------|-----------------------------------------|
| **Append mode (default)**    | By default, streaming queries run in append mode. In this mode, a stateful operator only emits rows that won't change - because the time window specified by the watermark has passed. |
| **Update mode** | In update mode, stateful operators emit all rows that changed during the trigger, regardless of the fact that the value of a record in a row might be updated during a subsequent trigger. |
| **Complete mode** | Complete mode is supported only with aggregations, with _all_ resulting rows ever produced emitted downstream. |

## Why do we need an output mode?

Consider a [streaming aggregation]() that calculates the total revenue generatee _every hour_ at a store. Let's also assume that it uses a watermark delay of 15 minutes. Suppose our Structured Streaming query processes the following records in its first micro-batch:

- $15 at 2:40pm
- $10 at 2:30pm
- $30 at 3:10pm

At this point, the engine's watermark must be _2:55pm_, since it would have subtracted 15 minutes (the delay) from the maximum time seen (3:10pm). Additionally, the streaming aggregation operator would have the following in its state:

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
- In update mode, records that changed since the previous micro-batch[^1] are (re-)emitted
- In complete mode, all records ever produced by the stateful operator are (re-)emitted

[^1]:
    Technically, streaming aggregation operator emits all the windows that have changed since the last _trigger_, not the last micro-batch. With the Available Now trigger, there could be multiple micro-batches in one trigger, so this distinction only makes sense for the Available Now trigger. Practically, you don't have to worry about this. 

## Choosing the output mode for your pipeline type

Choosing append or update mode:

- If you're using only stateless operators in your pipeline, use the default of append mode. In stateless pipelines, an individual record doesn't depend on any other record, so an emitted row can never change, so update mode behaves the same way as append mode.

- If you have stateful operators in your pipeline, see the following considerations.

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

- You need an outer join, but data can be substantially delayed on one side. You want to update your sink when a join happens, but Structured Streaming joins don't support the update output mode.
- You want to use update mode with your streaming aggregation operator, but you have a file sink; file sinks don't support update output mode.

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
