# Streaming Operators

In Structured Streaming, operators incrementally perform computation on a data stream as each batch of data arrives, such as filtering columns and rows, aggregating values, and performing joins. To process a given record, _stateless_ operators can do so independently of other records in the data stream, while _stateful_ operators need to use context ("state") of the other records they have seen in the data stream.

Whether stateful or stateless, Structured Streaming provides flexibility to handle various use cases efficiently.
Remember that the choice between stateful and stateless operators depends on the complexity of your processing logic and the specific requirements of your streaming application.

## Stateless operators

Stateless operators process each record in a stream independently of any other records in the stream. These operators are well-suited for simpler operations. They do not maintain any accumulated state across batches or time intervals.

Use a stateless operator to limit the columns or the rows (or both) from a record that are emitted downstream. Examples of stateless operators include `map`, `filter`, and other "higher order" functions. See [projection and selection](../operators/stateless/projection_selection.md) and [additional stateless operators](../operators/stateless/additional_operators.md).

## Stateful operators

Stateful operators, on the other hand, read each record in a stream and remember information (keep the state) for all records in the data stream for a defined period of time. For example, an aggregation operator that calculates a running total of sales per hour from the data stream requires that the stateful operator keep track of (remember) information from the records in the stream during each hour to calculate the hourly totals. Similarly, an aggregation operator could be operating on the same data stream to calculate a running total of sales per day. When performing deduplication, the deduplication operator must remember previous records to determine if there is duplication.

In the world of streaming, stateful operations need to buffer records and intermediate state to compute their results: records for the same event-time window, for example, might arrive across several micro-batches. Stateful operators use state stores to store these buffered records and intermediate state. State stores are configurable key-value stores. See [state stores](../stream_options/state_stores.md). In Spark’s Structured Streaming, state is abstracted away from the user to enable aggregation operators like agg.
The architecture incorporates state implicitly, allowing you to focus on high-level operations without explicitly managing state.

While stateful operations provide powerful capabilities, they can be more memory-intensive and may require careful scaling considerations. For example, see [watermarks](../operators/stateful/watermarks.md) for a discussion about the tradeoffs between latency and accuracy.

### Common stateful operators

The most common stateful operators are [aggregations](../operators/stateful/aggregation.md), [deduplication](../operators/stateful/deduplication.md), and [stream-stream joins](../operators/stateful/joins.md).

### Arbitrary stateful operations

However, many use cases require more advanced stateful operations than aggregations. For example, in many use cases, you have to track sessions from data streams of events. For doing such sessionization, you will have to save arbitrary types of data as state, and perform arbitrary operations on the state using the data stream events in every trigger. Since Spark 2.2, this can be done using the operation `mapGroupsWithState` and the more powerful operation `flatMapGroupsWithState`. Both operations allow you to apply user-defined code on grouped Datasets to update user-defined state. For more concrete details, take a look at the API documentation ([Scala](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/streaming/GroupState.html)/[Java](https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/streaming/GroupState.html)) and the examples ([Scala](https://github.com/apache/spark/blob/v3.5.1/examples/src/main/scala/org/apache/spark/examples/sql/streaming/StructuredComplexSessionization.scala)/[Java](https://github.com/apache/spark/blob/v3.5.1/examples/src/main/java/org/apache/spark/examples/sql/streaming/JavaStructuredComplexSessionization.java)).
