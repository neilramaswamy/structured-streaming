# What are additional stateless operators?

While [projection and selection](projection_selection.md) are the most common stateless operators, you can use most Spark functions in Structured Streaming. The following additional Spark functions are examples of stateless operators that you can use in a stateless pipeline. 

## Using the `withColumn` function

You can use the `withColumn` function to add a new column, change the value of an existing column, convert the datatype of an existing column, or derive a new column from an existing column. You could, for example, `CAST` the data type or do a substring.

<!--TODO(neil) - example -->

## Using the `union` function

You can use the `union` function to combine two or more data frames of the same schema and append one data frame to another or combine two data frames. Since the `union` function returns all rows from the data frames regardless of duplicate data, use the `distinct` function to return just one record when duplicates exist when unioning data frames.

## Using the `flatMap` function

You can use the `flatMap` function to transforma data. The `flatMap` function applies a given function to each element of a data frame and generate zero, one, or many output elements for each input element.

See the following pseudocode example.

```
myString.flatMap(x =>
    if x.contains(","):
        x.split(",")) // many records
    else:
        null // no records
)
```

You can use the `flatMap` operator to extract all unique URLs from a data frame of web log entries into 0, 1, or many records, depending on the number of URLs. 

## Using binary functions

You can use binary functions to serialize and deserialize data stored in binary formats, such as Protobuf or Avro. Any function in the [Spark SQL Guide](https://spark.apache.org/docs/latest/sql-programming-guide.html) applies, including [protobuf andd avro](../binary_formats.md).
