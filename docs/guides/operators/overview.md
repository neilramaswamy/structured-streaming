# Streaming Operators

In Structured Streaming, operators incrementally perform computation on a data stream as each batch of data arrives, such as filtering columns and rows, aggregating values, and performing joins. To process a given record, _stateless_ operators can do so independently of other records in the data stream, while _stateful_ operators need to use context ("state") of the other records they have seen in the data stream.

## Stateless operators

Stateless operators process each record in a stream independently of any other records in the stream. They do not maintain any accumulated state across batches or time intervals.

Use a stateless operator to limit the columns or the rows (or both) from a record that are emitted downstream. Examples of stateless operators include `map`, `filter`, and `flatMap`. See [projection and selection](../operators/stateless/projection_selection.md) and [additional stateless operators](../operators/stateless/additional_operators.md).

## Stateful operators

Stateful operators read each record in a stream and buffer previously seen rows. Stateful operators use [state stores](../stream_options/state_stores.md) to store these buffered records and intermediate state, and they leverage [watermarks](../operators/stateful/watermarks.md) to evict old state from the state store.

The most common stateful operator is the [aggregation](../operators/stateful/aggregation.md) operator. Because data for the same aggregate might occur across several micro-batches, it has to buffer the rows belonging to each aggregate in its state store. Naturally, the [deduplication](../operators/stateful/deduplication.md) operator is stateful, since it needs to remember what records it has seen before to eliminate duplicates. Finally, the [join](../operators/stateful/joins.md) operator is stateful since it needs to buffer rows from both streams to perform the join.

However, many use cases require custom code that is not covered by an existing stateful operator. For example, you might need to create session windows based on logic for your particular use-case. For such custom use-cases, you have to save your own custom state and do your own custom processing every micro-batch. 

Since Spark 2.2, this can be done using the operation `mapGroupsWithState` and the more powerful operation `flatMapGroupsWithState`. Both operations allow you to apply user-defined code on grouped Datasets to update user-defined state. For more concrete details, take a look at the API documentation ([Scala](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/streaming/GroupState.html)/[Java](https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/streaming/GroupState.html)) and the examples ([Scala](https://github.com/apache/spark/blob/v3.5.1/examples/src/main/scala/org/apache/spark/examples/sql/streaming/StructuredComplexSessionization.scala)/[Java](https://github.com/apache/spark/blob/v3.5.1/examples/src/main/java/org/apache/spark/examples/sql/streaming/JavaStructuredComplexSessionization.java)).

<!-- TODO(Neil): we need to mention applyInPandasWithState -->
