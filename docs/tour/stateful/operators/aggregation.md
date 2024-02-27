Aggregations in streaming are similar to their batch counterpart, `GROUP BY`: you specify what elements you want to group together, and you compute some function over that group. There is one main complication though: in streaming, we have to assume that we're processing an unbounded number of records. If we don't have a mechanism to get rid of "old" groups from earlier in the stream, the cluster will run out of memory.

Let's tackle this issue: we need some way to "garbage collect" groups that we no longer need. What groups do we no longer need? Well, the groups we no longer need to keep around are the groups that will _never change again_. How can we know this? If we're just aggregating on a `name` column, for example, it's possible for us to receive the same name over the _entirety_ of the stream's lifetime, so we can't remove a group associated with just a name.

However, if we grouped-by a timestamp column, such as a window from 2pm to 3pm, that group would _never change again_ once the stream stopped producing events with a timestamp less than 3pm. From the definition of a [watermark](../concepts/watermarks.md), this happens when the watermark crosses 3pm. At that point, the 2pm to 3pm group could be removed.

So, this leads us to the two principles of streaming aggregations:

1. **Always** specify a watermark so that the engine knows when to clean up old groups
2. **Always** aggregate on an event-time column, like a window over time

## Example

TODO: example with watermark and window (and non-event-time column)

## When to emit streaming aggregation values



## Time windows




1. Data can be delayed, so not all the data for a given group may be present at any moment in time.
2. Data for the same group 


But, there are some complications, 

Streaming aggregations, though, have some complications. 

- need to remove

1. They need to deal with delayed data


The one complication with streaming aggregations is that streaming engines need to deal with an _unbounded_ amount of data. 

Aggregations in Structured Streaming allow you to group related elements together and compute
