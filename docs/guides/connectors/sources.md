# Sources

In Structured Streaming, a source is the location from which Spark reads a stream of data over which processing occurs. The stream of data in the source is read into a _streaming DataFrame_. A streaming DataFrame is essentially an unbounded table into which new records are incrementally appended. Spark APIs apply to a stream DataFrame in the same way that they apply to static DataFrames. 

## What are the built-in data sources?

Structured Streaming understands the following production source out-of-the-box:

- **File source** - Reads the files from a directory as a stream of data into a streaming DataFrame. Files are processed in the order of the file modification time. Supported file formats are: text, CSV, JSON, ORC, and Parquet. Streaming from a file source enables you to keep your structured data in cloud storage, which is cheaper than storing your data in some other type of location, such as a relational database.
- **Kafka source** - Reads data from a Kafka-compatible broker, such as a Confluent cluster or Azure EventHubs, into a streaming DataFrame.

!!! note
    Some Spark vendors support additional production sources. See your vendor's documentation.

Structured Streaming also supports several non-production sources for testing purposes:

- **Socket source**: Reads UTF8 text data from a socket connection into a streaming DataFrame. The listening server socket is at the driver. Never use this in production, since it isn't fault-tolerant[^1].
- **Rate source**: Generates data at the specified number of rows _per second_ into a streaming DataFrame to test performance. Each output row contains a `timestamp` and `value`, where timestamp is a `timestamp` type containing the time of message dispatch, and value is of `long` type containing the message count, starting from 0 as the first row. This source is useful when load-testing your jobs, since it allows you to easily generate thousands of rows per second.
- **Rate source per micro-batch**: Generates data at the specified number of rows _per micro-batch_ into a streaming DataFrame for performance testing. Each output row contains a `timestamp` and `value`, where timestamp is a `timestamp` type containing the time of message dispatch, and value is of `long` type containing the message count, starting from 0 as the first row.. Unlike rate data source, this data source provides a consistent set of input rows per micro-batch regardless of query execution (such as configuration of trigger or query being lagging). For example, batch 0 produces 0~999 and batch 1 produces 1000~1999, and so on. Every record produced will have a different value, even across partitions. Same applies to the generated time.

[^1]:
    A source is fault-tolerant if it is able to replay data in the case of failure. The socket source doesn't persist the data it receives, so it can't replay data. The file source and Kafka source both support replay, so they are considered fault-tolerant.

Each of these sources support many options. See [Source reference](#source-reference). 

<!-- TODO(neil): Link an example here. -->
!!! tip
    You can also use the file source as a testing source, rather than the socket source. To do this, you can create static DataFrames via `spark.createDataFrame` and write them to a specific directory on your system. Then, you can read those files using a Structured Streaming job with the `files` source.

## Source Reference

Now that you have a high-level overview of the built-in sources, expand the supported options boxes for each source type to find the specific option name and supported values.

### File Source

The file source is named `files`. In addition to the generically supported options for any file type, there are file-format-specific options, as well as Spark-level options, for [Parquet](https://spark.apache.org/docs/latest/sql-data-sources-parquet.html), [ORC](https://spark.apache.org/docs/latest/sql-data-sources-orc.html), [JSON](https://spark.apache.org/docs/latest/sql-data-sources-json.html), [CSV](https://spark.apache.org/docs/latest/sql-data-sources-csv.html), and [text files](https://spark.apache.org/docs/latest/sql-data-sources-text.html).

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `path`                  | The path to the input directory. Glob paths are supported, but multiple comma-separated globs are not supported.                                                           | None            | Yes         |
    | `maxFilesPerTrigger`    | The maximum number of new files to be considered in every trigger.                                     | No maximum      | No          |
    | `latestFirst`           | Whether to process the latest new files first. This is useful when there is a large backlog of files.      | False           | No          |
    | `fileNameOnly`          | Whether to check new files based on only the filename instead of on the full path (default: false). With this set to `true`, the following files would be considered as the same file: `file:///dataset.txt` and `s3://a/dataset.txt`.                                                  | False           | No          |
    | `maxFileAge`            | All files older than this age are ignored. For the first batch though, all files are considered valid. If `latestFirst` is set to `true` and `maxFilesPerTrigger` is set, then this parameter is ignored, because old files that are valid, and should be processed, may be ignored. <!-- this previous sentence does not make sense to me - Neil, please review-->The max age is specified with respect to the timestamp of latest file, and not the current system time.                                                                                              | 7 days          | No |
    | `cleanSource`           | Whether to clean up files after processing. Available options are "archive", "delete", and "off". The "delete" option deletes files permanently. The "archive" option copies files to the `sourceArchiveDir`; if the source file is `/a/data.txt` and the archive directory is `/archive`, the file is moved to `/archive/a/data.txt`.                                                       | None | No |
    | `sourceArchiveDir`      | Specifies the archive directory for cleaned-up files. It cannot be a sub-directory of `path`; if it were, archived files would be considered new and processed over and over again.                 | None | Only if `cleanSource` is set to "archive". |


??? example
    woah hello?     <!-- TODO(neil)-->

### Kafka Source

The Kafka source is named `kafka`. It's compatible with Kafka broker versions 0.10.0 or higher. See the [Kafka Integration Guide](https://spark.apache.org/docs/latest/structured-streaming-kafka-integration.html) for the supported options and examples.

### Socket Source

The socket source is named `socket`.

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `host` | The string of the host to connect to, such as localhost | None | Yes |
    | `port` | The integer of the host to connect to, such as 9999 | None | Yes |

??? example
    woah hello?     <!-- TODO(neil)-->

### Rate Source

The rate source is named `rate`.

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `rowsPerSecond` | How many rows should be generated per second. | 1 | No |
    | `rampUpTime` | How long to ramp up before the generating speed becomes rowsPerSecond. Using finer granularities than seconds will be truncated to integer seconds. This option not suppported in continuous mode. | 0 | No |
    | `numPartitions` | The partition number for the generated rows. The source will try its best to reach `rowsPerSecond`, but the query may be resource constrained, and numPartitions can be tweaked to help reach the desired speed.| Spark's default parallelism | No | 
    
??? example
    woah hello?     <!-- TODO(neil)-->

### Rate Source per Micro-Batch

The rate source per micro-batch is named `rate-micro-batch`.

??? info "Supported Options"
    | Option Name             | Information                                                                                        | Default         | Required?   |
    |-------------------------|----------------------------------------------------------------------------------------------------|-----------------|-------------|
    | `rowsPerBatch` |  How many rows should be generated per micro-batch. | 0 | No |
    | `numPartitions` | The partition number for the generated rows. | Spark's default parallelism | No |
    | `startTimestamp` | Starting value of generated time. | 0 | No |
    | `advanceMillisPerBatch` | The amount of time being advanced in generated time on each micro-batch. | 1000 | No |

??? example
    woah hello?     <!-- TODO(neil)-->
