# What are additional stateless operators?

While [projection and selection](projection_selection.md) are the most common stateless operators,  you can use most Spark functions in Structured Streaming. For example, see the following additional functions that you can use in a stateless pipeline. 

## Using the `withColumn` function

The `withColumn` function is used to add a new column, change the value of a column, convert the datatype of a column, or derive a new column from an existing column. You could, for example, `CAST` the data type, or do a substring.

<!--TODO(neil) - example -->

## Using the `union` function

The `union` function combines two or more data frames of the same schema to append one data frame to another or combine ttwo data frames. Since this function returns all rows from the data frames regardless of duplicate data, use the `distinct` function to return just one record when duplicates exist.

## Using the `flatMap` function

The `flatMap` function is a transformation operation that applies a given function to each element of a data frame  and "flattens" the result into a new data frame. You can use this transformation to extract all unique URLs from a data frame of web log entries. 

## Using binary functions

You can use binary functions to serialize and deserialization data stored in binary formats, such as Protobuf or Avro.
See [Protobuf support](https://spark.apache.org/docs/latest/sql-data-sources-protobuf.html), and [Avro support](https://spark.apache.org/docs/latest/sql-data-sources-avro.html).
