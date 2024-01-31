# What are stateless operators?
<!-- Is this the best way to introduce stateful vs. stateless? The main point is that we don't need to "remember" other records in stateless. -->

Stateless operators read each record in a stream and limit the columns or the rows (or both) from that record that are emitted downstream. This limit, based on specified conditions, is independent of any other records in the stream.

On the other hand, stateful operators read each record in a stream and remember information (keep the state) for all records for some period of time. For example, keeping a running total of sales per hour requires the stateful operator to keep track of (remember) information from previous records. Similarly, deduplication requires remembering previous records to determine if there is duplication.

The most common stateless operators are projection and selection.

!!!note:
   The operator for projection is `select` whereas the operator for selection in SQL is `where`. This can be a bit confusing.

## What is projection?

A projection operation keeps the columns from the incoming stream that satisfy a specified condition and emits them downstream. For example, the upstream data stream may have _many_ columns that your particular streaming job does not want to send downstream. Suppose your task is to create a privacy-compliant downstream table from a stream of all the new users signing up for your platform. Let's assume that the data stream has the following columns:

- First and last name
- Birthday
- Home address
- Government ID

A privacy-compliant downstream table only needs the name and birthday columns from this data stream. To limit the columns emitted downstream, use the `select` operator.

<!--TODO(neil), code example. This doesn't need to work E2E, we can just assume the existence of some DataFrame `df` with a known schema. Similar to what we already have. -->

Another use of projection is to reduce the use of memory and CPU resources downstream by eliminating the flow of unnecessary data (columns and rows) through the Spark engine.

## What is selection?

A selection operator only emits a record downstream if its columns satisfy a specified condition. In SQL, the `where` operator is used for this, while in programming languages, this function is usually refered to as the higher-order-function (usually abbreviated as _HOF_) named `filter`. You can use either on a DataFrame - the formula is generally the same:

- You provide a string that contains your filtering predicate
- Your filtering predicate can refer to column names as strings
- You can use unary operators like `<`, `>`, `=`, `!=`

<!--TODO(neil), code example-->.

## Projection and Selection

Now, let's see these concepts together in a stateless stream:

<!--TODO(neil)-->
