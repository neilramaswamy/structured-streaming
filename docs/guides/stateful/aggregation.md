# Aggregations in Structured Streaming

Aggregations over event-time windows (streaming aggregations) with Structured Streaming are similar to using `GROUP BY` in batch operations in SQL - they compute some aggregate value for each value in the grouping columns you specify. 

In Structured Streaming, the grouping column is generally time, and event-time is the time embedded in the data itself. While you can group on any column, grouping on time is essential for handling data that arrives out of order or with varying timestamps (records earlier in time can arrive after records later in time). By grouping data based on event-time, you can perform aggregations (such as counting, summing, averaging) over specific time windows (such as 5-minute intervals) or other custom intervals.

- Grouping by time allows you to create time windows for aggregations.
- A time window defines a fixed-size interval of time (e.g., 10 minutes) and aggregates data within that window.
For instance, you can group events into 10-minute windows and compute the count of events within each window.

## Conceptual example of streaming aggregations

Suppose that you have a stream of sales and want to compute the total revenue generated every hour in real-time. To do this, Structured Streaming needs to keep _state_ for each event-time window for sales during each hour. For example, let's say we make the following sales at a store at the following times:

- `$15` at 2:30pm
- `$10` at 2:40pm
- `$30` at 3:10pm

Let's assume that Structured Streaming has received this data at 3:15 PM. In this case, the streaming aggregation operator's internal state is as follows:

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

 In Structured Streaming, the choice of when to emit streaming aggregation values depends on the desired behavior and use case. The [output mode](../stream_options/output_mode.md) determines when the streaming aggreation operator emits aggregate values.

- **Append mode**: By default, all streaming queries run in append mode. In this mode, streaming operators only emit rows that won't change due to later arriving records in a future micro-batch. Intermediate, buffered results are not emitted until the time period for receiving late arriving records has passed. See [watermarks](../stateful/watermarks.md).
- **Update mode**: In update mode, streaming operators emit all rows that changed during the trigger, even if the emitted record might change as the result of a data in subsequent micro-batch.
- **Complete mode**: In complete mode, _all_ resulting rows ever produced by the streaming operator are emitted downstream.

### When to stop updating streaming aggregation values

The [watermark]() for a streaming aggregation operator determines how long the streaming operator should wait for new records to appear for a given event-time window, and when the engine can clean up old aggregates to limit the size of intermediate state data. Records arriving too late are dropped, rather than updating the aggregated value. <!--say something here about how to decide how long to wait? Question for Neil / Carl -->

!!! important
    Always specify a watermark to prevent unlimited growth of intermediate aggregate values consuming memory and potentially causing a machine crash due to out-of-memory errors.

## Time windows

Spark supports three types of event-time windows for aggregations. See [Examples of aggregations with event-time window](#examples-of-aggregations-with-event-time-windows).

### Tumbling (fixed) windows

Tumbling windows are a series of fixed-sized, non-overlapping and contiguous time intervals, such as every 60 minutes. An input can only be bound to a single window. Tumbling uses the `window` function.

![tumbling windows](/assets/tumbling_windows.png)

### Sliding windows

Sliding windows are also fixed-sized, but windows can overlap if the duration of the slide is smaller than the duration of window. For example, the window could be a duration of 10 minutes with a slide of 5 minutes. In this case an input can be bound to the multiple windows. Sliding uses the `window` function.

![sliding windows](/assets/sliding_windows.png)

### Session windows

Session windows have a different characteristic compared to the previous two types. A session window has a dynamic size of the window length, depending on the inputs. A session window starts with an input and expands itself if the following input has been received within the gap duration. A session window closes when there's no input received within the gap duration after receiving the latest input. This enables you to group events until there are no new events for a specified time duration (inactivity).

A session window works similar to a session on a website that has session timeout. If you log into a website and don’t show any activity for some duration, the website will prompt you to retain login status and force logging out if you are still inactive after the timeout has been exceeded. The session timeout is extended whenever you show activity.

A new session window is initiated when a new event, such as a streaming job, occurs, and following events within the timeout are included in the same session window. Each event extends the session timeout, which introduces a different characteristic compared to the other time windows. The time duration of the session window is not static, whereas both tumbling and sliding windows have a static time duration.

A session window uses `session_window` function.

![session windows with static gap duration](/assets/session_windows.png)

A session window can have either a static gap duration or a dynamic gap duration per session. You use an expression to specify gap duration dynamically based on the input row.

![session windows with dynamic gap duration](/assets/session_windows_dynamic_gap.png)

The boxes below the line of time denote each event with its gap duration. There are four events and their (event time, gap duration) pairs are (12:04, 4 mins) in blue, (12:06, 9 mins) in orange, (12:09, 5 mins) in yellow, and (12:15, 5 mins) in green.

The box above the line denotes the actual session which is made from these events. You can consider each event as an individual session, and sessions having an intersection are merged into one. As you may indicate, the time range of the session is “union” of the time range of all events included in the session. Note that the end time of the session is no longer the time + gap duration of the latest event in the session.

The function `session_window` receives two parameters, event time column and gap duration.

For dynamic session windows, you can provide an expression to the gap duration parameter in the session_window function. The expression should resolve to an interval, suc as 5 minutes. Since the gap duration parameter receives an expression, you can also leverage UDF as well.

Session windows have the following restrictions:

- Update mode as output mode is not supported.
- There must be at least one column in addition to session_window in the grouping key.

<!-- TODO partial aggregations-->

## Examples of aggregations with event-time windows

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

## Conditions for watermarking to clean aggregation state

The following conditions must be satisfied for the watermarking to clean the state in aggregation queries (as of Spark 2.1.1).

- Output mode must be _Append_ or _Update_. In complete mode, _all_ resulting rows ever produced by the operator are emitted downstream, and therefore there is no intermediate state to drop.
- The aggregation must have either the event-time column, or a window on the event-time column.
-  `withWatermark` must be called on the same column as the timestamp column used in the aggregate. For example, `df.withWatermark("time", "1 min").groupBy("time2").count()` is invalid in _Append_ output mode, as watermark is defined on a different column from the aggregation column.
- `withWatermark` must be called before the aggregation for the watermark details to be used. For example, `df.groupBy("time").count().withWatermark("time", "1 min")` is invalid in _Append_ output mode.

## Semantic guarantees of aggregation with watermarking

A watermark delay of _2 hours_ guarantees that the engine never drops any data that is less than 2 hours delayed. In other words, any data less than 2 hours behind the latest data processed till then (in terms of event-time) is guaranteed to be aggregated.

However, the guarantee is strict only in one direction. Data delayed by more than 2 hours is not guaranteed to be dropped; it may or may not get aggregated. More delayed is the data, less likely is the engine going to process it. <!--this needs more elaboration Neil / Carl -->
