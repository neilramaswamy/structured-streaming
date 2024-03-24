## Structured Streaming OSS Documentation Improvement Proposal

This project is a proof-of-concept to improve the Apache Spark Structured Streaming documentation. It is effectively a re-organization of the [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/structured-streaming-programming-guide.html), the document from which it borrows many concepts and shares code snippets. It also tries to add practical advice in relevant places, emphasizing clarity over precision. In no way does this repo claim to be fully original work: this project would be nothing without the years of effort that went into the Apache Spark documentation.

In particular, this project has the following notable features:

1. Programatically generated diagrams for [watermarks](https://structured-streaming.vercel.app/guides/operators/stateful/watermarks/) and [joins](https://structured-streaming.vercel.app/guides/operators/stateful/joins/), which are notoriously tricky topics
2. Extended discussion about operations and testing
3. Organization that should be conducive to good SEO (currently, our programming guide is not very SEO-friendly)

## Developing Locally

1. Clone this repo onto your machine.
2. `cd` into the cloned repository directory.
3. Create virtual environment and enter in: `python3 -m venv env`. And then, `source ./env/bin/activate`
4. Install the dependencies: `pip install -r requirements.txt`
5. Run the server: `mkdocs serve`. That should give you a local URL on which you can view changes.
6. Beware: if your editor auto-formats on save, it might mess up some of the MkDocs directives. I will try to fix this shortly. 
