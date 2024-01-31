<!-- 

spark structured streaming hdfs
spark structured streaming initalize state
spark structured streaming rocksdb
spark structured streaming state
spark structured streaming state store
[DUP] spark structured streaming garbage collection

-->

# State stores

In Structured Streaming, [stateful operations]() need to buffer records and their intermediate state to compute their results. For example, records for the same aggregate window might arrive across several micro-batches. State stores are configurable key-value stores that stateful operators use to store these buffered records and their intermediate state.

While state stores have a simple get/put/delete/range-scan API, their internals are more complex. 

## What are the complexities with state stores?

They have to handle the following complexities:

- **Large state size**: For large queries, state store sizes can be really large. If you're processing millions of keys per minute, all of the state data might not fit in memory. The state store then needs to balance state between memory and disk, which is non-trivial.
- **Checkout location**: For failure recovery, state stores need to save their state to durable storage. See [checkpointing](../checkpointing.md). With large amounts of state, the way in which state is saved can impact performance.

Different state providers take various approaches to these two problems, and choosing the right state store depends on your workload. See [Picking the right state store](#picking-the-right-state-store).

## What is an HDFS state store?

An HDFS state store is the default implementation of the state store. It stores _all_ state in memory, avoiding the need for a disk operation to service a get or a put. However, if you have too much state, you could encounter some of the following issues:

- **Long GC pauses**: Since all state is stored in memory in the Jave Virtual Machine (JVM), you might experience long garbage collection (GC) pauses due to the JVM trying to manage those objects.
- **Out of Memory errors**: If the amount of state you have is less than the available JVM memory, you'll experience an out of memory exception.

At the end of each batch, the HDFS state store saves its state to your [checkpoint location](../checkpointing.md) in an HDFS-compatible filesystem.

## What is the RocksDB state store?

To mitigate the performance and memory issues with large amounts of state, Spark 3.2 added support for the RocksDB state store. The RocksDB state store has two main benefits:

- The state store doesn't create any JVM memory pressure.
- The state store can handle much more state, since RocksDB manages state between native memory and the local disk.

RocksDB supports two ways of saving its state to your [checkpoint location](../checkpointing.md).

- **Checkpoint location**: The default mechanism saves its underlying data files[^1] to your checkpoint location.
**Changelog checkpointing**: This mechanism uploads only the state that has been changed. This method has much higher performance, but must be enabled explicitly. See [enable changelog example](#examples).


[^1]:
    RocksDB is an [LSM tree](https://wikipedia.org/wiki/Log-structured_merge-tree), so what we're referring to as "underlying data files" are its [SST files](https://github.com/facebook/rocksdb/wiki/A-Tutorial-of-RocksDB-SST-formats).

## How to pick the right state store?

First, if your query doesn't have any stateful operators, you can stop reading. Stateless operators do not save state.

If you do have stateful queries, ask yourself: how many bytes of state do I have _per partition_? Answer this question by doing some [napkin math](https://wiktionary.org/wiki/napkin_math). Approximately speaking, the amount of state depends on the watermark duration, the input rate, and the size per record. A 10 minute watermark duration with an input rate of 10,000 records per second, results in 100,000 records in 10 minutes. If each record takes 64 bytes of space, this yeilds 6,400,000 bytes in your state store. Divide this by the number of partitions to determine the amount of memory needed per partition.

If the amount of memory per partition is less than a gigabyte, use HDFS. Otherwise, use RocksDB.

!!! warning
    Once you choose a state store provider, there's no easy way to change your state store provider. The only way to do so is to create an entirely new query with a new checkpoint location and reprocess all your source data.
    
    As a result, use RocksDB if there's any chance that your per-partition state store sizes could rise above the threshold in the future.


## Examples

<!-- TODO(neil): Can you figure out why this is? -->
State store configurations happen at the SQL configuration level, not as an option on your stream. The examples below assume that you have a `spark` variable which refers to your current `SparkSession`. To see how to construct one, see [Spark variables]().

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
