<!-- Is this the best way to introduce stateful vs. stateless? The main point is that we don't need to "remember" other records in stateless. -->

Stateless stream processing is the first type of stream processing we'll explore. It's characterized by a very simple property: every record can be emitted downstream (or not, in the case of deduplication) _fully_ independently of any other record. For example:

- Projecting is stateless, since taking a subset of a record's columns and emitting them downstream can be done without looking at any other records
- Selection (i.e. filtering) is stateless, since whether you keep or filter a record depends only on that record's columns

We use the word "stateless" because this nice property means that Structured Streaming doesn't need to have any "memory" (i.e. state) about what other records it has seen. Stateful operators, on the other hand (like aggregation), is stateful since Structured Streaming needs to remember (i.e. keep state) for all the records that belong in an aggregate.

## Projecting

Projection is the operator that takes a subset of columns from an incoming stream. Often-times upstream data streams have _tons_ of columns that your particular streaming job might not want to send downstream. Suppose your task is to create a privacy-compliant downstream table from a stream of all the new users signing up for your platform. The user stream might have:

- First and last name
- Birthday
- Home address
- Government ID

You might want to only make sure the downstream table has the name and birthday columns. To do this, you should use the `select` operator, which works with streaming DataFrames just as it works with static DataFrames:

TODO(neil), code example. This doesn't need to work E2E, we can just assume the existence of some DataFrame `df` with a known schema. Similar to what we already have.

Another reason to project is that if your stream is only going to be using a few columns from an source with many columns, it's cheaper—in terms of of memory and CPU utilization—to have less unnecessary data (columns) flowing through the system.

## Selecting

Selection is all about keeping certain rows that satisfy a condition that you specify. In SQL, the operator used for this is commonly known as `where`, while in programming languages, this function is usually refered to as the higher-order-function (usually abbreviated as _HOF_) named `filter`. You can use either on a DataFrame. But regardless of whether you use the SQL operator or HOF, the formula is generally the same:

- You provide a string that contains your filtering predicate
- Your filtering predicate can refer to column names as strings
- You can use unary operators like `<`, `>`, `=`, `!=`

TODO(neil), code example.

## Projection and Selection

Now, we'll put the following four concepts together to write a fairly useful stateless stream:

TODO(neil)
