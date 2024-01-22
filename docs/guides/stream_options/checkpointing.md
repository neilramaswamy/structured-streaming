# Checkpointing

Structured Streaming uses a checkpoint storage location to provide fault-tolerance and data consistency for streaming queries. Checkpointing enables you to restart a failed queryfrom where the failed one left off.

## What are the checkpoint location options?

The Spark Structured Streaming checkpoint location is a cloud-storage backed directory that is used mainly for fault tolerance and failure recovery. The most popular cloud-storage systems for checkpoint locations are Amazon S3, Azure Blob Storage, and Google Cloud Storage.

To optimize checkpoint locations, see[checkpoint location optimization]().

## What is stored in the checkpoint location?

The checkpoint location directory stores the following:

- **Stream progress**: Each record in a stream typically has an offset number. In the storage location, Structured Streaming records the offsets it is going to process before starting a micro-batch, and marks those offsets are processed when it finishes the micro-batch. Thus, if the stream fails during a micro-batch, the stream recovers by reading from the checkpoint location and resuming at the last unprocessed offset. This aspect of the checkpoint location is known as "progress tracking" or "offset management."
- **Stream state**: [Stateful operators]() generate [state](), such as intermediate aggregation output. The stream state is stored in the checkpoint location so that if the query is restarted, Structured Streaming can download the most recent state without having to replay the stream from the beginning to rebuild that state.

Both progress tracking and state management are central to the functionality of the engine, so checkpoint locations cannot be fully disabled. However, there are some optimizations you can enable to make the effects of checkpoint location operations less expensive. We discuss these later.

## How do I choose a checkpoint location?

Your checkpoint location should be a fixed, per-query directory in cloud-storage. For your convenience, it should be somewhat self-describing, so that you know what query a given checkpoint location corresponds to. For example, if you are in the Data Science division of your company and you are generating a product usage dashboard, you could use `s3://data-science/streams/product-usage`. That will be the directory to which Structured Streaming performs progress tracking and stores intermediary state.

!!! warning
    Your checkpoint locations should always be deterministic: they should be fixed strings, not something like `"s3://data-science/{date.today()}/"`. If you use a non-deterministic string, Structured Streaming will read and write its progress and state to non-deterministic places, which will certainly lead to issues in your pipeline.

Finally, once you've set a checkpoint location for a query, you shouldn't manually write or delete files from that directory. If you were to do this, you might corrupt or irreparably delete files needed to resume or recover the stream. Once you've designated a directory as a checkpoint location, it's best to leave that directory entirely to Structured Streaming. However, if you're sure that you no longer need to run a particular query, _then_ you can delete its checkpoint location.

!!! danger
    If you delete your checkpoint location, you'll remove all the progress and state for the associated query. To recover from that, your query would need to reprocess all of your source data. That will be time-consuming and costly, and you could break the delivery semantics of your query.

## Example

=== "Python"

    ```python hl_lines="4"
    aggDF \
        .writeStream \
        .outputMode("append") \
        .option("checkpointLocation", "path/to/HDFS/dir") \
        .format("memory") \
        .start()
    ```
=== "Scala"

    ```scala hl_lines="4"
    aggDF
        .writeStream
        .outputMode("append")
        .option("checkpointLocation", "path/to/HDFS/dir")
        .format("memory")
        .start()
    ```
=== "Java"

    ```java hl_lines="4"
    aggDF
        .writeStream()
        .outputMode("append")
        .option("checkpointLocation", "path/to/HDFS/dir")
        .format("memory")
        .start(); 
    ```
=== "R"

    ```R
    write.stream(aggDF, "memory", outputMode = "complete", checkpointLocation = "path/to/HDFS/dir")
    ```

