TODO(neil): This page should give an overview of sources in Spark. We don't need to go into the details of each one, but readers should know what a source is, approximately what the syntax looks like, and should be able to use the memory source by the end of it.

To do processing over streams of data, Spark needs to know where to read the stream from. In Structured Streaming, any place from which Spark reads data is called a _source_, and Structured Streaming uses sources to create a _streaming DataFrame_. A streaming DataFrame is effectively a static DataFrame, in that the Spark APIs still apply—the only difference is that a streaming DataFrame has extra magic (that you never have to worry about!) that incrementally reads its data source.

## An Overview of Built-In Sources

Structured Streaming understands several source formats out-of-the-box. We defer an extensive discussion of each format and their configuration options to the reference (TODO). However, here is a brief overview of production sources:

- **File source** - Reads files from a directory as a stream of data. Files will be processed in the order of file modification time. Supported file formats are text, CSV, JSON, ORC, Parquet. This mode enables you to keep your structured data in cloud storage, which will be cheaper for you than storing your data in, say, a relational database. See the TODO for more details.
- **Kafka source** - Reads data from Kafka. It's compatible with Kafka broker versions 0.10.0 or higher. See the [Kafka Integration Guide](structured-streaming-kafka-integration.html) for more details.

Structured Streaming also supports several non-production sources:

- **Memory source (for testing)** - Allows you to supply individual records to your stream. This source is particularly useful if you want to write small examples to test the behavior of your streaming logic; for that reason, we'll use it throughout this guide. We explore it in detail below, but you can also read about it in the reference (TODO(reference)).
- **Rate source (for performance evaluation)** - Generates data at the specified number of rows _per second_. Each output row contains a `timestamp` and `value`. This source is useful when load-testing your jobs, since it allows you to easily generate 1000s of rows per second. See TODO for more details.

There are two more non-production sources, namely the Per Micro-Batch Rate Source (TODO(reference)) and the Socket source (TODO(reference)). Since these aren't essential for your understanding now, we defer discussion of them to the reference.

## API Introduction

Once you have your `SparkSession` variable (usually called `spark`, as noted in Quick Example), you can use the `readStream` method to configure your source. `SparkSession.readStream` exposes several useful functions for configuring (and eventually returning) a streaming DataFrame. The most relevant functions are as follow:

- `.format`, which lets you configure what _type_ of source you want to read from (e.g. Cloud storage, Kafka, etc.)
- `.schema`, which lets you specify the schema of the incoming source data.
- `.option`, which lets you pass options to the source of your choosing (e.g. authentication options, resource name)
- `.load`, which takes no arguments, and just returns a _streaming_ DataFrame

We'll use these 4 methods down below. But once you call `.load()` and you have a streaming DataFrame, you can start transforming it with the Spark APIs—we'll get to that in the next section, Spark Operators (TODO(link)).

??? abstract "API Reference"
The `readStream` API returns a `DataStreamReader` ([Python](api/python/reference/pyspark.ss/api/pyspark.sql.streaming.DataStreamReader.html#pyspark.sql.streaming.DataStreamReader)/[Scala](api/scala/org/apache/spark/sql/streaming/DataStreamReader.html)/[Java](api/java/org/apache/spark/sql/streaming/DataStreamReader.html) docs).

## Example: Using the Memory Source

Let's now look at what code we need to write to create a streaming DataFrame. We'll use the Memory Source so that we can add records one by one.

### Configuring a Schema

TODO(carl): We need to show users how to create a schema. A schema is a `StructType()` that you can `.add` fields and types to. For example:

```py
from pyspark.sql.types import IntegerType, StructType
schema = new StructType().add("value", IntegerType).add(...)
```

You can chain as many `.add` calls as you'd like. There are also many more types, but we can refer to the reference for that. Finally, we should mention that _usually_ you don't have to define your schema, since your source will contain metadata about what the schema is. But for the memory source, you have to supply the schema.

### Creating your DataFrame

As we describe in the Memory Source reference (TODO(reference)), the Memory Source is named `memory`. Additionally, it has one required option called `name`, which allows you give a unique name to your source (if you have multiple memory sources at the same time, they need to have different names so that you can uniquely identify each one). After specifying the format and options, don't forget to call `.load()` to create your streaming DataFrame. In code, that looks like:

```py hl_lines="5-10"
from pyspark.sql.types import IntegerType, StructType

schema = new StructType().add("value", IntegerType)

df = (spark
        .readStream
        .format("memory")
        .schema(schema)
        .option("name", "my-memory-source")
        .load())
```

Now, you might ask: how do I add data to the `my-memory-source` source? The memory source is unique in that you add data to it via a singleton located at `org.apache.spark.streaming.sources.MemorySource`. The `MemorySource` singleton (TODO(reference)) has one method, `addData`, which takes two arguments: the name of the memory source to add data to, and a variadic list of tuples with the data you'd like to add. Let's do that:

```py hl_lines="2 13"
from pyspark.sql.types import IntegerType, StructType
from org.apache.spark.streaming.sources import MemorySource

schema = new StructType().add("value", IntegerType)

df = (spark
        .readStream
        .format("memory")
        .schema(schema)
        .option("name", "my-memory-source")
        .load())

MemorySource.addData("my-memory-source", 1, 2, 3)
```

With this code, we add three values to the memory source named `my-memory-source`. We show you where we'd process data (which you'll learn soon), and then we add more data. The streaming engine keeps track of its position within the input source, so it doesn't reprocess 1, 2, and 3 when we "run another micro-batch." We'll now go look at how to actually process the data that we add!

P.S. Note that in production, you'd be using a source like Kafka, so you wouldn't be explicitly adding data to your source, running a micro-batch, adding data, etc. You'd just start your stream, and it would read data as it arrived at your Kafka cluster. So don't be concerned if this code looks very tedious and verbose—it's just meant to illustrate the _incremental_ nature of the streaming engine.
