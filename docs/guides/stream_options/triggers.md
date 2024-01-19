# Triggers

## Motivation

In the [Triggers]() section of the Tour, we note that Structured Streaming "repeatedly" reads and processes data from the source in micro-batches. Triggers allow you to configure the precise definition of "repeatedly reads and process data." They specify how frequently micro-batches are run.

Some reasonable triggers could be the following behaviors:

- You read and process more data immediately after after one micro-batch finishes
- You read and process data in a micro-batch every hour (or every 24 hours)

You might wonder why it would make sense to only process one micro-batch every hour (or 24); at that point, why not just schedule a batch job to run every hour (or 24)? Structured Streaming jobs running with time-based trigger allow you to _incrementally_ process your source data, without worrying about:

- Delivery semantics, like at-least-once or exactly-once, as noted in [Fault Tolerance and Checkpoints]().
- State created by [stateful operators](): they will automatically remove old state.

!!! tip
    If you have a batch Spark job that you run as a [cron job](https://en.wikipedia.org/wiki/Cron), it might be easier to run it as a Structured Streaming job with a trigger. You won't have to worry about the job failing and not processing that day's data, for example.


## API Overview

| Output Mode | Description                          |
| ----------- | ------------------------------------ |
| Micro-Batch (default)       | By default, the query will be executed in micro-batch mode, where micro-batches will be generated as soon as the previous micro-batch has completed processing.  |
| Processing Time       | The query will be executed with micro-batches mode, where micro-batches will be kicked off at the user-specified interval. If the previous micro-batch completes within the interval, then the engine will wait until the interval is over before kicking off the next micro-batch. If the previous micro-batch takes longer than the interval to complete (i.e. if an interval boundary is missed), then the next micro-batch will start as soon as the previous one completes (i.e., it will not wait for the next interval boundary). |
| Available Now    | The query will process all the available data at time of query creation and then stop. It will process the data in multiple micro-batches based on the source options (e.g. `maxFilesPerTrigger` for the file source). It will definitely process all unprocessed data at the time at which the query starts, but will not process data that arrives _during_ the execution of these batches. |
| Once (deprecated) | The query will process all the unprocessed data at the time of query creation in _one_ batch. Beware: it will not respect source options.
| Continuous (experimental) | The query will be executed in the new low-latency, continuous processing mode. Read more about it [here](). |

## Use Cases

If you're unsure about what trigger to choose, you might consider using the following table. Once a use case sounds like yours, you can check the specific semantics of it in the [API Overview]().

| Output Mode | Use Cases |
| ----------- | ------------------------------------ |
| Micro-Batch (default)       | If latency is your most important requirement, use this trigger. If you want to process data as fast as possible (perhaps because you're doing real-time fraud detection or real-time feature generation for a Machine Learning model), this is the production-ready trigger that will give you the lowest latency. |
| Processing Time       | If you have a stream of data that needs to be processed _without_ a real-time latency requirement, you can use this trigger. For example, if you just need a daily report at the end of the day to say how many sales were made in the last 24 hours, you could set a processing time trigger of 24 hours. The benefit to using a processing time trigger is that when your query isn't running, your cluster can be used by other jobs running on it. This is the middle-ground between latency and cost.  |
| Available Now    | If you have a stram of data that you need to process in a one-off fashion, but you don't want to have to reprocess data you already processed, use Available Now. This is the most cost-effective trigger: you can spin up a cluster and process all unprocessed data in your streaming source; the query will terminate, and you can spin down the cluster. |
| Once | You really shouldn't be using this: it's deprecated. Use Available Now. | 
| Continuous | This is an experimental mode, so it has limited support. It only supports [stateless]() queries, and doesn't emit any metrics. But if you have a stateless pipeline and need single-digit millisecond latency, you could try this mode. |

## Examples

=== "Python"

    ``` python
    # Default trigger (runs the next micro-batch as soon as it can)
    df.writeStream \
        .format("console") \
        .start()

    # ProcessingTime trigger with two-seconds between micro-batches 
    df.writeStream \
        .format("console") \
        .trigger(processingTime='2 seconds') \
        .start()

    # Available-now trigger
    df.writeStream \
        .format("console") \
        .trigger(availableNow=True) \
        .start()

    # One-time trigger (Deprecated, encouraged to use Available-now trigger)
    df.writeStream \
        .format("console") \
        .trigger(once=True) \
        .start()

    # Continuous trigger with one-second checkpointing interval
    df.writeStream
        .format("console")
        .trigger(continuous='1 second')
        .start()
    ```

=== "Scala"

    ``` scala
    import org.apache.spark.sql.streaming.Trigger

    // Default trigger (runs the next micro-batch as soon as it can)
    df.writeStream
        .format("console")
        .start()

    // ProcessingTime trigger with two-seconds between micro-batches 
    df.writeStream
        .format("console")
        .trigger(Trigger.ProcessingTime("2 seconds"))
        .start()

    // Available-now trigger
    df.writeStream
        .format("console")
        .trigger(Trigger.AvailableNow())
        .start()

    // One-time trigger (Deprecated, encouraged to use Available-now trigger)
    df.writeStream
        .format("console")
        .trigger(Trigger.Once())
        .start()

    // Continuous trigger with one-second checkpointing interval
    df.writeStream
        .format("console")
        .trigger(Trigger.Continuous("1 second"))
        .start()
    ```

=== "Java"

    ``` java 
    import org.apache.spark.sql.streaming.Trigger

    // Default trigger (runs the next micro-batch as soon as it can)
    df.writeStream
        .format("console")
        .start();

    // ProcessingTime trigger with two-seconds between micro-batches 
    df.writeStream
        .format("console")
        .trigger(Trigger.ProcessingTime("2 seconds"))
        .start();

    // Available-now trigger
    df.writeStream
        .format("console")
        .trigger(Trigger.AvailableNow())
        .start();

    // One-time trigger (Deprecated, encouraged to use Available-now trigger)
    df.writeStream
        .format("console")
        .trigger(Trigger.Once())
        .start();

    // Continuous trigger with one-second checkpointing interval
    df.writeStream
        .format("console")
        .trigger(Trigger.Continuous("1 second"))
        .start();
    ```

=== "R"

    ```R
    # Default trigger (runs the next micro-batch as soon as it can)
    write.stream(df, "console")

    # ProcessingTime trigger with two-seconds between micro-batches 
    write.stream(df, "console", trigger.processingTime = "2 seconds")

    # TODO: Is AvailableNow supported?
    # One-time trigger
    write.stream(df, "console", trigger.once = TRUE)

    # Continuous trigger is not yet supported
    ```






