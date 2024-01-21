# State Stores

In the world of streaming, stateful operations need to buffer records and intermediate state to compute their results: records for the same aggregate window, for example, might arrive across several micro-batches. State stores are configurable key-value stores that stateful operators use to store these buffered records and intermediate state.

While state stores have a simple get/put/delete/range-scan API, their internals are slightly more complex. They have to handle some of the following complexities:

1. For large queries, state store sizes can be really large. If you're processing millions of keys per minute, all the state might not fit in memory. The state store then needs to balance state between memory and disk, which is non-trivial.
2. For failure recovery, state stores need to save their state to stable storage, like cloud storage. With large amounts of state, their way of saving state can impact performance.

Different state providers take various approaches to these two problems, and choosing the right state store depends on your workload. We discuss how to choose a state store at the end of this guide. But first, we'll look at the two supported state stores, HDFS and RocksDB, in more detail.

## The HDFS State Store

The HDFS state store is the default implementation of the state store. It stores _all_ state in memory, which has the advantage that it will never have to a disk operation to service a get or a put. However, if you have too much state, you could encounter some of the following issues:

1. Long GC pauses. Since all state is stored in memory in the JVM, you might experience long GC pauses due to the JVM trying to manage that state.
2. Out of Memory errors. If the amount of state you have is less than the available JVM memory, you'll experience an out of memory exception.

At the end of each batch, the HDFS state store will save its state to your [checkpoint location](), which must be an HDFS-compatible filesystem.

## The RocksDB State Store

As mentioned, the HDFS state store might have performance and memory issues with large amounts of state. To mitigate this, Spark 3.2 added support for the RocksDB state store. The RocksDB state store manages state between native memory and the local disk, which has two benefits:

1. The state store doesn't create any JVM memory pressure.
2. The state store can handle much more state, since RocksDB manages state between native memory and the local disk.

RocksDB supports two ways of saving its state to your [checkpoint location](): the default mechanism saves the underlying SST files[^1] to your checkpoint location, while "changelog checkpointing" uploads only the state that has been changed. The latter has much higher performance, but needs to be enabled explicitly.

## Picking the Right State Store

First, if your query doesn't have any stateful operators, you can stop reading: state stores won't help you!

If you do have stateful queries, you should ask yourself: how many bytes of state do I have _per partition_? There are two ways of figuring this out:

1. If you haven't started your query yet and you aren't sure, you can do some napkin math. Approximately speaking, the amount of state you'll have depends on your watermark duration, input rate, and size per record. For a 10 minute watermark and 10,000 records per second, you'll have 100,000 records in 10 minutes. If each record takes 64 bytes of space, then you'll have 6,400,000 bytes in your state store. You can divide that by the number of partitions you have to determine the amount of memory needed per partition.

<!-- TODO: Plug-in a link to the SparkUI guide here. -->
2. If your streaming query is already running, you can look at the Spark UI to determine the distribution of state sizes across your partitions. Ideally this would be fairly uniform, but if it's not, choose the largest one for the purposes of this guide.

Once you have that number, if the amount of memory per partition is less than a gigabyte, you can probably use HDFS. Otherwise, you should use RocksDB.

!!! warning
    Once you choose a state store provider, there's no easy way for you to change your state store provider. The only way to do that is to create an entirely new query with a brand new checkpoint location and reprocess all your source data.
    
    As a result, use RocksDB if there's any chance that your per-partition state store sizes—which you can approximate with the napkin math above—could rise above the threshold in the future.


## Examples






