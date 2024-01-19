<!-- 
[x] denotes that the article addresses the respective Google search:

spark structured streaming batch interval [x]
spark structured streaming continuous trigger [x]
spark structured streaming default trigger interval [x]
spark structured streaming trigger once [x]
spark structured streaming trigger [x]
spark structured streaming trigger once [x]
spark structured streaming trigger processingtime [x]
spark structured streaming interval [x]

-->


# Triggers

Structured Streaming repeatedly reads and processes data from the source in micro-batches; triggers configure how frequently a Structured Streaming query runs its micro-batches. The following are some examples of trigger definitions:

- Start a micro-batch immediately after the previous micro-batch finishes
- Start a micro-batch periodically, such as hourly or daily

While starting a micro-batch immediatley after the previous micro-batch finishes is great for low-latency use-cases, starting a micro-batch periodically still provides the benefits of streaming pipelines, such as incremental processing of the source, guaranteed delivery semantics, and automatic clean-up of old state from stateful operators.

<!-- TODO(neil): Add a link to the "migration" guide. -->
!!! tip
    If you have a batch Spark job that you run as a [cron job](https://wikipedia.org/wiki/Cron), consider running it as a Structured Streaming job with a periodic trigger. It will be more reliable and efficient than repeated batch jobs.

## What are the available trigger types?

<!-- TODO(neil): is maxFilesPerTrigger really maxFilesPerMicroBatch? -->
| Trigger | Description                          |
| ----------- | ------------------------------------ |
| **Micro-batch trigger (default)**       | The default trigger is the Micro-batch trigger, where a micro-batch starts as soon as the previous micro-batch completes. Since there is no delay between micro-batches, the default trigger interval is effectively 0 seconds.  |
| **Processing Time trigger**      | The Processing Time trigger starts micro-batches at a user-defined interval. If a micro-batch completes within this interval, Spark waits until the interval elapses for the next one. If a micro-batch exceeds the interval duration, the next one starts immediately upon completion, without waiting for the next interval. |
| **Available Now trigger**    | The Available Now trigger starts a query that processes all available data at time of query creation and then exits. It processes the data in multiple micro-batches based on the source options (such as `maxFilesPerTrigger` for the file source). It processes all unprocessed data as of the time when the query starts. It does not process data that arrives _during_ the execution of the micro-batches. |
| **Once trigger (deprecated)** | The Once trigger starts a query that processes all unprocessed data at the time of query creation in _one_ batch. Beware: it will not respect source options.
| **Continuous trigger (experimental)** | The Continuous trigger starts a query that executes in a low-latency, continuous processing mode. See [Continuous trigger](). |

## What is the use case for each trigger type?

The following table describes the use case for each trigger type.

| Trigger | Use case |
| ----------- | ------------------------------------ |
| **Micro-batch (default) trigger**       | If latency is your most important requirement, use the Micro-batch trigger for the lowest latency. With this trigger, you can process data as fast as possible. |
| **Processing Time trigger**       | If you have a stream of data that needs to be processed _without_ a real-time latency requirement, use the Processing Time trigger. For example, if your goal is to generate a daily report at the end of each day to report on that day's sales, use a Processing Time trigger set for 24 hours. The benefit to using a Processing Time trigger is that when your query isn't running, your cluster can be used to run other jobs. This trigger provides a balance between latency and cost.  |
| **Available Now**    | If you have a stream of data that you need to process in a one-off fashion, but you don't want to have to reprocess data you already processed, use the Available Now trigger. This trigger is the most cost-effective trigger. You could spin up a cluster, run a stream with an Available Now trigger, wait for it to terminate [^1], and then spin down your cluster. |
| **Once trigger (deprecated)** | You really shouldn't be using the Once trigger: it's deprecated. Use the Available Now trigger. | 
| **Continuous trigger (experimental)** | The Continuous trigger is an experimental mode trigger with limited support. This trigger only supports [stateless]() queries and doesn't emit any metrics. If you have a stateless pipeline and require single-digit millisecond latency, try this mode. |

[^1]:
    We discuss how to wait for termination (and other such lifecycle events) in [Managing the Query Lifecycle]().

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
