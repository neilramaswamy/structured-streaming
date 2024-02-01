# Monitoring query lifecycle events

The APIs described in [Managing the Query Lifecycle](./lifecycle.md) enable you to actively control the query lifecycle, but it's equally important to be able to more passively listen to events from the query lifecycle. If you run a real-time service (such as for fraud detection or security), you can write these events to your monitoring service so that you can get alerts if your streaming job has an issue.

## Emitted Events

There are 4 types of events that a Spark cluster emits about its streams are:

| Event Name | Description | Practical Advice |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `onQueryStarted`    | When a streaming query starts, an event is emitted with the query's ID and other identifiers. For more information, see [`QueryStartedEvent`](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryListener.QueryStartedEvent.html).                                                  | This event is primarily useful for logging a message to the console.                                                                                                                                                                                                  |
| `onQueryProgress`   | At the end of each streaming query's trigger, a progress event is emitted containing information such as trigger duration and processed row count. For more information, see [`QueryProgressEvent`](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryListener.QueryProgressEvent.html) and [`StreamingQueryProgress`](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryProgress.html).| You can use certain fields from this event to detect performance dips in your pipeline. For example, you can report the batch duration to a monitoring service, and you can configure that service to send an alert if batch duration increases by over 10%. |
| `onQueryTerminated` | When a streaming query terminates, with or without exception, an event is emitted containing its query ID and an optional exception. For more information, see [`QueryTerminatedEvent`](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryListener.QueryTerminatedEvent.html).                   | This event is important: if a streaming query terminates and there is an exception, you should report it to your monitoring service so that you investigate immediately.                                                                                                              |
| `onQueryIdle`       | As of Spark 3.4, when a streaming query is idle for more than a configurable threshold[^1], an event with its ID is emitted. For more information, see [`QueryIdleEvent`](https://spark.apache.org/docs/latest/api//java/org/apache/spark/sql/streaming/StreamingQueryListener.QueryIdleEvent.html).                   | If you expect your streaming query to constantly be processing data, an idle query means that the source is no longer producing data. While that would likely not be an issue with Structured Streaming, it could be a good indicator that your data pipeline has an issue.           |


Assuming that `spark` refers to your `SparkSession`, `spark.streams` gives you a `StreamingQueryManager`. See [Streaming query manager methods](https://spark.apache.org/docs/latest/api/python/reference/pyspark.ss/query_management.html?highlight=StreamingQueryManager).

[^1]:
    If your query is using a trigger in which it repeatedly executes micro-batches (like the default trigger or processing time trigger), it will emit an idle event if it doesn't find any new data in the source for more than `spark.sql.streaming.noDataProgressEventInterval` milliseconds. The default is 10,000 milliseconds.

## Active versus passive query management

Why do we need event-based listeners when we know that a query starts after we call `query.start()`? We can get the progress via `query.lastProgress` and we know that a query terminates after `query.awaitTermination()` returns. See [Managing the Query Lifecycle](./lifecycle.md). In other words, why are these APIs not sufficient?

The benefit of the event-based listener model is that it allows you to have _one piece of code_ that handles all events from all your streams You can have one place in which you write these events to a monitoring service of your choice (such as Grafana). Registering a `StreamingQueryListener` simplifies your query code since you won't need to instrument all of your streaming jobs to write to your monitoring service.

## Writing and registering a listener

To start, you'll first need to override the `StreamingQueryListener` interface. Then, you'll register the class that you create with your spark cluster, via your `SparkSession` object.

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

=== "Scala"

    <!-- TODO(neil) -->
