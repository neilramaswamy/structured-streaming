# Welcome to the Structured Streaming Documentation

## What is Structured Streaming?

Structured Streaming is a scalable and fault-tolerant stream processing engine built on the Spark SQL engine. You can express your streaming computation the same way you would express a batch computation on static data. The Spark SQL engine will take care of running it incrementally and continuously and updating the final result as streaming data continues to arrive. You can use the [Dataset/DataFrame API](https://spark.apache.org/docs/latest/sql-programming-guide.html) in Scala, Java, Python or R to express streaming aggregations.

## Why streaming?

Spark revolutionized the way that organizations interacted with their data: with Spark, businesses were able to extract insights from the vast amount of data that they had, faster than ever before. However, the world very quickly turned real-time, with businesses expecting insights based on _current_ data, and users expecting features to reflect the now. Structured Streaming unlocks these real-time use cases, all within the same familiar, powerful, and mature Spark ecosystem.

## Why Structured Streaming?

Structured Streaming executes repeatedly executes small "micro-batches" over the source stream by using the Spark SQL engine, which has benefitted from over a decade of continuous optimization. Structured Streaming can scale to processing petabytes of data per day, all while ensuring end-to-end exactly-once fault-tolerance guarantees. In addition to high throughput (great for ETL!), it provides latencies low enough for operational workloads; it supports a low-latency processing mode called Continuous Mode that can achieve end-to-end latencies as low as 100ms.

## Where you should start

We assume a basic familiarity with Apache Spark.

First, start with the [Overview guide](./guides/overview.md), which provides an example-oriented introduction to all the concepts in Structured Streaming. From there, you can explore the particular guides that you're interested in; if a particular guide ever has prerequisites, we'll mention them up front.
