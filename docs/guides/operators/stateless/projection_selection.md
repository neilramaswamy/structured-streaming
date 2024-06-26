# Projection and Selection Operators

Projection and selection are the most common stateless operators and limit the columns and rows, respectively, emitted downstream.

!!! note
    In SQL, the operator for projection is `select` whereas the operator for selection is `where`. This can be a bit confusing.

## What is projection?

A projection operator reads the columns from the incoming stream that satisfy a specified condition and emits them downstream. Columns that do not satisfy the specified condition are removed and not saved. For example, the upstream data stream may have _many_ columns that your particular streaming job does not want to send downstream. Suppose your task is to create a privacy-compliant downstream table from a stream of all the new users signing up for your platform.

Let's assume that the data stream has the following columns:

- First and last name
- Birthday
- Home address
- Government ID

Use the `select` operator to limit the columns emitted downstream to only the name and birthday columns from this data stream. This creates a privacy-compliant downstream table by not emitting the home address and government ID columns.

Another use of projection is to reduce the use of memory and CPU resources downstream by eliminating the flow of unnecessary data (columns and rows) through the Spark engine.

## What is selection?

A selection operator only emits a record downstream if its columns satisfy a specified condition. In SQL, the `where` operator is used for this, while in programming languages, this function is usually refered to as the higher-order-function (usually abbreviated as _HOF_) named `filter`. You can use either on a DataFrame - the formula is generally the same:

- You provide a string that contains your filtering predicate
- Your filtering predicate can refer to column names as strings
- You can use unary operators like `<`, `>`, `=`, `!=`

## Projection and Selection

Now, let's see these concepts together in a stateless stream:

=== "Python"

    ```python hl_lines="4"
    df = ...  # streaming DataFrame with IOT device data with schema { device: string, deviceType: string, signal: double, time: DateType }

    # Select the devices which have signal more than 10
    df.select("device").where("signal > 10")
    ```
=== "Scala"

    ```scala hl_lines="2-3"
    // Select the devices which have signal more than 10
    df.select("device").where("signal > 10")      // using untyped APIs
    ds.filter(_.signal > 10).map(_.device)         // using typed APIs
    ```
=== "Java"

    ```java hl_lines="5-7"
    Dataset<Row> df = ...;    // streaming DataFrame with IOT device data with schema { device: string, type: string, signal: double, time: DateType }
    Dataset<DeviceData> ds = df.as(ExpressionEncoder.javaBean(DeviceData.class)); // streaming Dataset with IOT device data

    // Select the devices which have signal more than 10
    df.select("device").where("signal > 10"); // using untyped APIs
    ds.filter((FilterFunction<DeviceData>) value -> value.getSignal() > 10)
      .map((MapFunction<DeviceData, String>) value -> value.getDevice(), Encoders.STRING());
    ```
=== "R"

    ```r hl_lines="4"
    df <- ...  # streaming DataFrame with IOT device data with schema { device: string, deviceType: string, signal: double, time: DateType }

    # Select the devices which have signal more than 10
    select(where(df, "signal > 10"), "device")
    ```
