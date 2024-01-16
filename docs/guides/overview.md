The guides in this section are _opinionated_ articles that aim to walk users through specific APIs and workflows. They primarily aim to give more clarity than precision; if you are looking for precision and nothing else, please see the auto-generated documentation here (TODO).

All of these guides assume that you have gone through the [Tour](../tour/welcome.md). If you don't already know what you're looking for, here's generally the approach you should take to use Structured Streaming end-to-end, with inlined links to the relevant guides:

- Connect to a [source](); you might need a [connector](), and you might need to read a [binary format]()
- Once you have a `DataFrame`, you can apply [stateless](), [stateful](), or [custom operators]()
- After transformations, you can configure your stream in many ways:
    - Set a [checkpoint location]() for fault tolerance
    - Choose how frequently your stream runs with [triggers]()
    - For stateful queries, choose the [output mode]() and [state store]()
- Then, you can write your results to a [sink](); again, you might need a connector or binary format writer
- You can start/stop/pause your stream with [lifecycle operations]()
- You can write [unit tests]() or [performance tests]() to verify your code is correct
- Now you're ready for production. You can:
    - [Deploy]() your code to a Spark cluster (or use a [vendor]())
    - Proactively [handle exceptions]()
    - Configure [metrics and monitoring]()
- If you're in production and something doesn't look quite right:
    - You can fix incorrect results through [debugging]()
    - You can mitigate performance issues with [performance tuning]()

This overview doesn't cover _every_ single question you might have: for that, you might be better off using the search bar.
