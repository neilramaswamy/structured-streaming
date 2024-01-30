# Controlling query lifecycle events

After you call `.start()` on your `DataStreamWriter`, your query will start running on your Spark cluster, and you'll get back a `StreamingQuery`. Through a `StreamingQuery`, you can do several things:

- You can manage its lifecycle: you can wait for it to terminate or throw an exception (which you can catch), or you can explicitly stop it
- You can read metadata about your query, like its name, query plan, and various metrics

This guide will focus mainly on managing the query lifecycle. You can find the `StreamingQuery` API for your language below, and you can read more about metrics from `StreamingQueries` on the [metrics]() guide.

???+ abstract "API Reference"

    === "Python"
        [:material-api: `StreamingQuery`](https://spark.apache.org/docs/latest/api/python/reference/pyspark.ss/api/pyspark.sql.streaming.StreamingQuery.html?highlight=streamingquery#pyspark.sql.streaming.StreamingQuery)

    === "Scala"
        [:material-api: `StreamingQuery`](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/streaming/StreamingQuery.html)
        
    === "Java"
        [:material-api: `StreamingQuery`](https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/streaming/StreamingQuery.html)

    
## Waiting indefinitely for termination

Suppose that you have a `StreamingQuery` called `query`. At this point, `query` is running on your cluster. There are three main ways that a query will terminate:

1. The query will no longer run any more micro-batches. This happens only when the query's trigger dictates that it should run a finite number of micro-batches, which is only when the query uses the [Available Now or Once triggers]().
2. The query is explicitly stopped via `query.stop()`. For a query using a trigger that can run an _infinite_ number of micro-batches, which is the default and Processing Time triggers, this is the only way to gracefully stop the query.
3. The query throws an exception.

Assuming that you want to wait for one of these conditions, you can use the `query.awaitTermination()` API. This method will block the calling thread until either of the first two conditions above happen. It may also throw an exception, so it's always good to wrap a call to `awaitTermination` in your languages exception-handling control structure.

## Waiting for a maximum amount of time

While the example above is usually what you'll use, the `awaitTermination` API is overloaded: it also excepts a `timeout` parameter, which specifies the maximum amount of time the call to `awaitTermination` will block for. This API is useful if you're using the Available Now or Once triggers, and you _expect_ the query to finish in a fixed amount of time (if it's taking longer than your timeout, it could be using your cluster resources more than you anticipated, causing your costs to increase beyond your expectations.)

For example, if your query _should_ take at maximum 30 seconds, you can `awaitTermination(30)`. This API returns you a boolean indicating whether the query terminated. If it didn't terminate, you can [explictly stop]() your query, via `query.stop()`. Then, you can send an alert to yourself so that you can investigate the issue:


<!-- TODO(neil): Example -->

## Exceptions and exception handling 

Spark queries may throw exceptions either when they're being constructed or during execution on the Spark cluster.

Any exceptions that happen when they're being constructed will happen when you're constructing your source `DataFrame`s, adding operators, or configuring your sink. For example, if you use a pass a column to an operator that your source `DataFrame` doesn't have, that will be caught _before_ execution. These types of exceptions, like `AnalysisException`s or `UnresolvedColumnReference` errors, are exceptions that you want to see in development. As such, there's no need to wrap the _construction_ of your query in exception handling control structures.

On the other hand, you _do_ want to gracefully catch exceptions during execution on the Spark cluster. You can wait for query termination using either overload of `awaitTermination`, and you can wrap that in your language's exception handling control structures. When an exception occurs, you can handle it with custom logic. For an `OutOfMemory` exception, you might just send an alert to your monitoring service; for another <!-- TODO(neil), which? --->, you might send an alert _and_ retry your query.

<!-- TODO(neil): Example -->

## Gracefully stopping queries

We've mentioned the `query.stop()` API a few times, and its worth adding a few more details about it. In general, there are three main situations in which you should use it:

1. You have a query that uses the Available Now or Once triggers, and they haven't terminated as soon as they should, and you want to just abort the whole query.
2. You have a query that uses the default or Processing Time triggers, and you don't want that job to run any longer.
3. You're developing your query in an interactive environment (like a notebook), and you just want it to stop (perhaps because you found a mistake in your code).

After `query.stop()` has been called, the query will finish the trigger it is currently executing and then exit.

## Reading metrics

<!-- TODO(neil) -->