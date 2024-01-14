TODO(carl): Like the sources page, we can give an overview of built-in sinks. We should provide the minimum information to differentiate the sinks from each other, and out-link any more specific information to the reference. Then, we can introduce the sink configuration API like in sources, where we say to call `.writeStream`, and then they have the `format` and `option` methods. We can then augment the example from the previous section to have `.writeStream` to the console sink. So the rough subsections can be:

- Overview of built-in sinks
- API Introduction
- Augmenting the code snippet from `spark_operators.md`
