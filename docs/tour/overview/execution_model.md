TODO(carl): This should give a very high-level overview of the Structured Streaming micro-batch execution model and its guarantees. Specifically, I think we should mention:

- SS reads data from a _source_, is transformed with Spark operators, and is written to a _sink_
- SS has a _micro-batch_ model. This means that we process new source data in small batches. "Repeatedly" is up to the user, whether they want it to be every 1 hour, or as soon as new data is available.
- SS guarantees delivery semantics for the user, like exactly-once or at-least-once.
- The benefit to this model is that you can _incrementally_ your source data without having to worry about keeping track of what has been processed, failures, etc; you don't need to run a batch SQL job every night at 2am and have to wake up to it having failed in the morning.
