# Aggregations in Structured Streaming

Aggregations over a sliding event-time window ("streaming aggregations") with Structured Streaming are very similar to using `GROUP BY` in batch operations in SQL. In a grouped aggregation, aggregate values (such as counts or averages) are maintained for each unique value in the user-specified grouping column. In Structured Streaming, the grouping column is time, and event-time is the time embedded in the data itself. 

This allows window-based aggregations (e.g. number of events every minute) to be just a special type of grouping and aggregation on the event-time column – each time window is a group and each row can belong to multiple windows/groups. Structured Streaming has the added complication that records can delayed and thus come out-of-order. In case of window-based aggregations in Structured Streaming, aggregate values are maintained for each window into which the event-time of a row falls.

The central questions for streaming aggregations is how long to wait for late arriving records to arrive and when to emit aggregation values downstream (intermitently or when no more updates will be received). 

## Conceptual example of streaming aggregations

Suppose that you have a stream of sales and want to compute the median sale-price per hour, in real-time. To do this, Structured Streaming needs to keep _state_ for each event-time window. For example, let's say we make the following sales at a store at the following times:

- `$15` at 2:45pm
- `$10` at 2:30pm
- `$30` at 3:30pm

Let's assume that Structured Streaming has received this data as of 3:45 PM. In this case, Structured Streaming's state for hour windows would look like the following:

- [2pm, 3pm): `[$15, $10]`
- [3pm, 4pm): `[$30]`

Then, let's say the aggregation operator receives two more records at 4:00 PM:

- `$20` at 2:15pm
- `$25` at 3:15pm

Structured Streaming would use the event time rather than the time received then update its state to look like the following:

- [2pm, 3pm): `[$15, $10, $20]`
- [3pm, 4pm): `[$30, $25]`

So, the central questions are:
- When should the streaming aggregation emit records downsteam, after each update or after it knows that no additional records will be received for a given time window?
- When should the streaming aggregation stop updating the streaming aggregation because too much time has passed?

## When to emit streaming aggregation values

See [Output modes](../stream_options/output_mode.md)

## When to stop updating streaming aggregation values

See [Watermarks]()

