# Stateless operators
<!-- Is this the best way to introduce stateful vs. stateless? The main point is that we don't need to "remember" other records in stateless. -->

With stateless stream processing, every record can be emitted downstream (or not, in the case of deduplication) _fully_ independently of any other record. For example, projecting columns and filtering records are examples of stateless stream processing. 

For example:

- Projecting is taking a subset of a record's columns and emitting them downstream can be done without looking at any other records - and is therefore stateless.
- Selection ( also known as filtering) is keeping or filtering a record based solely only on that record's columns - and is also therefore stateless.



With stateful stream processing and stateful operators (such as aggregations over time), Structured Streaming needs to remember (keep the state) for all records belonging to an aggregate to calculate the aggregate across multiple records.

## What is projection?

Projection takes a subset of columns from an incoming stream and emits the subset of those columns downstream. For example, the upstream data stream may have _many_ columns that your particular streaming job does not want to send downstream. Suppose your task is to create a privacy-compliant downstream table from a stream of all the new users signing up for your platform. The user stream might have:

- First and last name
- Birthday
- Home address
- Government ID

For example, the downstream table may only need the name and birthday columns. To do this, use the `select` operator.

<!--TODO(neil), code example. This doesn't need to work E2E, we can just assume the existence of some DataFrame `df` with a known schema. Similar to what we already have. -->

Another reason to project is that if your stream is only going to be using a few columns from an source with many columns, it's cheaper—in terms of memory and CPU utilization to eliminate unnecessary data (columns) flowing through the system.

## What is selection?

Selection is about keeping rows that satisfy a specified condition. In SQL, the `where` operator is used for this, while in programming languages, this function is usually refered to as the higher-order-function (usually abbreviated as _HOF_) named `filter`. You can use either on a DataFrame - the formula is generally the same:

- You provide a string that contains your filtering predicate
- Your filtering predicate can refer to column names as strings
- You can use unary operators like `<`, `>`, `=`, `!=`

<!--TODO(neil), code example-->.

## Projection and Selection

Now, we'll put the following four concepts together to write a fairly useful stateless stream:

<!--TODO(neil)-->
