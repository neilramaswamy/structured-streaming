# Watermarks in Structured Streaming

In Structured Streaming, having out of order data is normal and expected. For the streaming engine and stateful operators to produce complete, correct, and repeatable results, there must be a mechanism for determining when the stream won't receive any more events before a certain time (it needs to know, "I've received everything from before 4pm").

The name for such a timestamp is called a _watermark_. The engine computes the watermark at the end of each micro-batch by subtracting a user-provided maximum delay (called the _watermark delay_) from the maximum event-time seen in the most recently completed micro-batch.

Effectively, the watermark delay specifies the stream's tolerance for late data. Let's see why this is useful. Suppose you define an [aggregation operator](../stateful/aggregation.md) that aggregates data for non-overlapping 5 minute windows and the watermark delay is 1 minute. If the largest event time processed in a micro-batch is 4:02 PM, the engine would compute the watermark to be 4:01 PM. This tells the engine that all data before 4:01pm had been received. Then, the 3:55pm to 4:00pm window could never receive new records, and the aggregation operator could safely emit the aggregate value downstream.

Until a time window for stateful operations is closed, records are buffered and intermediate results are stored using a [state store](../stream_options/state_stores.md). Once a time window has closed, buffered records and intermediate results are cleaned up and emitted downstream as appropriate for the given stateful operator. The longer the delay specified by the watermark, the larger the size of the intermediate state data. Records arriving too late are dropped.

## Watermark general principles

There are three basic principles of watermarks:

- When defining a watermark and its watermark delay, you walk the line between event times that you will and will not receive.
- The current watermark is recalculated at the end of processing each micro-batch.
- The current watermark trails the maximum time seen in the most recently completed micro-batch by the watermark delay value. 

## Watermark conceptual example

Let's assume a watermark delay defined as 5 minutes. Suppose you have source records with the following timestamp values:

- `t1` = 2:41 PM
- `t2` = 2:43 PM
- `t3` = 2:45 PM
- `t4` = 2:47 PM
- `t5` = 2:49 PM
- `t6` = 2:51 PM
- `t7` = 2:53 PM
- `t8` = 2:55 PM
- `t9` = 2:57 PM

Suppose further that micro-batch `a` runs at 2:50 PM and processes records for `t1`, `t4`, and `t5` (the `t2` and `t3` records are delayed). After processing micro-batch `a`, the watermark is 2:44 PM (2:49 PM - 5 minutes). 

Let's assume further that micro-batch `b` runs at 2:55 PM and picks up records for `t2`, `t3`, `t6`, and `t7`. 

- The record for `t2` is discarded as its timestamp value is less that our watermark value.
- The records for the other three records (`t3`, `t6`, and `t7`) are processed as their timestamp values are greater than our watermark value.
- After micro-batch `b` completes, the new watermark value is 2:48 PM (max of (`t2`, `t3`, `t6`, and `t7`) - 5).
- The record for `t3` is processed as part of micro-batch `b` even though its timestamp value (2:45 PM) is more than 5 minutes older than the maximum timestamp value in micro-batch `b` (2:48 PM). This is because the new watermark value is not calculated until micro-batch `b` completes and only applies to the next micro-batch.

!!! note
    Until the next micro-batch is processed, the watermark does not advance, no time windows close, and no intermediate results are emitted - regardless of the amount of time that passes.

## The tradeoff between completeness and latency

The watermark delay determines the latency of the data in your pipeline. A smaller watermark delay reduces the time before a stateful operator's event-time windows closes. While low-latency is generally considered good, there is a tradeoff:

- If your watermark delay `d` is smaller than the maximum delay `x`, your event-time window could finalize and close before receiving all records (resulting in less correct results in favor of lower latency). 
- If your watermark delay `d` is set to be larger than the maximum delay `x`, your window finalizes after receiving all records (resulting in more correct results at the expense of more latency). 

In practice, you'll usually have SLAs on how delayed data can be, so you should use that to set your watermark delay.

## Watermark required when aggregrating data and using append output mode

**Error message**: "Append output mode not supported when there are streaming aggregations on streaming DataFrames/DataSets without watermark".

Append output mode not supported when there are streaming aggregations on streaming DataFrames/DataSets without a watermark. This is by design. You must apply a watermark to the DataFrame if you want to use append mode on an aggregated DataFrame.

## Example

See [Aggregation with watermark](../../examples/aggregation-with-watermark.md).
