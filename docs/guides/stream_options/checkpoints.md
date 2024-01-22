# Checkpoints

Structured Streaming stores checkpoint information to a storage location to provide fault-tolerance and data consistency for streaming queries. Checkpointing enables you to restart a failed query from where the failed one left off.

## What are the popular checkpoint locations?

The Spark Structured Streaming checkpoint location is a cloud-storage backed directory that is used mainly for fault tolerance and failure recovery. The most popular cloud-storage systems for checkpoint locations are Amazon S3, Azure Blob Storage, and Google Cloud Storage.

To optimize checkpoint locations, see [checkpoint optimizations]().

## What is stored in the checkpoint location?

The checkpoint location directory stores the following:

- **Stream progress**: Each record in a stream typically has an offset number. In the storage location, Structured Streaming records the offsets it is going to process before starting a micro-batch, and marks those offsets are processed when it finishes the micro-batch. Thus, if the stream fails during a micro-batch, the stream recovers by reading from the checkpoint location and resuming at the last unprocessed offset. This aspect of the checkpoint location is known as "progress tracking" or "offset management."
- **Stream state**: [Stateful operators]() generate [state](), such as intermediate aggregation output. The stream state is stored in the checkpoint location so that if the query is restarted, Structured Streaming can download the most recent state without having to replay the stream from the beginning to rebuild that state.

Both progress tracking and state management are central to the functionality of the Structured Streaming engine, so checkpointing cannot be fully disabled. However, there are some [checkpoint optimizations]() you can enable to make the effects of checkpoint location operations less expensive.

## How do I choose a checkpoint location?

Your checkpoint location should be a fixed, per-query directory in cloud-storage. For your convenience, it should be somewhat self-describing, so that you know the query to which a given checkpoint location corresponds. For example, if you are in the Data Science division of your company and you are generating a product usage dashboard, you could use `s3://data-science/streams/product-usage` as the directory location name.

!!! warning
    Your checkpoint locations should always be deterministic: they should be fixed strings, not something like `"s3://data-science/{date.today()}/"`. If you use a non-deterministic string, Structured Streaming reads and writes its progress and state to and from non-deterministic locations, resulting in issues in your pipeline.

Finally, once you've set a checkpoint location for a query, you shouldn't DO NOT manually write to or delete files from your checkpoint location directory. If you were to do this, you risk corrupting or irreparably deleting files needed to resume or recover the stream from failure. Once you've designated a directory as a checkpoint location, leave that directory entirely to Structured Streaming. However, if you're sure that you no longer need to run a particular query, _then_ you can delete its checkpoint location.

!!! danger
    If you delete your checkpoint location, you'll remove all the progress and state information for the associated streaming query. To recover from such a deletion, your streaming query must reprocess all of your source data. This is time-consuming and costly, and could break the delivery semantics of your query.

## Examples

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
