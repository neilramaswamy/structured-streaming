To do processing over streams of data, Spark needs to know where to read the stream from. In Structured Streaming, any place from which Spark reads data is called a _source_, and Structured Streaming uses sources to create a _streaming DataFrame_. A streaming DataFrame is effectively a static DataFrame, in that the Spark APIs still apply—the only difference is that a streaming DataFrame has extra magic (that you never have to worry about!) that incrementally reads its data source.

## An Overview of Built-In Sources

Structured Streaming understands several source formats out-of-the-box. Here is a brief overview of production sources:

- **File source** - Reads files from a directory as a stream of data. Files will be processed in the order of file modification time. Supported file formats are text, CSV, JSON, ORC, Parquet. This mode enables you to keep your structured data in cloud storage, which will be cheaper for you than storing your data in, say, a relational database.
- **Kafka source** - Reads data from a Kafka-compatible broker, like a Confluent cluster or Azure EventHubs.

Structured Streaming also supports several non-production sources:

- **Socket source (for testing)** - Reads UTF8 text data from a socket connection. The listening server socket is at the driver. Never use this in production, since it isn't fault-tolerant[^1].
- **Rate source (for performance testing)** - Generates data at the specified number of rows _per second_. Each output row contains a `timestamp` and `value`. This source is useful when load-testing your jobs, since it allows you to easily generate 1000s of rows per second. See TODO for more details.
- **Rate source per micro-batch (for performance testing)** - Generates data at the specified number of rows _per micro-batch_.

[^1]:
    A source is fault-tolerant if it is able to replay data in the case of failure. The socket source doesn't persist the data it receives,
    so it can't replay data. However, the file source and Kafka source both support replay, so they are considered fault-tolerant.

Each source supports many different options; you can find these specific options later on. Additionally, please note that different Spark vendors may support more sources; please see your vendor's documentation if you'd like to use a source that wasn't explicitly listed above.

<!-- TODO(neil): Link an example here. -->
!!! tip
    You can also use the file source as a testing source, if you don't want to use the socket source. You can create static DataFrames via `spark.createDataFrame` and write them to a specific directory on your system. Then, you can read those from your Structured Streaming job by using the `"files"` source.

## Source Reference

Using the overview of the built-in sources, you can get a high-level idea of what source you might want to use. In the sections below, you can expand the boxes to find their specific name and supported options.

### File Source

The file source is named `files`. In addition to the generically supported options for any file type, there are file-format-specific options, as well as Spark-level options, for [Parquet](https://spark.apache.org/docs/latest/sql-data-sources-parquet.html), [ORC](https://spark.apache.org/docs/latest/sql-data-sources-orc.html), [JSON](https://spark.apache.org/docs/latest/sql-data-sources-json.html), [CSV](https://spark.apache.org/docs/latest/sql-data-sources-csv.html), and [text files](https://spark.apache.org/docs/latest/sql-data-sources-text.html).


??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `path`                  | path to the input directory, and common to all file formats. Glob paths are supported, but multiple comma-separated globs are not supported.                                                           | None            | Yes         |
    | `maxFilesPerTrigger`    | maximum number of new files to be considered in every trigger.                                     | No maximum      | No          |
    | `latestFirst`           | whether to process the latest new files first, useful when there is a large backlog of files.      | False           | No          |
    | `fileNameOnly`          | whether to check new files based on only the filename instead of on the full path (default: false). With this set to `true`, the following files would be considered as the same file: `file:///dataset.txt`, `s3://a/dataset.txt`, etc.                                                  | False           | No          |
    | `maxFileAge`            | All files older than this age will be ignored. For the first batch, all files will be considered valid. If `latestFirst` is set to `true` and `maxFilesPerTrigger` is set, then this parameter  will be ignored, because old files that are valid, and should be processed, may be ignored. The max age is specified with respect to the timestamp of latest file, and not the current system time.                                                                                              | 7 days          | No |
    | `cleanSource`           | Whether to clean up files after processing. Available options are "archive", "delete", "off". The "delete" option deletes files permanently. The "archive" option copies files to the `sourceArchiveDir`; if the source file is `/a/data.txt` and the archive directory is `/archive`, the file will move to `/archive/a/data.txt`.                                                       | None | No |
    | `sourceArchiveDir`      | Specifies the archive directory for cleaned-up files. It cannot be a sub-directory of `path`; if it were, archived files would be considered new and processed over and over again.                 | None | Only if `cleanSource` is set to "archive" |


??? example
    woah hello?

### Kafka Source

The Kafka source is named `kafka`. It's compatible with Kafka broker versions 0.10.0 or higher. See the [Kafka Integration Guide](https://spark.apache.org/docs/latest/structured-streaming-kafka-integration.html) for the supported options and examples.

<!-- TODO(carl): You can port over the options from the Programming Guide. Most of these should be straight-forward. -->

### Socket Source

The file source is named `files`. Its supported options are below.

??? info "Supported Options"
    Hello world!

??? example
    woah hello?

### Rate Source

The file source is named `files`. Its supported options are below.

??? info "Supported Options"
    Hello world!

??? example
    woah hello?

### Rate Source per Micro-Batch

The file source is named `files`. Its supported options are below.

??? info "Supported Options"
    Hello world!

??? example
    woah hello?


