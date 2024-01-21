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

As mentioned, the HDFS state store might have performance and memory issues with large amounts of state. To mitigate this, Spark 3.2 added support for the RocksDB state store. The RocksDB state store manages state between native memory and the local disk, which has two implications:

1. The state store doesn't create any JVM memory pressure.
2. The state store can handle much more state, since RocksDB manages state between native memory and the local disk.

RocksDB supports two ways of saving its state to your [checkpoint location](): the default mechanism saves the underlying SST files[^1] to your checkpoint location, while "changelog checkpointing" uploads only the state that has been changed. The latter has much higher performance, but needs to be enabled explicitly.

## Picking the Right State Store


## Examples






