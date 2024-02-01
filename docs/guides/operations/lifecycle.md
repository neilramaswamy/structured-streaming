# Controlling query lifecycle events

Calling `.start()` on your `DataStreamWriter` starts your query on your Spark cluster. You'll get back a `StreamingQuery`. Through a `StreamingQuery`, you can do several things:

- You can manage its lifecycle:

    - You can wait for it to terminate or throw an exception (which you can catch).
    - You can explicitly stop it.

- You can read metadata about your query, such as its name, query plan, and various metrics.

This guide focuses on managing the query lifecycle. In the following box, follow the link for the `StreamingQuery` API in your language of choice, See [metrics]() to read about metrics from `StreamingQueries`.

???+ abstract "API Reference"

    === "Python"
        [:material-api: `StreamingQuery`](https://spark.apache.org/docs/latest/api/python/reference/pyspark.ss/api/pyspark.sql.streaming.StreamingQuery.html?highlight=streamingquery#pyspark.sql.streaming.StreamingQuery)

    === "Scala"
        [:material-api: `StreamingQuery`](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/streaming/StreamingQuery.html)
        
    === "Java"
        [:material-api: `StreamingQuery`](https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/streaming/StreamingQuery.html)
    
## Waiting indefinitely for termination

If you have a `StreamingQuery` called `query` running on your cluster, the streaming query will terminate when:

- There are no more micro-batches to run. This happens only when the query's trigger dictates that it should run a finite number of micro-batches, which is only when the query uses the [Available Now or Once triggers](../stream_options/triggers.md).
- The query is explicitly stopped using the `query.stop()` API. For the micro-batch trigger (the default trigger) and the Processing Time trigger, this is the only way to gracefully stop the query. Queries using these triggers can run an _infinite_ number of micro-batches. 
- The query throws an exception.

Assuming that you want to wait for one of these conditions, you can use the `query.awaitTermination()` API. This method will block the calling thread until either of the first two conditions happen. It may also throw an exception, so it's always good to wrap a call to `awaitTermination` in your languages exception-handling control structure.

## Waiting for a maximum amount of time

While the example above is usually what you'll use, the `awaitTermination` API is overloaded. It also accepts a `timeout` parameter, which specifies the maximum amount of time the call to `awaitTermination` blocks for. This API is useful if you're using the Available Now or Once triggers and you _expect_ the query to finish in a fixed amount of time. If it's taking longer than your timeout, it could be using your cluster resources more than you anticipated and causing your costs to increase beyond your expectations.

For example, if your query _should_ take at maximum 30 seconds, you can use `awaitTermination(30)`. This API returns you a boolean indicating whether the query terminated. If it didn't terminate, you can [explictly stop]() your query, via `query.stop()`. Then, you can send yourself an alert so that you can investigate the issue.

<!-- TODO(neil): Example -->

## Exceptions and exception handling

Spark queries may throw exceptions either when they're being constructed or during execution on the Spark cluster.

Exceptions that happen when the query is being constructed will happen when you're constructing your source `DataFrame`s, adding operators, or configuring your sink. For example, if you use a pass a column to an operator that your source `DataFrame` doesn't have, you need to catch it _before_ execution. These types of exceptions, like `AnalysisException`s or `UnresolvedColumnReference` errors, are exceptions that you want to detect during development. For these types of exceptions, there's no need to wrap the _construction_ of your query in exception handling control structures.

On the other hand, excpetions that you _do_ want to gracefully catch are those that occur during execution on the Spark cluster. You can wait for query termination using either overload of `awaitTermination`, and wrap that in your language's exception handling control structures. When an exception occurs, you can handle it with custom logic. For an `OutOfMemory` exception, you might just send an alert to your monitoring service; for another <!-- TODO(neil), which? --->, you might send an alert _and_ retry your query.

<!-- TODO(neil): Example -->

## Gracefully stopping queries using `query.stop()`

There are three main situations in which you should use the `query.stop()` API:

- You have a query that uses the Available Now or Once triggers, and they haven't terminated as soon as they should, and you want to just stop the whole query.
- You have a query that uses the default or Processing Time triggers, and you don't want that job to run any longer.
- You're developing your query in an interactive environment (like a notebook), and you just want it to stop (perhaps because you found a mistake in your code).

After `query.stop()` has been called, the query will finish the trigger it is currently executing and then exit.

## Reading metrics

<!-- TODO(neil) -->