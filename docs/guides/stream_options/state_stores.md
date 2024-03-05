<!-- 

spark structured streaming hdfs
spark structured streaming initalize state
spark structured streaming rocksdb
spark structured streaming state
spark structured streaming state store
[DUP] spark structured streaming garbage collection

-->

# Stateful Operations and State Stores

In the world of streaming, stateful operations need to buffer records and intermediate state to compute their results: records for the same aggregate window, for example, might arrive across several micro-batches. State stores are configurable key-value stores that stateful operators use to store these buffered records and intermediate state.

## Overview of stateful operators

Stateful operators read each record in a stream and remember information (keep the state) for all records for a period of time. For example, an aggregation operator that calculates a running total of sales per hour from the data stream requires that the stateful operator keep track of (remember) information from the records in the stream to calculate the hourly total. Another aggregation operator could also be calculating a running total of sales per day. Similarly, a deduplication operator must remember previous records to determine if there is duplication. For information on state storage options, see [state stores](../stream_options/state_stores.md).

### Common stateful operators

The most common stateful operators are [aggregations](../stateful/aggregation.md), [deduplication](../stateful/deduplication.md), and [stream-stream joins]().

### Arbitrary stateful operations

However, many use cases require more advanced stateful operations than aggregations. For example, in many usecases, you have to track sessions from data streams of events. For doing such sessionization, you will have to save arbitrary types of data as state, and perform arbitrary operations on the state using the data stream events in every trigger. Since Spark 2.2, this can be done using the operation `mapGroupsWithState` and the more powerful operation `flatMapGroupsWithState`. Both operations allow you to apply user-defined code on grouped Datasets to update user-defined state. For more concrete details, take a look at the API documentation ([Scala](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/streaming/GroupState.html)/[Java](https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/streaming/GroupState.html)) and the examples ([Scala](https://github.com/apache/spark/blob/v3.5.1/examples/src/main/scala/org/apache/spark/examples/sql/streaming/StructuredComplexSessionization.scala)/[Java](https://github.com/apache/spark/blob/v3.5.1/examples/src/main/java/org/apache/spark/examples/sql/streaming/JavaStructuredComplexSessionization.java)).

## Overview of state stores

While state stores have a simple get/put/delete/range-scan API, their internals are slightly more complex. They have to handle some of the following complexities:

1. For large queries, state store sizes can be really large. If you're processing millions of keys per minute, all the state might not fit in memory. The state store then needs to balance state between memory and disk, which is non-trivial.
2. For failure recovery, state stores need to save their state to durable storage (your [checkpoint location]()). With large amounts of state, their way of saving state can impact performance.

Different state providers take various approaches to these two problems, and choosing the right state store depends on your workload. We discuss how to choose a state store at the end of this guide. But first, we'll look at the two supported state stores, HDFS and RocksDB, in more detail.

## The HDFS state store

The HDFS state store is the default implementation of the state store. It stores _all_ state in memory, which has the advantage that it will never have to a disk operation to service a get or a put. However, if you have too much state, you could encounter some of the following issues:

1. Long GC pauses. Since all state is stored in memory in the JVM, you might experience long GC pauses due to the JVM trying to manage those objects.
2. Out of Memory errors. If the amount of state you have is less than the available JVM memory, you'll experience an out of memory exception.

At the end of each batch, the HDFS state store will save its state to your [checkpoint location](), which must be an HDFS-compatible filesystem.

## The RocksDB state store

As mentioned, the HDFS state store might have performance and memory issues with large amounts of state. To mitigate this, Spark 3.2 added support for the RocksDB state store. The RocksDB state store has two main benefits:

1. The state store doesn't create any JVM memory pressure.
2. The state store can handle much more state, since RocksDB manages state between native memory and the local disk.

RocksDB supports two ways of saving its state to your [checkpoint location](): the default mechanism saves its underlying data files[^1] to your checkpoint location, while "changelog checkpointing" uploads only the state that has been changed. The latter has much higher performance, but needs to be enabled explicitly.

In the examples below, we show you how to enable changelog checkpointing.

[^1]:
    RocksDB is an [LSM tree](https://en.wikipedia.org/wiki/Log-structured_merge-tree), so what we're referring to as "underlying data files" are its [SST files](https://github.com/facebook/rocksdb/wiki/A-Tutorial-of-RocksDB-SST-formats).

## Picking the right state store

First, if your query doesn't have any stateful operators, you can stop reading: state stores won't help you!

If you do have stateful queries, you should ask yourself: how many bytes of state do I have _per partition_? You can answer this question by doing some [napkin math](https://en.wiktionary.org/wiki/napkin_math).

Approximately speaking, the amount of state you'll have depends on your watermark duration, input rate, and size per record. For a 10 minute watermark and 10,000 records per second, you'll have 100,000 records in 10 minutes. If each record takes 64 bytes of space, then you'll have 6,400,000 bytes in your state store. You can divide that by the number of partitions you have to determine the amount of memory needed per partition.

Once you have that number, if the amount of memory per partition is less than a gigabyte, you can probably use HDFS. Otherwise, you should use RocksDB.

!!! warning
    Once you choose a state store provider, there's no easy way for you to change your state store provider. The only way to do that is to create an entirely new query with a brand new checkpoint location and reprocess all your source data.
    
    As a result, use RocksDB if there's any chance that your per-partition state store sizes—which you can approximate with the napkin math above—could rise above the threshold in the future.


## Examples

<!-- TODO(neil): Can you figure out why this is? -->
State store configurations happen at the SQL configuration level, not as an option on your stream. In all these examples below, we assume that you have a `spark` variable which refers to your current `SparkSession`; you can see how to construct one [here]().

=== "Python"

    ```python
    # Explicitly use HDFS (default)
    spark.conf.set(
        "spark.sql.streaming.stateStore.providerClass",
        "com.databricks.sql.streaming.state.HDFSStateStoreProvider")

    # Enable RocksDB
    spark.conf.set(
        "spark.sql.streaming.stateStore.providerClass",
        "com.databricks.sql.streaming.state.RocksDBStateStoreProvider")

    # If you're using RocksDB, you can enable changelog checkpointing.
    spark.conf.set(
        "spark.sql.streaming.stateStore.rocksdb.changelogCheckpointing.enabled", 
        "true")
    ```

=== "Scala"

    ```scala
    // Explicitly use HDFS (default)
    spark.conf.set(
        "spark.sql.streaming.stateStore.providerClass",
        "com.databricks.sql.streaming.state.HDFSStateStoreProvider")

    // Enable RocksDB
    spark.conf.set(
        "spark.sql.streaming.stateStore.providerClass",
        "com.databricks.sql.streaming.state.RocksDBStateStoreProvider")

    // If you're using RocksDB, you can enable changelog checkpointing.
    spark.conf.set(
        "spark.sql.streaming.stateStore.rocksdb.changelogCheckpointing.enabled", 
        "true")
    ```

=== "Java"

    ```java
    // Explicitly use HDFS (default)
    spark.conf.set(
        "spark.sql.streaming.stateStore.providerClass",
        "com.databricks.sql.streaming.state.HDFSStateStoreProvider")

    // Enable RocksDB
    spark.conf.set(
        "spark.sql.streaming.stateStore.providerClass",
        "com.databricks.sql.streaming.state.RocksDBStateStoreProvider")
    
    // If you're using RocksDB, you can enable changelog checkpointing.
    spark.conf.set(
        "spark.sql.streaming.stateStore.rocksdb.changelogCheckpointing.enabled", 
        "true")
    ```




