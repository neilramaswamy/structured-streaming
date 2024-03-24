The APIs described in [Managing the Query Lifecycle](./lifecycle.md) enable you to synchronously manage the query lifecycle, but it's equally important to be able to asynchronously (i.e. passively) listen to events from the query lifecycle. If you run a real-time service (in the fraud detection or security areas), you can write these events to your monitoring service so that you can get alerts if your streaming job has an issue.

## Emitted Events

There are 4 types of events that a Spark cluster emits about its streams:

| Event Name          | Description                                                                                                                                     | Practical Advice                                                                                                                                                                                                                                                            |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `onQueryStarted`    | When a streaming query starts, an event is emitted with the query's ID and other identifiers.                                                   | Beyond logging a message to the console, this event will likely not be very helpful.                                                                                                                                                                                        |
| `onQueryProgress`   | At the end of a streaming query's trigger, a "progress" event is emitted, containing information like trigger duration and processed row count. | You can use certain fields from this event to detect performance dips in your pipeline. For example, you can report the batch duration to a monitoring service, and you can configure that service to send an alert if batch duration increases by over 10%.                |
| `onQueryTerminated` | When a streaming query terminates, with or without exception, an event is emitted with its query ID and an optional exception.                  | This event is important: if a streaming query terminates and there is an exception, you should report it to your monitoring service so that you investigate immediately.                                                                                                    |
| `onQueryIdle`       | As of Spark 3.4, when a streaming query is idle for more than a configurable threshold[^1], an event with its ID is emitted.                    | If you expect your streaming query to constantly be processing data, an idle query means that the source is no longer producing data. While that would likely not be an issue with Structured Streaming, it could be a good indicator that your data pipeline has an issue. |

[^1]:
    If your query is using a trigger in which it repeatedly executes micro-batches (like the default trigger or processing time trigger), it will emit an "idle" event if it doesn't find any new data in the source for more than `spark.sql.streaming.noDataProgressEventInterval` milliseconds. It defaults to 10,000 milliseconds.

## Active vs. Passive Query Management

Shortly, we'll go into details about how to write code to handle these events, but a reasonable question is: why do we need event-based listeners when we know that a query starts after we call `query.start`, we can get the progress via `query.lastProgress`, and we know that a query terminates after `query.awaitTermination` returns? In other words, why deviate from the advice given in [Managing the Query Lifecycle](./lifecycle.md)?

The benefit of the event-based listener model is that it allows you to have _one piece of code_ that handles all events from all your streams: you can have one place in which you write these events to a monitoring service of your choice (like Grafana). Registering a `StreamingQueryListener` will vastly simplify your query code, since you won't need to instrument all of your streaming jobs to write to your monitoring service.


## Writing and Registering a Listener

In any language, you'll first need to override the `StreamingQueryListener` interface. Then, you register the class that you create with your spark cluster, via your `SparkSession` object:

=== "Python"

    :material-api: [`StreamingQueryListener`](https://spark.apache.org/docs/latest/api/python/reference/pyspark.ss/api/pyspark.sql.streaming.StreamingQueryListener.html?highlight=streamingquerylistener#pyspark.sql.streaming.StreamingQueryListener)

    :material-api: [`StreamingQueryManager.addListener`](https://spark.apache.org/docs/latest/api/python/reference/pyspark.ss/api/pyspark.sql.streaming.StreamingQueryManager.addListener.html?highlight=addlistener)

    ```python
    from pyspark.sql.streaming import StreamingQueryListener
    from pyspark.sql.streaming.listener import (
        StreamingQueryProgress,
        QueryStartedEvent,
        QueryProgressEvent,
        QueryTerminatedEvent,
        QueryIdleEvent,
    )

    class MyListener(StreamingQueryListener):
        def onQueryStarted(self, event: QueryStartedEvent): # (1)!
            pass

        def onQueryProgress(self, event: QueryProgressEvent): # (2)!
            progress: StreamingQueryProgress = event.progress() # (3)!
            pass

        def onQueryIdle(self, event: QueryIdleEvent): # (4)!
            pass

        def onQueryTerminated(self, event: QueryTerminatedEvent): # (5)!
            wasException = event.exception()
            pass
    
    spark.streams.addListener(MyListener()) # (6)!

    # If you ever need to remove a listener
    spark.streams.removeListener(MyListener())
    ```

    1. Unfortunately, there are no PySpark docs for the query events. The Java `QueryStartedEvent` is [here](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryListener.QueryStartedEvent.html).
    2. The Java `QueryProgressEvent` is [here](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryListener.QueryProgressEvent.html).
    3. The `StreamingQueryProgress` event has all the metrics associated with the execution of a given trigger. Its Java doc is [here](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryProgress.html).
    4. The Java `QueryIdleEvent` is [here](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryListener.QueryIdleEvent.html).
    5. The Java `QueryTerminatedEvent` is [here](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryListener.QueryTerminatedEvent.html)
    6. Assuming that `spark` refers to your `SparkSession`, `spark.streams` gives you a `StreamingQueryManager`, whose methods you can find [here](https://spark.apache.org/docs/latest/api/python/reference/pyspark.ss/query_management.html?highlight=StreamingQueryManager).

=== "Scala"

    <!-- TODO(neil) -->

<!-- TODO(neil): I think we might need to add the operator progress to this article. -->