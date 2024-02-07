Every micro-batch that Structured Streaming runs generates a set of metrics called the _streaming query progress_. These metrics contain information like what offsets the source processed, how long the batch took to execute, state store metrics, and much more. If you're ever debugging an issue in a pipeline, looking at the streaming query progress is the first place you should start.

## Accessing Query Progress

There are two main ways that you can get access to a `StreamingQueryProgress` object, either through the `StreamingQuery` object itself (introduced in the [query lifecycle](./lifecycle.md) guide), or the `QueryProgressEvent` (introduced in [monitoring](./monitoring.md) guide).

### Via a `StreamingQuery`

A `StreamingQuery` object has two methods to get streaming query progress:

- The `lastProgress` method returns the `StreamingQueryProgress` for the last _completed_ micro-batch.
- The `recentProgress` method returns a list of the most recent [^1] `StreamingQueryProgress` objects, sorted in ascending order with respect to batch.

[^1]:
    By default, the progress for the past 100 micro-batches is stored. This value is configurable via `spark.sql.streaming.numRecentProgressUpdates`.

If you're in an interactive session, usually the `lastProgress` method will be the most useful for you. The `recentProgress` member can be useful if you want to create a custom visualization based off of recent streaming query progress data.

### Via a `QueryProgressEvent`

Registered streaming query listeners will receive a `QueryProgressEvent`, if they override the `onQueryProgress` method. The `QueryProgressEvent` has a member named `progress` that contains a `StreamingQueryProgress` object.

## The `StreamingQueryProgress` object

There are so many lovely things in the streaming query progress!

<!-- TODO(neil) -->

