# Watermarks in Structured Streaming

In Structured Streaming, stateful operators buffer records and intermediate results using a [state store](../stream_options/state_stores.md). A [watermark]() for a stateful operator determines how long the streaming operator should wait for new records to appear for a given event-time window, and when the engine can clean up buffered records and intermediate results to limit the size of intermediate state data. Records arriving too late are dropped. See [aggregations with watermarks](../stateful/aggregation.md) for a discussion of watermarks with streaming aggregations.

!!! important
    Always specify a watermark to prevent unlimited growth of intermediate aggregate values consuming memory and potentially causing a machine crash due to out-of-memory errors.

## Watermark conceptual example

Suppose you have a source record `foo` generated at `t1` (its event time). Suppose also that there is a delay of `x` minutes (or hours or days) before this record arrives as part of the data stream.

Since `x` can conceptually be infinite, you use a watermark to tell a stateful operator how long to wait for delayed records to arrive, and to drop all records older than this time. 

A watermark value of `y` for a stateful operator tells the streaming engine to not receive any new records older than `t1` - `y`. So, if the stateful operator receives a single record in a microbatch with `t1` = 2:45 PM and if the watermark is set to 30 minutes (`y`), the timestamp before which records in the next microbatch will not be received is 2:15 PM (2:45pm - 30 minutes).

If the timestamps for event time in the next microbatch include records with timestamps of 2:00 PM (`t2`), 3:00 PM (`t3`), and 3:15 PM (`t4`):

- The record with a timestamp of `t2` is dropped because it is older than 2:15 PM.
- The records with timestamps of `t3` and `t4` are added to the buffer and update intermediate results in state.
- The new time before which the streaming operator will not receive new records is 2:45 PM (`MAX(t1, t2, t3) - y`).
- The streaming engine removes from state all records whose timestamp is older than 2:45 PM.
- Emit downstream values for windows whose endtime is less thanb 2:45 PM.


## The Completeness and Latency Tradeoff

The watermark delay determines the latency of our pipeline. A smaller watermark delay reduces the time before a stateful operator's windows closes. While low-latency is generally considered good, there is a tradeoff:

- If your watermark delay `y` is smaller than the maximum delay `x`, your window could finalize and close before receiving all records (resulting in less correct results in favor of lower latency). 
- If your watermark delay `y` is set to be larger than the maximum delay `x`, your window finalizes after receiving all records (resulting in more correct results at the expense of more latency). 

In practice, you'll usually have SLAs on how delayed data can be, so you should use that to set your watermark delay.

<!--until next microbatch closes a window, nothing get emitted - if delay if recieving next batch of data, window stays open-->