This article provides an overview of of watermarks in Structured Streaming. For a gentle introduction to watermarks (that _motivates_ why we need them), please read the [Concepts section of the Tour](../../tour/stateful/concepts/time_domains.md).

Briefly put, a Structured Streaming query's _watermark_ is a timestamp in event-time before which the engine expects to receive no more records. You can specify the maximum delay that records from your source will have, and at the end of each batch, Structured Streaming will subtract the maximum delay from the maximum event-time that it saw to re-compute the watermark.

Once the engine has a timestamp before which it will no longer receive records, it can emit results and clean up state. For example, with aggregations, if it knows that it will receive no more events before 2pm, it can close all windows ending before 2pm. Then, it can remove those windows from state.

## The Completeness and Latency Tradeoff

TODO.