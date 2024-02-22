# Aggregations in Structured Streaming

Aggregations over a sliding event-time window ("streaming aggregations") with Structured Streaming are very similar to using `GROUP BY` in batch operations in SQL. In a grouped aggregation, aggregate values (such as counts or averages) are maintained for each unique value in the user-specified grouping column. 

In Structured Streaming, the grouping column is time, and event-time is the time embedded in the data itself. This allows window-based aggregations (such as the number of events every minute) to be just a special type of grouping on the event-time column – each time window is a group and each row can belong to multiple windows (groups). 

Aggregations in Structured Streaming have the added complication that records can delayed and thus come out-of-order (records earlier in time can arrive after records later in time). In Structured Streaming, aggregate values are maintained for each window into which the event-time of a row falls. 

## Conceptual example of streaming aggregations

Suppose that you have a stream of sales and want to compute the total revenue generated _every hour_ in real-time. To do this, Structured Streaming needs to keep _state_ for each event-time window for sales during each hour. For example, let's say we make the following sales at a store at the following times:

- `$15` at 2:30pm
- `$10` at 2:40pm
- `$30` at 3:10pm

Let's assume that Structured Streaming has received this data as of 3:15 PM. In this case, Structured Streaming's state for the 2:00 o'clock and the 3 o'clock hours is:

- [2pm, 3pm): $25
- [3pm, 4pm): $30

Then, let's say the aggregation operator receives two more records at 3:30 PM:

- `$20` at 2:15pm
- `$25` at 3:15pm

Structured Streaming uses the event time rather than the time received to update its state as follows:

- [2pm, 3pm): $45
- [3pm, 4pm): $55

## Handling late arriving records

Because there can be late arriving records, the central questions for streaming aggregations are:

- When should the streaming aggregation operator stop updating the streaming aggregation value. Options are to keep updating indefinitely until the stream is stopped or to wait for a specific amount of time, such as 15 minutes after the event-time window has passed.
- When to emit aggregation values downstream. Options are after each update or after it knows that no additional records can be processed for a time window.

### When to emit streaming aggregation values

The [output mode](../stream_options/output_mode.md) determines when the streaming aggreation operator emits aggregate values.

- **Append mode**: By default, all streaming queries run in append mode. In this mode, streaming operators only emit rows that won't change in future triggers.
- **Update mode**: In update mode, streaming operators emit all rows that changed during the trigger, even if the emitted record might change in a subsequent trigger.
- **Complete mode**: In complete mode, _all_ resulting rows ever produced by the streaming operator are emitted downstream.

### When to stop updating streaming aggregation values

The [watermark]() for a streaming aggregation operator determines how long the streaming operator should wait for new records to appear for a given event-time window, and when the engine can clean up old aggregates to limit the size of intermediate state data. Records arriving too late are dropped, rather than updating the aggregated value. <!--say something here about how to decide how long to wait? Question for Neil / Carl -->

!!! important
    Always specify a watermark to prevent unlimited growth of intermediate aggregate values consuming memory and potentially causing a machine crash due to out-of-memory errors.

## Time windows

Spark supports three types of event-time windows for aggregations:

- **Tumbling (fixed) windows**: Tumbling windows are a series of fixed-sized, non-overlapping and contiguous time intervals, such as every 60 minutes. An input can only be bound to a single window. Tumbling uses the `window` function. See [Examples of aggregations with event-time window](#examples-of-aggregations-with-event-time-windows).

    ![tumbling windows](/assets/tumbling_windows.png)

- **Sliding windows**: Sliding windows are also _fixed-sized_, but windows can overlap if the duration of the slide is smaller than the duration of window. For example, the window could be a duration of 10 minutes with a slide of 5 minutes. In this case an input can be bound to the multiple windows. Sliding uses the `window` function. See [Examples of aggregations with event-time window](#examples-of-aggregations-with-event-time-windows).

    ![sliding windows](/assets/sliding_windows.png)

- **Session windows**: Session windows have a dynamic size of the window length, depending on the inputs. A session window starts with an input, and expands itself if following input has been received within gap duration. For example, the session window can be set for 5 minutes with a gap duration of an additional 5 minutes. For static gap duration, a session window closes when there’s no input received within gap duration after receiving the latest input. Session window uses session_window function. See [Examples of aggregations with event-time window](#examples-of-aggregations-with-event-time-windows).

    ![session windows](/assets/session_windows.png)

    Instead of static gap value, you can also provide an expression to specify gap duration dynamically based on the input row. Rows with negative or zero gap duration are filtered out from the aggregation.

    With dynamic gap duration, the closing of a session window does not depend on the latest input. Rather, a session window’s range is the union of all events’ ranges which are determined by event start time and evaluated gap duration during the query execution. See [Examples of aggregations with event-time window](#examples-of-aggregations-with-event-time-windows).

    Session windows have the following restrictions:

    - Update mode as output mode is not supported.
    - There must be at least one column in addition to session_window in the grouping key.

    By default, Spark does not perform partial aggregations for session window aggregation, since it requires additional sort in local partitions before grouping. Session windows perform best when there are only a few input rows in same group key for each local partition.
    
    For the case where there are numerous input rows having same group key in local partition, doing partial aggregations can increase the performance significantly despite additional sort. Use `spark.sql.streaming.sessionWindow.merge.sessions.in.local.partition` to enable Spark to perform partial aggregations.

### Conditions for watermarking to clean aggregation state

The following conditions must be satisfied for the watermarking to clean the state in aggregation queries (as of Spark 2.1.1).

- Output mode must be _Append_ or _Update_. In complete mode, _all_ resulting rows ever produced by the operator are emitted downstream, and therefore there is no intermediate state to drop.
- The aggregation must have either the event-time column, or a window on the event-time column.
-  `withWatermark` must be called on the same column as the timestamp column used in the aggregate. For example, `df.withWatermark("time", "1 min").groupBy("time2").count()` is invalid in _Append_ output mode, as watermark is defined on a different column from the aggregation column.
- `withWatermark` must be called before the aggregation for the watermark details to be used. For example, `df.groupBy("time").count().withWatermark("time", "1 min")` is invalid in _Append_ output mode.

### Semantic guarantees of aggregation with watermarking

A watermark delay of _2 hours_ guarantees that the engine never drops any data that is less than 2 hours delayed. In other words, any data less than 2 hours behind the latest data processed till then (in terms of event-time) is guaranteed to be aggregated.

However, the guarantee is strict only in one direction. Data delayed by more than 2 hours is not guaranteed to be dropped; it may or may not get aggregated. More delayed is the data, less likely is the engine going to process it. <!--this needs more elaboration Neil / Carl -->

## Examples of aggregations with event-time windows

??? examples

    === "Python"

        ```python
        spark = SparkSession. ...
        
        # Apply watermark to handle late data using tumbling or sliding window

            windowedCounts = df \
                .withWatermark("timestamp", "15 seconds") \
                .groupBy(
                    functions.window(col("timestamp"), "10 seconds"),
                    col("value")
                ) \
                .count()

        # Apply watermark to handle late data using static session window

            windowedCounts = df \
                .withWatermark("timestamp", "15 seconds") \
                .groupBy(
                    session.window(col("timestamp"), "10 seconds"),
                    col("value")
                ) \
                .count()

        # Apply watermark to handle late data using dynamic session window

            sessionWindowExpr = when(col("storeId") == "store1", "5 seconds") \
                .when(col("storeId") == "store2", "20 seconds") \
                .otherwise("15 seconds")

            # Create a session window column
            sessionWindowCol = window(col("timestamp"), sessionWindowExpr)

            # Apply watermark to handle late data
            windowedCounts = df \
                .withWatermark("timestamp", "15 seconds") \
                .groupBy(sessionWindowCol, col("value")) \
                .count()

        ```

    === "Scala"
        ```scala

        val spark: SparkSession = ...

        // Apply watermark to handle late data using tumbling or sliding window

            val windowedCounts = df
                .withWatermark("timestamp", "15 seconds")
                .groupBy(
                    functions.window(col("timestamp"), "10 seconds"),
                    col("value")
                )
                .count() 

        // Apply watermark to handle late data using static session window

            val windowedCounts = df
                .withWatermark("timestamp", "15 seconds")
                .groupBy(
                    session.window(col("timestamp"), "10 seconds"),
                    col("value")
                )
                .count()

        # Apply watermark to handle late data using dynamic session window

            val sessionWindowExpr = when(col("storeId") === "store1", "5 seconds")
                .when(col("storeId") === "store2", "20 seconds")
                .otherwise("15 seconds")

            // Create a session window column
            val sessionWindowCol = window(col("timestamp"), sessionWindowExpr)

            // Apply watermark to handle late data
            val windowedCounts = df
                .withWatermark("timestamp", "15 seconds")
                .groupBy(sessionWindowCol, col("value"))
                .count()

        ```
    
    === "Java"

        ```java
        SparkSession spark = ...

        // Apply watermark to handle late data using tumbling or sliding window
        
            Dataset<Row> windowedCounts = df
                .withWatermark("timestamp", "15 seconds")
                .groupBy(
                        session_window(col("timestamp"), "10 seconds"),
                        col("value")
                )
                .count();

        // Apply watermark to handle late data using static session window
        
            Dataset<Row> windowedCounts = df
                .withWatermark("timestamp", "15 seconds")
                .groupBy(
                     functions.window(col("timestamp"), "10 seconds"),
                      col("value")
                    )
                    .count();

        # Apply watermark to handle late data using dynamic session window

            Column sessionWindowExpr = when(col("storeId").equalTo("store1"), lit("5 seconds"))
                .when(col("storeId").equalTo("store2"), lit("20 seconds"))
                .otherwise(lit("15 seconds"));

            // Create a session window column
            Column sessionWindowCol = window(col("timestamp"), sessionWindowExpr);

            // Apply watermark to handle late data
            Dataset<Row> windowedCounts = df
                .withWatermark("timestamp", "15 seconds")
                .groupBy(sessionWindowCol, col("value"))
                .count();

        ```
    
    === "R"

        ```r

        sparkR.session(...)
     
        # Apply watermark to handle late data using tumbling or sliding window
     
        windowedCounts <- df %>%
            withWatermark("timestamp", "15 seconds") %>%
            groupBy(
            window(col("timestamp"), "10 seconds"),
            col("value")
            ) %>%
            count()

        # Session windows not supported in R

        ```

