After you call `.start()` on your `DataStreamWriter`, your query will start running on your Spark cluster, and you'll get back a `StreamingQuery`. Through a `StreamingQuery`, you can do several things:

- You can manage its lifecycle: you can wait for it to terminate, handle exceptions, or explicitly stop it
- You can read metadata about your query, like its name, query plan, and various metrics

This guide will focus mainly on managing the query lifecycle. You can find the `StreamingQuery` API for your language below, and you can read more about metrics from `StreamingQueries` on the [metrics]() guide.

<!-- TODO: outlink -->

## Waiting for query termination

Suppose that you have a `StreamingQuery` called `query`. At this point, your query is likely already running on your cluster. If you _don't_ wait explicitly for your query's termination (and instead your program reaches its end), your query will still continue on the cluster in the background, but you won't be able to run any code _after_ it terminates.

The primary way to wait for a `StreamingQuery` to terminate, either normally or due to an exception, is the `awaitTermination` method. When invoked, this method will block the calling thread until either the query terminates or a runtime exception is thrown. A query only terminates on its own if it is using a trigger that runs a finite number of micro-batches, such as the [Available Now or Once triggers]().

By using `awaitTermination`, you can run exception-handling logic or query-cleanup code for your stream. We'll look into both in the next section.

## Gracefully handling exceptions

There are two primary types of exceptions you might encounter:

- An `AnalysisException` means that your query had a compile-time error; your query hasn't started on the cluster
- A `StreamingQueryException` means that your query had a runtime issue that was gracefully caught

- To handle these, you can wrap your call to `query = query.start()` in a try/catch in your language of choice
- You can access the exception that was thrown via `query.exception()`

## Stopping your query

- From your `StreamingQuery` object, you can get the lastProgress and recentProgress

