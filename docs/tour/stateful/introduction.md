TODO(neil): Write an outline for this introduction. We should mention that everything from stateless streaming applies, w.r.t sources, sinks, triggers.

TODO(carl): We should introduce stateful streaming here. We should mention:

- Source/sink configuration is the same, but the data processing is different
- You can still use stateless transformations before/after stateful operators.
- Stateful streaming is a bit more challenging, so we have a "Concepts" section that they should read fully.
- We should give real-life use-cases for the operators: aggregation is used for "Trending Topics" on Twitter (i.e. data pipeline that tags topics on each Tweet, and then you aggregate COUNT on topics), deduplication is for sensor data (deduplicate readings from the same time), joins are for measuring ad campaign success (join impressions against purchases), and FMGWS for any arbitrary logic the user wants to do.
- They can pick and choose the Operators that they read about: each Operator sub-section is designed to be independent.
