Aggregations in streaming are similar to their batch counterpart: you specify what elements you want to group together, and you compute some function over that group. There is one main complication though: in streaming, we have to assume that we're processing an unbounded number of records. If we don't have a mechanism to get rid of "old" groups from earlier in the stream, the cluster will run out of memory.

Let's tackle this issue: we need some way to "garbage collect" groups that we no longer need. What groups do we no longer need? Well, the groups we no longer need to keep around are the groups that will _never change again_. How can we know this? If we're just aggregating on a `name` column, for example, it's possible for us to receive the same name over the _entirety_ of the stream's lifetime, so we can't remove a group associated with just a name.

However, if we grouped by a timestamp column, such as a window from 2pm to 3pm, that group would _never change again_ once the stream stopped producing events with a timestamp less than 3pm. From the definition of a [watermark](../concepts/watermarks.md), this happens when the watermark crosses 3pm. At that point, the 2pm to 3pm group could be removed.

So, this leads us to the two principles of streaming aggregations:

1. **Always** specify a watermark so that the engine knows when to clean up old groups
2. **Always** aggregate on an event-time column, like a window over time

## Example

=== "Python"

    ```python hl_lines="11 13-14 16"
    schema = (StructType()
        .add("name", StringType())
        .add("timestamp", TimestampType()))

    query = (spark
        .readStream
        .format(...)
        .schema(schema)
        .load()
        # Always specify a watermark
        .withWatermark("timestamp", "10 seconds")
        # Always group-by an event-time column
        .groupBy(window("timestamp", "15 seconds"))
        .count()
        .writeStream
        .outputMode("update")
        .format(...)
        .start()
    )
    ```

## What streaming aggregation values to emit

Since the same aggregate can receive records across multiple triggers, Structured Streaming needs to know what records to emit each trigger. The supported output modes are as follow:

- **Append mode**: In append mode, streaming aggregation operators only emit windows whose end times are _less_ than the watermark.
- **Update mode**: In update mode, the streaming aggregation operator emits all aggregates whose results that changed during the trigger.
- **Complete mode**: In complete mode, all rows ever produced by the streaming aggregation operator are emitted downstream.

This behavior is configured by the stream's output mode, which has a [dedicated article](../stream_options/output_mode.md). In that article, you can find [a walkthrough](../stream_options/output_mode.md#why-do-we-need-an-output-mode).

## Time windows

TODO.


1. Data can be delayed, so not all the data for a given group may be present at any moment in time.
2. Data for the same group 


But, there are some complications, 

Streaming aggregations, though, have some complications. 

- need to remove

1. They need to deal with delayed data


The one complication with streaming aggregations is that streaming engines need to deal with an _unbounded_ amount of data. 

Aggregations in Structured Streaming allow you to group related elements together and compute
