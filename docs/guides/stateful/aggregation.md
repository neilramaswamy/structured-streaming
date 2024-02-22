# Aggregations in Structured Streaming

Aggregations over a sliding event-time window ("streaming aggregations") with Structured Streaming are very similar to using `GROUP BY` in batch operations in SQL. In a grouped aggregation, aggregate values (such as counts or averages) are maintained for each unique value in the user-specified grouping column. In Structured Streaming, the grouping column is time, and event-time is the time embedded in the data itself.

This allows window-based aggregations (e.g. number of events every minute) to be just a special type of grouping on the event-time column – each time window is a group and each row can belong to multiple windows (groups). Unlike aggregations in a batch, aggregations in Structured Streaming have the added complications that records can delayed and thus come out-of-order (records earlier in time can arrive after records later in time). In Structured Streaming, aggregate values are maintained for each window into which the event-time of a row falls.

The central questions for streaming aggregations is how long to wait for late arriving records to arrive and when to emit aggregation values downstream. Records can be emitted intermitently or only when no more updates will be received.

## Conceptual example of streaming aggregations

Suppose that you have a stream of sales and want to compute the total revenue generated _every hour_ in real-time. To do this, Structured Streaming needs to keep _state_ for each event-time window for sales during each hour. For example, let's say we make the following sales at a store at the following times:

- `$15` at 2:40pm
- `$10` at 2:30pm
- `$30` at 3:10pm

Let's assume that Structured Streaming has received this data as of 3:15 PM. In this case, Structured Streaming's state for hour windows would look like the following:

- [2pm, 3pm): $25
- [3pm, 4pm): $30

Then, let's say the aggregation operator receives two more records at 3:30 PM:

- `$20` at 2:15pm
- `$25` at 3:15pm

Structured Streaming would use the event time rather than the time received to update its state to look like the following:

- [2pm, 3pm): $45
- [3pm, 4pm): $55

So, the central questions for the streaming aggregation operator are:

- When should it emit records downsteam for these aggregated values? Options are after each update or after it knows that no additional records will be received for a time window.
- When should the streaming aggregation operator stop updating the streaming aggregation value. Options are to keep updating indefinitely until the stream is stopped or to wait for a specific amount of time, such as 15 minutes after the event-time window has passed.

## When to emit streaming aggregation values

The [output mode](../stream_options/output_mode.md) determines when the streaming aggreation operator emits aggregate values.

- **Append mode**: - By default, streaming queries run in append mode. In this mode, operators only emits rows that won't change in future triggers.
- **Update mode**: In update mode, operators emit all rows that changed during the trigger, even if the emitted record might change in a subsequent trigger.
- **Complete mode**: In complete mode, _all_ resulting rows ever produced by the operator are emitted downstream.

## When to stop updating streaming aggregation values

The [watermark]() for a streaming aggregation operator determines how long the operator should wait for new records to appear for a given event-time window, and when the engine can clean up old aggregates to limit the size of intermediate state data. Records arriving too late are dropped, rather than updating the aggregated value.

!!! important
    Always specify a watermark to prevent unlimited growth of intermediate aggregate value consuming memory and potentially causing a machine crash due to out-of-memory errors.

## Time windows

Spark supports three types of event-time windows for aggregations:

- **Tumbling (fixed)**: Tumbling windows are a series of fixed-sized, non-overlapping and contiguous time intervals, such as every 60 minutes. An input can only be bound to a single window. Tumbling uses the `window` function.

    ![tumbling windows](/assets/tumbling_windows.png)

- **Sliding**: Sliding windows are similar to the tumbling windows from the point of being _fixed-sized_, but windows can overlap if the duration of slide is smaller than the duration of window. For example, the window could be a duration of 15 minutes with a slide of 5 minutes. In this case an input can be bound to the multiple windows. Sliding uses the `window` function.<!--need example syntax? TO DO - Neil / Carl example "/aggregation-with-watermark" only shows tumbling window-->

    ![sliding windows](/assets/sliding_windows.png)

- **Session**: <!--this section needs more clarity TO DO Neil / Carl-->Session windows have a dynamic size of the window length, depending on the inputs. A session window starts with an input, and expands itself if following input has been received within gap duration. For static gap duration, a session window closes when there’s no input received within gap duration after receiving the latest input. Session window uses session_window function. <!--need example syntax? TO DO - Neil / Carl -->

    ![session windows](/assets/session_windows.png)

    Instead of static gap value, you can also provide an expression to specify gap duration dynamically based on the input row. Rows with negative or zero gap duration are filtered out from the aggregation.

    With dynamic gap duration, the closing of a session window does not depend on the latest input. Rather, a session window’s range is the union of all events’ ranges which are determined by event start time and evaluated gap duration during the query execution.

    When you use session window in streaming query:

    - Update mode as output mode is not supported.
    - There should be at least one column in addition to session_window in grouping key.

    By default, Spark does not perform partial aggregations for session window aggregation, since it requires additional sort in local partitions before grouping. It works better for the case there are only few number of input rows in same group key for each local partition, but for the case there are numerous input rows having same group key in local partition, doing partial aggregation can still increase the performance significantly despite additional sort. <!-- previous paragraph needs work TO DO Neil / Carl -->

    You can enable `spark.sql.streaming.sessionWindow.merge.sessions.in.local.partition` to indicate Spark to perform partial aggregations.

### Conditions for watermarking to clean aggregation state

The following conditions must be satisfied for the watermarking to clean the state in aggregation queries (as of Spark 2.1.1).

- Output mode must be _Append_ or _Update_. In complete mode, _all_ resulting rows ever produced by the operator are emitted downstream, and there is no intermediate state to drop. 
- The aggregation must have either the event-time column, or a window on the event-time column.
-  `withWatermark` must be called on the same column as the timestamp column used in the aggregate. For example, `df.withWatermark("time", "1 min").groupBy("time2").count()` is invalid in _Append_ output mode, as watermark is defined on a different column from the aggregation column.
- `withWatermark` must be called before the aggregation for the watermark details to be used. For example, `df.groupBy("time").count().withWatermark("time", "1 min")` is invalid in _Append_ output mode.

### Semantic guarantees of aggregation with watermarking

A watermark delay (set with `withWatermark`) of _2 hours_ guarantees that the engine will never drop any data that is less than 2 hours delayed. In other words, any data less than 2 hours behind (in terms of event-time) the latest data processed till then is guaranteed to be aggregated.

However, the guarantee is strict only in one direction. Data delayed by more than 2 hours is not guaranteed to be dropped; it may or may not get aggregated. More delayed is the data, less likely is the engine going to process it.

## Examples of aggregations with event-time windows

??? example

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

