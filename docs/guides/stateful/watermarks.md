# Watermarks in Structured Streaming

In Structured Streaming, having out of order data is normal and expected. For the streaming engine and stateful operators to produce complete, correct, and repeatable results, there must be a mechanism for determining when the stream won't receive any more events before a certain time (it needs to know, "I've received everything from before 4pm").

The name for such a timestamp is called a _watermark_. The engine computes the watermark at the end of each micro-batch by subtracting a user-provided maximum delay (called the _watermark delay_) from the maximum event-time seen in the most recently completed micro-batch.

Effectively, the watermark delay specifies the stream's tolerance for late data. Let's see why this is useful. Suppose you define an [aggregation operator](../stateful/aggregation.md) that aggregates data for non-overlapping 5 minute windows and the watermark delay is 1 minute. If the largest event time processed in a micro-batch is 4:02 PM, the engine would compute the watermark to be 4:01 PM. This tells the engine that all data before 4:01pm had been received. Then, the 3:55pm to 4:00pm window could never receive new records, and the aggregation operator could safely emit the aggregate value downstream.

Until a time window for stateful operations is closed, records are buffered and intermediate results are stored using a [state store](../stream_options/state_stores.md). The longer the delay specified by the watermark, the larger the size of the intermediate state data. Records arriving too late are dropped.

## Watermark general principles

There are three basic principles of watermarks in Structured Streaming.

### Principle 1: Watermarks are boundaries

Watermarks define the boundary between event-times the engine won't receive, and event-times the engine will receive. A watermark of 4pm tells the engine that it won't have to process any more events before 4pm.

/* TODO(neil): Insert a diagram here. */

### Principle 2: Watermark delays define watermarks

The _watermark delay_ is a user-specified maximum delay that events can have. The watermark is computed by subtracting the watermark delay from the largest event-time seen so far.

/* TODO(neil): Insert a diagram here. */

 ### Principle 3 

The watermark is recalculated at the end of each micro-batch.

## Watermark conceptual example

Let's assume a watermark delay defined as 5 minutes. Suppose further that micro-batch `a` runs at 2:50 PM and processes records for the following records:

- `t1` = 2:41 PM
- `t2` = 2:47 PM
- `t3` = 2:49 PM

After processing micro-batch `a`, the watermark is 2:44 PM (2:49 PM - 5 minutes). Next, let's assume further that micro-batch `b` runs at 2:55 PM and picks up the following records:

- `t4` = 2:43 PM
- `t5` = 2:45 PM
- `t6` = 2:53 PM

The record for `t4` is discarded as its timestamp value is less that our watermark value. The records for the other three records (`t5` and `t6`) are processed as their timestamp values are greater than our watermark value. After micro-batch `b` completes, the new watermark value is 2:48 PM (max of processed records - watermark delay). The record for `t5` is processed as part of micro-batch `b` even though its timestamp value (2:45 PM) is more than 5 minutes older than the maximum timestamp value in micro-batch `b` (2:48 PM). This is because the new watermark value is not calculated until micro-batch `b` completes and only applies to the next micro-batch.

!!! note
    Until the next micro-batch is processed, the watermark does not advance, no time windows close, and no intermediate results are emitted - regardless of the amount of time that passes.

## The tradeoff between completeness and latency

The watermark delay trades off latency and completeness in your pipeline. With a smaller watermark delay, the watermark progresses faster and reduces the time before a stateful operator's event-time windows closes. For example, if you have an event at 4:15 PM and your watermark delay is 30 minutes - your watermark is 3:45 PM. But, if your watermark delay is 5 minutes, your watermark is 4:10 PM.

While low-latency is generally considered good, there is a tradeoff:

- If your watermark delay `d` is smaller than the maximum delay `x`, your event-time window could finalize and close before receiving all records (resulting in less correct results in favor of lower latency). 
- If your watermark delay `d` is set to be larger than the maximum delay `x`, your window finalizes after receiving all records (resulting in more correct results at the expense of more latency). 

In practice, you'll usually have SLAs on how delayed data can be, so you should use that to set your watermark delay.

## Watermark required when aggregrating data and using append output mode

**Error message**: "Append output mode not supported when there are streaming aggregations on streaming DataFrames/DataSets without watermark".

Append output mode not supported when there are streaming aggregations on streaming DataFrames/DataSets without a watermark. This is by design. You must apply a watermark to the DataFrame if you want to use append mode on an aggregated DataFrame.

## Example

See [Aggregation with watermark](../../examples/aggregation-with-watermark.md).
