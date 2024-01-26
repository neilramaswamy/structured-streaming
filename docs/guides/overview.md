The guides in this section are _opinionated_ articles that aim to walk users through specific APIs and workflows. They primarily aim to give more clarity than precision; if you are looking for precision and nothing else, please see the auto-generated documentation here (TODO).

All of these guides assume that you have gone through the [Tour](../tour/welcome.md). If you don't already know what you're looking for, here's generally the approach you should take to use Structured Streaming end-to-end, with inlined links to the relevant guides:

- Connect to a [source](./connectors/sources.md)
- Once you have a `DataFrame`, you can apply [stateless](), [stateful](), or [custom operators]()
- After transformations, you can configure your stream in many ways:
    - Set a [checkpoint location](./stream_options/checkpointing.md) for fault tolerance
    - Choose how frequently your stream runs with [triggers](./stream_options/triggers.md)
    - For stateful queries, choose the [output mode](./stream_options/output_mode.md) and [state store]()
- Then, you can write your results to a [sink](./connectors/sinks.md)
- You can start/stop/pause your stream with [lifecycle operations]()
- You can [manage streaming queries]() in your `SparkSession`, including starting and stopping individual queries
- Now you're ready for production. You can:
    - Proactively [handle exceptions]()
    - Configure [metrics and monitoring]()
    - Mitigate performance issues with [performance tuning]()
