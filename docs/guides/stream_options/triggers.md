# Triggers

A trigger defines how often a micro-batch executes a query and processes source data.

## What are the trigger definitions?

Structured Streaming repeatedly reads and processes data from the source in micro-batches. Triggers allow you to configure the precise definition of how frequently Structured Streaming micro-batches are run.

The following are some examples of trigger definitions:

- Start a micro-batch immediately after immediately after each micro-batch finishes
- Start a micro-batch on a schedule (such as every hour or every 24 hours)

Processing a micro-batch at a specified interval, such as hourly or daily, allows you to process your source data with the following benefits:

- **Incremental processing**: no need to keep track of what data you have and haven't processed
- **Delivery semantics**: skuch as at-least-once or exactly-once, as noted in [Fault Tolerance and Checkpoints]()
- **State management**: old state is automatically removed.

!!! tip

    If you have a batch Spark job that you run as a [cron job](https://wikipedia.org/wiki/Cron), consider running it as a Structured Streaming job with a trigger. For example, with a trigger you won't have to worry about the job failing and not processing that day's data.

## What are the available trigger types?

| Trigger | Description                          |
| ----------- | ------------------------------------ |
| **Micro-batch trigger (default)**       | The default trigger is the micro-batch trigger, where a micro-batch starts as soon as thr previous micro-batch completes. Since there is no delay between micro-batches, the default trigger interval is effectively 0 seconds.  |
| **Processing Time trigger**      | The processing time trigger starts micro-batches at a user-specified interval. If the previous micro-batch completes within the interval (before the time for the next specified time), then the Spark engine waits until the interval is over to start the next micro-batch. If the previous micro-batch takes longer than the interval to complete (runs over the time specified for the next micro-batch to start), then the next micro-batch starts as soon as the previous one completes (it will not wait for the next interval boundary). |
| **Available Now trigger**    | The available now trigger starts a query that processes all available data at time of query creation and then stops. It processes the data in multiple micro-batches based on the source options (such as `maxFilesPerTrigger` for the file source). It processes all unprocessed data as of the time when the query starts. It does not process data that arrives _during_ the execution of the micro-batches. |
| **Once (deprecated) trigger** | The once trigger starts a query that processes all unprocessed data at the time of query creation in _one_ batch. Beware: it will not respect source options.
| **Continuous trigger (experimental)** | The continuous trigger starts a query that executes in a low-latency, continuous processing mode. See [continuous trigger](). |

## What is the use case for each trigger type?

The following table describes the use case for each trigger type.

| Trigger | Use case |
| ----------- | ------------------------------------ |
| **Micro-batch (default) trigger**       | If latency is your most important requirement, use the micro-batch trigger for the lowest latency. With this trigger, you can process data as fast as possible (perhaps because you're doing real-time fraud detection or real-time feature generation for a Machine Learning model). |
| **Processing Time trigger**       | If you have a stream of data that needs to be processed _without_ a real-time latency requirement, use the processing time trigger. For example, if your goal is to generate a daily report at the end of each day to report on sales made in the previous 24 hours, use a processing time trigger set for every 24 hours. The benefit to using a processing time trigger is that when your query isn't running, your cluster can be used to run other jobs. This trigger provides a balance between latency and cost.  |
| **Available Now**    | If you have a stream of data that you need to process in a one-off fashion, but you don't want to have to reprocess data you already processed, use the available now trigger. This trigger is the most cost-effective trigger. You spin up a cluster to process all unprocessed data in your streaming source. Once the query terminates, you spin down the cluster. |
| **Once trigger** | You really shouldn't be using this: it's deprecated. Use the available now trigger. | 
| **Continuous trigger (experimental)** | The continuous trigger is an experimental mode trigger with limited support. This trigger only supports [stateless]() queries and doesn't emit any metrics. If you have a stateless pipeline and require single-digit millisecond latency, try this mode. |

## Examples

=== "Python"

    ``` python hl_lines="9 15 21 27"
    # Micro-batch (default) trigger (runs the next micro-batch as soon as it can)
    df.writeStream \
        .format("console") \
        .start()

    # Processing Time trigger with two-seconds between micro-batches 
    df.writeStream \
        .format("console") \
        .trigger(processingTime='2 seconds') \
        .start()

    # Available Now trigger
    df.writeStream \
        .format("console") \
        .trigger(availableNow=True) \
        .start()

    # Once trigger (Deprecated, encouraged to use Available Now trigger)
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

    ``` scala hl_lines="11 17 23 29"
    import org.apache.spark.sql.streaming.Trigger

    // Micro-batch (default) trigger (runs the next micro-batch as soon as it can)
    df.writeStream
        .format("console")
        .start()

    // Processing Time trigger with two-seconds between micro-batches 
    df.writeStream
        .format("console")
        .trigger(Trigger.ProcessingTime("2 seconds"))
        .start()

    // Available Now trigger
    df.writeStream
        .format("console")
        .trigger(Trigger.AvailableNow())
        .start()

    // Once trigger (Deprecated, encouraged to use Available Now trigger)
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

    ``` java hl_lines="11 17 23 29"
    import org.apache.spark.sql.streaming.Trigger

    // Micro-batch (default) trigger (runs the next micro-batch as soon as it can)
    df.writeStream
        .format("console")
        .start();

    // Processing Time trigger with two-seconds between micro-batches 
    df.writeStream
        .format("console")
        .trigger(Trigger.ProcessingTime("2 seconds"))
        .start();

    // Available Now trigger
    df.writeStream
        .format("console")
        .trigger(Trigger.AvailableNow())
        .start();

    // Once trigger (Deprecated, encouraged to use Available Now trigger)
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
    # Micro-batch (default) trigger (runs the next micro-batch as soon as it can)
    write.stream(df, "console")

    # Processing Time trigger with two-seconds between micro-batches 
    write.stream(df, "console", trigger.processingTime = "2 seconds")

    # TODO: Is Available Now supported?
    # Once trigger //deprecated?
    write.stream(df, "console", trigger.once = TRUE)

    # Continuous trigger is not yet supported
    ```
