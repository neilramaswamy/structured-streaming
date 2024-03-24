- only update state once during each function execution (expensive operation)
- no guarantee of order on the iterator that you get of the records: if you need it sorted, sort it
    - in python, you have a pandas dataframe iterator; don't try to materialize everything (i.e. only if you need two passes)
    - but this could take memory pressure
- no guarantee of order _across_ executions
- scala only: case classes need to be defined in the cell that FMGWS function is defined
- python: reference by column name (angela slack message), you can't use a number!
- python: you ned to pass a _tuple_ to the update function
- python: need to call `state.remove()` to remove the state


- remove state: either because of a time out (event-time or processing-time; no records), or you want to use the watermark (getCurrentWaterarmarkMs)
- two sections of code: hasTimedOut, or not hasTimedOut
- you need to either remove the state, or reset the timeout

- removing the state removes the timeout; resetting the timeout does not remove the state
- 

- put state in local variable, build the new state; at the end, you have the new state (to save) and the records you want to emit
- 

- timeout or not:
    - if not exists:
        - initialize
        - steady state