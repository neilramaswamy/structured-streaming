This article provides an overview of of watermarks in Structured Streaming. For a gentle introduction to watermarks (that _motivates_ why we need them), please read the [Concepts section of the Tour](../../tour/stateful/concepts/time_domains.md).

Briefly put, a Structured Streaming query's _watermark_ is a timestamp in event-time before which the engine expects to receive no more records. You can specify the maximum delay that records from your source will have, and at the end of each batch, Structured Streaming will subtract the maximum delay from the maximum event-time that it saw to re-compute the watermark.

Once the engine has a timestamp before which it will no longer receive records, it can emit results and clean up state. For example, with aggregations, if it knows that it will receive no more events before 2pm, it can close all windows ending before 2pm. Then, it can remove those windows from state.

## Why do we need watermarks?

Streaming engines like Structured Streaming are SQL engines with one added complexity: the dataset over which they run queries is constantly changing. In the batch world, all the data a query runs on is at-rest in a table somewhere; in the streaming world, data constantly arrives.

This differences introduces some complexity. In the batch world, results for a query can be computed exactly: in a windowed aggregation, they can go through their table to perform the `groupBy`, and then apply the aggregation function. On the other hand, for a streaming engine, it might not have received all the events that belong to a particular window: that data might be constantly arriving.

So, this real-time nature of streaming raises the most central question of stream processing: when is a _result_ complete? For example, when can a straming engine declare a windowed agregation as being "done"? In a left outer join, when can the streaming engine declare that something on the left isn't going to match with anything on the right?

## Example

- Streaming engines are SQL engines with the added complexity that your dataset isn't known ahead of time: new records are always arriving
- If you have all your data, you can compute exact results
- If you don't have all your data (i.e. more data is always arriving in real-time), you can't compute exact results
- Example goes here

- When do you know when certain results are complete?
- You can track that you're complete up to a certain point
- 

- Measuring completeness

## The Latency-Completeness Tradeoff

here here 

## Interactions with Operators

table goes here