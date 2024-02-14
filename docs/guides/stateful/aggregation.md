# Aggregations

In Structured Streaming, you may want to aggregate data over an entire data stream, over data bucketed by one or more time windows, or both. 

<!--Window Operations on Event Time https://spark.apache.org/docs/latest/structured-streaming-programming-guide.html#window-operations-on-event-time-->

## What is a streaming aggregation?

Streaming aggregations allow you to compute functions over groups of your data—it's very similar to a `GROUP BY` in SQL, but with the added complication that we records can delayed and thus come out-of-order. Let's say that we have a stream of sales and want to compute the median sale-price per hour, in real-time. To do this, Structured Streaming needs to keep _state_ for each window, which, in this case, is effectively a dictionary from window to records. For example, let's say we make the following sales at a store:

- `$15` at 2:45pm
- `$10` at 2:30pm
- `$30` at 3:30pm

In this case, Structured Streaming's state would look like:

- [2pm, 3pm): `[$15, $10]`
- [3pm, 4pm): `[$30]`

Then, let's say it receives two more records:

- `$20` at 2:15pm
- `$25` at 3:15pm

Strucutred Streaming would then update its state to look like:

- [2pm, 3pm): `[$15, $10, $20]`
- [3pm, 4pm): `[$30, $25]`

Clearly, we've received events out-of-order. Structured Streaming is able to deal with this by buffering records in state, based on the records' event-times. The central question is, though: if Structured Streaming is buffering records per window, when will it emit an aggregate record downstream? There are two main options:

1. It can emit an aggregate once it's reasonably confident that aggregate won't change.
2. It can emit an aggregate every time an aggregate gets updated.

There are tradeoffs to both these approaches[^1], and we explore them below.

### Emitting aggregates when they won't change

When will an aggregate not change? Let's take our example from earlier. If we have a time window that ends at 3pm, the aggregate for that window won't change once we've received all records with event-times before 3pm (this isn't a clever insight; it's just the definition). So, if the streaming engine maintains a timestamp in event-time before which it won't receive any more records, it can close all windows with end-times less than that timestamp.

Such a timestamp is called a _watermark_. We will discuss how to compute a watermark very soon, but for now, let's just assume that we have a watermark. For the sake of our example, let's say the watermark becomes 3:05pm. At that point, the engine takes the following steps:

1. We find the windows with end-time less than 3:05pm. That's our 2pm to 3pm window.
2. We compute the aggregate (median) for it, which is `MEDIAN($15, $10, $20)`. So, we emit `([2pm, 3pm] -> $15)` by appending it to the downstream sink.
3. Finally, we clean up the state for the 2pm to 3pm window, leaving only the 3pm to 4pm window in state.

Neat! Here's the takeaway: in the streaming setting, you can _finalize_ a window and remove it from state the moment that the watermark advances past the end of that window.

### Emitting aggregates with every update

While we can wait until we know that the aggregate from a window won't change, it's also reasonable to emit an aggregate's value every time that it does change. Such behavior means that for the same window, we'll emit a record multiple times. From our example earlier, this would mean that after the first batch of records, we'd emit two records downstream:

1. [2pm, 3pm): `MEDIAN([$15, $10]) = $12.5`
2. [3pm, 4pm): `MEDIAN([$30]) = $30`

Then, after processing the next batch, we'd emit two more records downstream:

1. [2pm, 3pm): `MEDIAN([$15, $10]) = $10`
2. [3pm, 4pm): `MEDIAN([$30]) = $27.5`

There is a clear latency benefit here, which is that we're emitting aggregates whenever they change. However, this has more caveats than you might expect:

- The aggregate value "jitters," since every time the aggregate changes, the change is emitted.
- The downstream sink is written to more. If Structured Streaming writes every record and the downstream sink charges you per-write, you'll end up paying more.
- The downstream sink needs to support updates. It needs to have some notion of versioning or recency, so when that sink is read from, it returns the most up-to-date value. The supported sinks are here (TODO).

Finally, with this mode, we've discussed when aggregates are written to the sink (i.e. every update), but when are buffered records removed from state? Again, if we don't remove records from state, then the job will eventually run out of memory. Fortunately, if we hae a _watermark_, we can remove an aggregate from state when the streaming engine will never have to use that aggregate again, i.e. when the watermark exceeds the end of the given window.
