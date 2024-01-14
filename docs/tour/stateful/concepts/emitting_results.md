The last section motivated why we should use _event-time_ in our stateful operators. Now, we'll explore our first stateful streaming operator, the streaming aggregation, which will motivate our next exciting concept, _output mode_.

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

## Output Modes

The behavior of when output from aggregations is written to the sink is configured via the streaming job's _Output Mode_ (TODO reference).

The first mode we discussed, where the engine "emits aggregates when they won't change" by using the watermark, is called "Append mode". It's called Append mode since it appends one row to the sink whenever it knows an aggregate is done. The second mode we discussed, where the engine "emits aggregates every update", is called "Update mode". You'll see how to actually set an Output Mode when you write your first aggregation, in just one more section (TODO).

<!-- TODO: The following sub-section might be better put in the reference. -->

## Choosing the Right Output Mode

The most significant factor in what Output Mode you choose is the semantics of your application. If you're running a push-notification service whose sink will send a notification for every new record, you likely want to use Append Mode, since you can't update a push notification after it has been sent. On the other hand, if you're downstream sink is powering a real-time dashboard, you could use Update mode so that your dashboard stays as fresh as possible.

Here's a summary of everything we've discussed in this section:

|                            | OutputMode.Append            | OutputMode.Update                                |
| -------------------------- | ---------------------------- | ------------------------------------------------ |
| Sink support               | All sinks                    | Subset of sinks                                  |
| # of writes to sink        | The number of aggregations   | Some constant \* the number of aggregations [^2] |
| When to emit               | After aggregate is finalized | Every update                                     |
| When state removal happens | After aggregate is finalized | After aggregate is finalized                     |

<br />

[^1]: For readers with other streaming engine experience, you'll know that these aren't the _only_ two options. You could, for example, emit updated aggregates every minute, or when an aggregate changes `k` times. Those aren't yet supported, so we don't discuss them here.
[^2]: Structured Streaming will emit aggregations that have updated at the end of every micro-batch. So, if two aggregations are updated across `k` micro-batches, then `2k` writes to the sink will be made.
