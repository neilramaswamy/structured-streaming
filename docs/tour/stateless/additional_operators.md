TODO(carl): This is meant to give a brief overview of all the additional stateless operators. Most importantly, I think we should discuss using `.withColumn` to do column derivation. You can use one column to generate an entire other column. You could, for example, `CAST` the data type, or do a substring, etc.

Finally, I think we can briefly mention the union operator and the `flatMap` operator.  Really, their takeaway should be: "oh, I can use any function from Spark" (but maybe not windows, since we'll get to that later). We can also mention the they can use binary serialization/deserialization operators, as suggested in [here].

We can include an example for column derivation, but you can leave that to me (TODO(neil)).
