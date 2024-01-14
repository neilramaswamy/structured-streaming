TODO(carl): We want to give a brief overview of what happens after you have specified and loaded a source, i.e. you have a `df`. We can briefly introduce stateless vs. stateful operators, saying how filtering is stateless and aggregation is stateful. The goal is to make them feel comfortable with a _slight_ bit of processing, like a `.filter`, so that we can advance in this Overview to the Sinks section. I imagine that a format could be:

- Now that we have a source let's do something with it
- What can we do? It could be stateless or stateful
- Small example: we have `4` and `10` come through our stream, we apply a Spark operator of `.filter(age > 5)`, so only `10` makes it through
- We now have just 10, where do we write it? Sinks are the next section
